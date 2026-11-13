import uuid
from datetime import datetime, timezone
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.agent import Agent
from app.models.commission import CommissionLedger, CommissionTier
from app.models.patient import Patient
from app.models.payment import Payment
from app.models.points import PointsLedger
from app.models.referral import Referral


def process_treatment_payment(
    patient_id: uuid.UUID,
    treatment_name: str,
    amount_rands: float,
    payment_reference: str | None,
    branch_id: str | None,
    db: Session,
) -> dict:
    """
    Core Journey Step 4, 5 & 6:
    1. Verifies & records treatment payment.
    2. Credits rewards to patient's points ledger.
    3. Converts referral and records agent's commission in commission ledger.
    """
    patient = db.get(Patient, patient_id)
    if not patient:
        raise ValueError("Patient not found")

    amount_cents = int(round(amount_rands * 100))
    if amount_cents <= 0:
        raise ValueError("Amount must be greater than zero")

    ref = payment_reference or f"KZ-TX-{uuid.uuid4().hex[:8].upper()}"
    branch_uuid = uuid.UUID(branch_id) if branch_id else patient.preferred_branch_id

    # 1. Record verified Payment
    payment = Payment(
        patient_id=patient.id,
        branch_id=branch_uuid,
        treatment_name=treatment_name,
        amount_cents=amount_cents,
        currency="ZAR",
        status="verified",
        payment_reference=ref,
        verified_at=datetime.now(timezone.utc),
    )
    db.add(payment)
    db.flush()

    # 2. Step 5: Reward Patient with Points (1 point per R10 spent = 10% back)
    points_to_award = max(1, int(amount_rands // 10))

    # Fetch current balance
    latest_entry = db.scalars(
        select(PointsLedger)
        .where(PointsLedger.patient_id == patient.id)
        .order_by(PointsLedger.created_at.desc())
    ).first()
    previous_balance = latest_entry.balance_after if latest_entry else 0
    new_points_balance = previous_balance + points_to_award

    points_entry = PointsLedger(
        patient_id=patient.id,
        payment_id=payment.id,
        points=points_to_award,
        balance_after=new_points_balance,
        event_type="treatment_reward",
        description=f"Reward points for {treatment_name}",
    )
    db.add(points_entry)

    # 3. Step 6: Determine and award Agent Commission
    agent_commission_rands = None
    referral_converted = False

    referral = db.scalars(
        select(Referral).where(Referral.patient_user_id == patient.user_id)
    ).first()

    if referral:
        # Lock and convert referral if not already converted
        if referral.status != "converted":
            referral.status = "converted"
            referral.converted_at = datetime.now(timezone.utc)
            referral_converted = True

        # Determine agent tier (default 10% commission on sales)
        tier_percent = 10.0
        commission_cents = int(round(amount_cents * (tier_percent / 100.0)))
        agent_commission_rands = commission_cents / 100.0

        commission_entry = CommissionLedger(
            agent_id=referral.referring_agent_id,
            referral_id=referral.id,
            payment_id=payment.id,
            tier_percent=tier_percent,
            amount_cents=commission_cents,
            status="approved",
            approved_at=datetime.now(timezone.utc),
        )
        db.add(commission_entry)

    db.commit()
    db.refresh(payment)

    return {
        "payment_id": str(payment.id),
        "treatment_name": payment.treatment_name,
        "amount_rands": amount_rands,
        "status": payment.status,
        "points_earned": points_to_award,
        "new_points_balance": new_points_balance,
        "agent_commission_rands": agent_commission_rands,
        "referral_converted": referral_converted,
    }
