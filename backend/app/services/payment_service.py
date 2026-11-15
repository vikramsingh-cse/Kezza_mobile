import uuid
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.agent import Agent
from app.models.commission import CommissionLedger, CommissionTier
from app.models.patient import Patient
from app.models.payment import Payment
from app.models.points import PointsLedger
from app.models.referral import Referral

MINOR_UNITS_PER_RUPEE = Decimal("100")
POINTS_PER_RUPEE = 1
POINTS_PER_RUPEE_OF_TREATMENT_CREDIT = 25
INR_POLICY_VERSION = "inr_v1"
LEGACY_ZAR_POLICY_VERSION = "legacy_zar_v1"


def _points_balance(
    patient_id: uuid.UUID,
    db: Session,
    policy_version: str,
) -> int:
    return int(
        db.scalar(
            select(func.coalesce(func.sum(PointsLedger.points), 0)).where(
                PointsLedger.patient_id == patient_id,
                PointsLedger.policy_version == policy_version,
            )
        )
        or 0
    )


def _commission_tier(
    agent_id: uuid.UUID,
    db: Session,
) -> tuple[str, Decimal, int]:
    """Select a tier from the agent's active, eligible direct recruits."""
    eligible_direct_agents = int(
        db.scalar(
            select(func.count(Agent.id)).where(
                Agent.sponsor_agent_id == agent_id,
                Agent.status == "active",
            )
        )
        or 0
    )

    tier = db.scalars(
        select(CommissionTier)
        .where(
            CommissionTier.is_active.is_(True),
            CommissionTier.min_eligible_direct_agents <= eligible_direct_agents,
        )
        .order_by(CommissionTier.min_eligible_direct_agents.desc())
    ).first()
    if tier:
        return tier.name, Decimal(tier.commission_percent), eligible_direct_agents

    # Missing or disabled tier configuration must never inflate commission.
    return "Base (1%)", Decimal("1.0000"), eligible_direct_agents


def process_treatment_payment(
    patient_id: uuid.UUID,
    treatment_name: str,
    amount_rupees: Decimal,
    payment_reference: str,
    branch_id: uuid.UUID | None,
    db: Session,
) -> dict:
    """Record a trusted collected INR payment and append financial ledger rows.

    This function is called only by the payment-verification integration route.
    Payment amounts are stored as integer paise. The patient row lock serializes
    point-balance updates for this patient; the unique payment reference is the
    final duplicate guard for concurrent requests.
    """
    try:
        patient = db.scalar(
            select(Patient).where(Patient.id == patient_id).with_for_update()
        )
        if not patient:
            raise ValueError("Patient not found")

        if db.scalar(
            select(Payment.id).where(Payment.payment_reference == payment_reference)
        ):
            raise ValueError("Payment reference has already been recorded")

        if not amount_rupees.is_finite() or amount_rupees <= 0:
            raise ValueError("Amount must be greater than zero")
        amount_rupees = amount_rupees.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        amount_paise = int(amount_rupees * MINOR_UNITS_PER_RUPEE)
        if amount_paise <= 0:
            raise ValueError("Amount must be at least one paise")

        now = datetime.now(timezone.utc)
        payment = Payment(
            patient_id=patient.id,
            branch_id=branch_id or patient.preferred_branch_id,
            treatment_name=treatment_name,
            amount_minor_units=amount_paise,
            currency="INR",
            status="verified",
            payment_reference=payment_reference,
            verified_at=now,
        )
        db.add(payment)
        db.flush()

        # One whole point per whole rupee collected; fractional rupees do not
        # earn a partial point because the points ledger uses integer points.
        points_earned = amount_paise // int(MINOR_UNITS_PER_RUPEE)
        previous_balance = _points_balance(patient.id, db, INR_POLICY_VERSION)
        new_points_balance = previous_balance + points_earned
        reward = PointsLedger(
            patient_id=patient.id,
            payment_id=payment.id,
            points=points_earned,
            balance_after=new_points_balance,
            event_type="treatment_reward",
            description=f"Reward points for {treatment_name}",
            policy_version=INR_POLICY_VERSION,
        )
        db.add(reward)

        commission_paise = None
        referral_converted = False
        referral = db.scalars(
            select(Referral)
            .where(Referral.patient_user_id == patient.user_id)
            .with_for_update()
        ).first()
        if referral:
            if referral.status != "converted":
                referral.status = "converted"
                referral.converted_at = now
                referral_converted = True

            tier_name, tier_percent, eligible_direct_agents = _commission_tier(
                referral.referring_agent_id,
                db,
            )
            commission_paise = int(
                (
                    Decimal(amount_paise)
                    * tier_percent
                    / Decimal("100")
                ).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
            )
            db.add(
                CommissionLedger(
                    agent_id=referral.referring_agent_id,
                    referral_id=referral.id,
                    payment_id=payment.id,
                    tier_percent=tier_percent,
                    tier_name=tier_name,
                    eligible_direct_agents=eligible_direct_agents,
                    amount_minor_units=commission_paise,
                    status="pending",
                )
            )

        db.commit()
        db.refresh(payment)
    except ValueError:
        # Validation and duplicate checks occur before any writes. Let the
        # request-scoped dependency close the read-only transaction normally.
        raise
    except IntegrityError as exc:
        db.rollback()
        if "payment_reference" in str(exc).lower():
            raise ValueError("Payment reference has already been recorded") from exc
        raise
    except Exception:
        db.rollback()
        raise

    return {
        "payment_id": str(payment.id),
        "treatment_name": payment.treatment_name,
        "amount_minor_units": payment.amount_minor_units,
        "currency": payment.currency,
        "status": payment.status,
        "points_earned": points_earned,
        "new_points_balance": new_points_balance,
        "agent_commission_minor_units": commission_paise,
        "referral_converted": referral_converted,
    }


