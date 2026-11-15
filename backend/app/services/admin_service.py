import uuid
from datetime import datetime, timezone

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session, aliased

from app.models.agent import Agent
from app.models.commission import CommissionLedger
from app.models.patient import Patient
from app.models.payment import Payment
from app.models.points import PointsLedger
from app.models.user import User
from app.services.payment_service import INR_POLICY_VERSION

MAX_MANUAL_POINTS = 1_000_000


def search_patients(query: str, db: Session) -> list[dict]:
    """Find a bounded set of patients by name or phone for audited point grants."""
    term = query.strip().replace("%", "").replace("_", "")
    if len(term) < 2:
        raise ValueError("Search using at least two letters or digits")

    balance = func.coalesce(func.sum(PointsLedger.points), 0)
    rows = db.execute(
        select(
            Patient.id,
            User.full_name,
            User.phone_e164,
            balance.label("total_points"),
        )
        .join(User, User.id == Patient.user_id)
        .outerjoin(
            PointsLedger,
            and_(
                PointsLedger.patient_id == Patient.id,
                PointsLedger.policy_version == INR_POLICY_VERSION,
            ),
        )
        .where(
            User.role == "patient",
            User.is_active.is_(True),
            (User.full_name.ilike(f"%{term}%"))
            | (User.phone_e164.ilike(f"%{term}%")),
        )
        .group_by(Patient.id, User.full_name, User.phone_e164)
        .order_by(User.full_name.asc(), Patient.id.asc())
        .limit(50)
    ).all()

    return [
        {
            "patient_id": str(patient_id),
            "full_name": full_name,
            "phone_e164": phone_e164,
            "total_points": int(total_points),
            "credit_minor_units": int(total_points) * 100 // 25,
        }
        for patient_id, full_name, phone_e164, total_points in rows
    ]


def list_pending_commissions(db: Session) -> list[dict]:
    """List at most 100 pending commissions with the context admins need."""
    agent_user = aliased(User)
    patient_user = aliased(User)
    rows = db.execute(
        select(
            CommissionLedger,
            Agent.agent_code,
            agent_user.full_name,
            agent_user.phone_e164,
            patient_user.full_name,
            patient_user.phone_e164,
            Payment.treatment_name,
            Payment.currency,
        )
        .join(Agent, Agent.id == CommissionLedger.agent_id)
        .join(agent_user, agent_user.id == Agent.user_id)
        .join(Payment, Payment.id == CommissionLedger.payment_id)
        .join(Patient, Patient.id == Payment.patient_id)
        .join(patient_user, patient_user.id == Patient.user_id)
        .where(CommissionLedger.status == "pending")
        .order_by(CommissionLedger.created_at.asc(), CommissionLedger.id.asc())
        .limit(100)
    ).all()

    return [
        {
            "commission_id": str(commission.id),
            "agent_name": agent_name,
            "agent_phone_e164": agent_phone,
            "agent_code": agent_code,
            "patient_name": patient_name,
            "patient_phone_e164": patient_phone,
            "treatment_name": treatment_name,
            "amount_minor_units": commission.amount_minor_units,
            "currency": currency,
            "tier_name": commission.tier_name or "Legacy tier",
            "tier_percent": float(commission.tier_percent),
            "created_at": commission.created_at.isoformat()
            if commission.created_at
            else "",
        }
        for (
            commission,
            agent_code,
            agent_name,
            agent_phone,
            patient_name,
            patient_phone,
            treatment_name,
            currency,
        ) in rows
    ]


def approve_commission(
    commission_id: uuid.UUID,
    admin_user_id: uuid.UUID,
    db: Session,
) -> dict:
    """Approve a pending commission after locking its payment and ledger row."""
    commission_stub = db.get(CommissionLedger, commission_id)
    if not commission_stub:
        raise ValueError("Commission not found")

    payment = db.scalar(
        select(Payment)
        .where(Payment.id == commission_stub.payment_id)
        .with_for_update()
    )
    commission = db.scalar(
        select(CommissionLedger)
        .where(CommissionLedger.id == commission_id)
        .with_for_update()
    )
    if not payment or not commission:
        raise ValueError("Commission or payment not found")
    if commission.status != "pending":
        raise ValueError("Only pending commissions can be approved")
    if payment.status != "verified":
        raise ValueError("Commission payment is not verified")

    commission.status = "approved"
    commission.approved_at = datetime.now(timezone.utc)
    commission.approved_by_user_id = admin_user_id
    db.commit()

    return {
        "commission_id": str(commission.id),
        "status": commission.status,
        "approved_at": commission.approved_at.isoformat(),
        "approved_by_user_id": str(admin_user_id),
    }


def grant_patient_points(
    patient_id: uuid.UUID,
    points: int,
    reason: str,
    admin_user_id: uuid.UUID,
    db: Session,
) -> dict:
    """Append an audited positive points adjustment and return its new balance."""
    reason = reason.strip()
    if not reason or len(reason) < 3:
        raise ValueError("A reason of at least three characters is required")
    if points <= 0 or points > MAX_MANUAL_POINTS:
        raise ValueError(f"Points must be between 1 and {MAX_MANUAL_POINTS}")

    patient = db.scalar(
        select(Patient).where(Patient.id == patient_id).with_for_update()
    )
    if not patient:
        raise ValueError("Patient not found")

    current_balance = int(
        db.scalar(
            select(func.coalesce(func.sum(PointsLedger.points), 0)).where(
                PointsLedger.patient_id == patient.id,
                PointsLedger.policy_version == INR_POLICY_VERSION,
            )
        )
        or 0
    )
    new_balance = current_balance + points
    entry = PointsLedger(
        patient_id=patient.id,
        points=points,
        balance_after=new_balance,
        event_type="manual_adjustment",
        description=f"Admin grant: {reason}",
        policy_version=INR_POLICY_VERSION,
        created_by_user_id=admin_user_id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    return {
        "ledger_id": str(entry.id),
        "patient_id": str(patient.id),
        "points_added": points,
        "total_points": new_balance,
        "credit_minor_units": new_balance * 100 // 25,
        "reason": reason,
        "created_by_user_id": str(admin_user_id),
        "created_at": entry.created_at.isoformat() if entry.created_at else "",
    }
