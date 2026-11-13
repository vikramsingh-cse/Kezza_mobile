import uuid
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.commission import CommissionLedger, CommissionTier
from app.models.patient import Patient
from app.models.payment import Payment
from app.models.points import PointsLedger
from app.models.referral import Referral

CENT = Decimal("0.01")


def _current_points_balance(patient_id: uuid.UUID, db: Session) -> int:
    latest_entry = db.scalars(
        select(PointsLedger)
        .where(PointsLedger.patient_id == patient_id)
        .order_by(PointsLedger.created_at.desc(), PointsLedger.id.desc())
    ).first()
    return latest_entry.balance_after if latest_entry else 0


def _commission_tier(agent_id: uuid.UUID, db: Session) -> tuple[str, Decimal]:
    sales_count = db.scalar(
        select(func.count(CommissionLedger.id)).where(
            CommissionLedger.agent_id == agent_id,
            CommissionLedger.status.in_(("pending", "approved", "paid")),
        ).join(Payment, CommissionLedger.payment_id == Payment.id).where(
            Payment.status == "verified",
        )
    ) or 0
    tier = db.scalars(
        select(CommissionTier)
        .where(
            CommissionTier.is_active.is_(True),
            CommissionTier.min_sales_count <= sales_count,
        )
        .order_by(CommissionTier.min_sales_count.desc())
    ).first()
    if tier:
        return tier.name, Decimal(str(tier.commission_percent))
    return "Standard Tier (10%)", Decimal("10.00")


def process_treatment_payment(
    patient_id: uuid.UUID,
    treatment_name: str,
    amount_rands: Decimal,
    payment_reference: str,
    branch_id: uuid.UUID | None,
    db: Session,
) -> dict:
    """Record a trusted collected payment and append its reward/commission ledger entries.

    This function must only be called by the authenticated payment integration route.
    Amounts are persisted and calculated in cents; the mobile client is read-only.
    """
    patient = db.scalar(
        select(Patient).where(Patient.id == patient_id).with_for_update()
    )
    if not patient:
        raise ValueError("Patient not found")
    if db.scalars(
        select(Payment).where(Payment.payment_reference == payment_reference)
    ).first():
        raise ValueError("Payment reference has already been recorded")

    amount_cents = int((amount_rands * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    if amount_cents <= 0:
        raise ValueError("Amount must be greater than zero")
    amount = (Decimal(amount_cents) / 100).quantize(CENT)

    payment = Payment(
        patient_id=patient.id,
        branch_id=branch_id or patient.preferred_branch_id,
        treatment_name=treatment_name,
        amount_cents=amount_cents,
        currency="ZAR",
        status="verified",
        payment_reference=payment_reference,
        verified_at=datetime.now(timezone.utc),
    )
    db.add(payment)
    db.flush()

    # One reward point per R10 collected; the amount is already integral cents.
    points_to_award = amount_cents // 1000
    previous_balance = _current_points_balance(patient.id, db)
    new_points_balance = previous_balance + points_to_award
    db.add(
        PointsLedger(
            patient_id=patient.id,
            payment_id=payment.id,
            points=points_to_award,
            balance_after=new_points_balance,
            event_type="treatment_reward",
            description=f"Reward points for {treatment_name}",
        )
    )

    commission_amount = None
    referral_converted = False
    referral = db.scalars(
        select(Referral)
        .where(Referral.patient_user_id == patient.user_id)
        .with_for_update()
    ).first()
    if referral:
        if referral.status != "converted":
            referral.status = "converted"
            referral.converted_at = datetime.now(timezone.utc)
            referral_converted = True

        _, tier_percent = _commission_tier(referral.referring_agent_id, db)
        commission_cents = int(
            (Decimal(amount_cents) * tier_percent / Decimal("100")).quantize(
                Decimal("1"), rounding=ROUND_HALF_UP
            )
        )
        commission_amount = (Decimal(commission_cents) / 100).quantize(CENT)
        db.add(
            CommissionLedger(
                agent_id=referral.referring_agent_id,
                referral_id=referral.id,
                payment_id=payment.id,
                tier_percent=float(tier_percent),
                amount_cents=commission_cents,
                status="approved",
                approved_at=datetime.now(timezone.utc),
            )
        )

    db.commit()
    db.refresh(payment)

    return {
        "payment_id": str(payment.id),
        "treatment_name": payment.treatment_name,
        "amount_rands": amount,
        "status": payment.status,
        "points_earned": points_to_award,
        "new_points_balance": new_points_balance,
        "agent_commission_rands": commission_amount,
        "referral_converted": referral_converted,
    }


def reverse_treatment_payment(
    payment_id: uuid.UUID,
    reason: str,
    db: Session,
) -> dict:
    """Refund a payment while preserving the original and appending ledger reversals."""
    payment = db.scalar(
        select(Payment).where(Payment.id == payment_id).with_for_update()
    )
    if not payment:
        raise ValueError("Payment not found")
    if payment.status == "refunded":
        return {"payment_id": str(payment.id), "status": "refunded", "already_reversed": True}
    if payment.status != "verified":
        raise ValueError("Only verified payments can be refunded")

    patient = db.scalar(
        select(Patient).where(Patient.id == payment.patient_id).with_for_update()
    )
    if not patient:
        raise ValueError("Patient not found")

    rewarded_points = db.scalar(
        select(func.coalesce(func.sum(PointsLedger.points), 0)).where(
            PointsLedger.payment_id == payment.id,
            PointsLedger.event_type == "treatment_reward",
        )
    ) or 0
    if rewarded_points:
        new_balance = _current_points_balance(patient.id, db) - rewarded_points
        db.add(
            PointsLedger(
                patient_id=patient.id,
                payment_id=payment.id,
                points=-rewarded_points,
                balance_after=new_balance,
                event_type="refund_reversal",
                description=f"Reward reversal: {reason}",
            )
        )

    original_commissions = db.scalars(
        select(CommissionLedger).where(
            CommissionLedger.payment_id == payment.id,
            CommissionLedger.status.in_(("pending", "approved", "paid")),
        )
    ).all()
    for original in original_commissions:
        db.add(
            CommissionLedger(
                agent_id=original.agent_id,
                referral_id=original.referral_id,
                payment_id=payment.id,
                tier_percent=original.tier_percent,
                amount_cents=-original.amount_cents,
                status="reversed",
            )
        )

    payment.status = "refunded"
    db.commit()
    return {"payment_id": str(payment.id), "status": "refunded", "already_reversed": False}