def reverse_treatment_payment(
    payment_id: uuid.UUID,
    reason: str,
    db: Session,
) -> dict:
    """Record a full refund and append linked point and commission reversals."""
    reason = reason.strip()
    if len(reason) < 3:
        raise ValueError("Refund reason must contain at least three non-space characters")

    try:
        payment = db.scalar(
            select(Payment).where(Payment.id == payment_id).with_for_update()
        )
        if not payment:
            raise ValueError("Payment not found")
        if payment.status == "refunded":
            return {
                "payment_id": str(payment.id),
                "status": "refunded",
                "already_reversed": True,
            }
        if payment.status != "verified":
            raise ValueError("Only verified payments can be refunded")

        patient = db.scalar(
            select(Patient).where(Patient.id == payment.patient_id).with_for_update()
        )
        if not patient:
            raise ValueError("Patient not found")

        reward_entries = db.scalars(
            select(PointsLedger).where(
                PointsLedger.payment_id == payment.id,
                PointsLedger.event_type == "treatment_reward",
            )
        ).all()
        reversed_points = 0
        for reward in reward_entries:
            if reward.points <= 0:
                continue
            new_balance = (
                _points_balance(patient.id, db, reward.policy_version) - reward.points
            )
            db.add(
                PointsLedger(
                    patient_id=patient.id,
                    payment_id=payment.id,
                    reversal_of_id=reward.id,
                    points=-reward.points,
                    balance_after=new_balance,
                    event_type="refund_reversal",
                    description=f"Reward reversal: {reason}",
                    policy_version=reward.policy_version,
                )
            )
            reversed_points += reward.points

        original_commissions = db.scalars(
            select(CommissionLedger).where(
                CommissionLedger.payment_id == payment.id,
                CommissionLedger.status.in_(("pending", "approved", "paid")),
            )
        ).all()
        reversed_commission_minor_units = 0
        for original in original_commissions:
            db.add(
                CommissionLedger(
                    agent_id=original.agent_id,
                    referral_id=original.referral_id,
                    payment_id=payment.id,
                    reversal_of_id=original.id,
                    tier_percent=original.tier_percent,
                    tier_name=original.tier_name,
                    eligible_direct_agents=original.eligible_direct_agents,
                    amount_minor_units=-original.amount_minor_units,
                    status="reversed",
                )
            )
            reversed_commission_minor_units += original.amount_minor_units

        payment.status = "refunded"
        payment.refunded_at = datetime.now(timezone.utc)
        payment.refund_reason = reason
        db.commit()
    except ValueError:
        # Not-found and state validation paths made no writes.
        raise
    except Exception:
        db.rollback()
        raise

    return {
        "payment_id": str(payment.id),
        "status": "refunded",
        "already_reversed": False,
        "reversed_points": reversed_points,
        "reversed_commission_minor_units": reversed_commission_minor_units,
        "currency": payment.currency,
    }
