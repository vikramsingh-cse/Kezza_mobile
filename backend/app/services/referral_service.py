import uuid
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.agent import Agent
from app.models.referral import Referral
from app.models.user import User


def get_agent_referral_summary(agent_id: uuid.UUID, db: Session) -> dict:
    agent = db.get(Agent, agent_id)
    if not agent:
        raise ValueError("Agent not found")

    total_count = db.scalar(
        select(func.count(Referral.id)).where(Referral.referring_agent_id == agent.id)
    ) or 0

    converted_count = db.scalar(
        select(func.count(Referral.id)).where(
            Referral.referring_agent_id == agent.id,
            Referral.status == "converted",
        )
    ) or 0

    # Expo Router maps this URL to the /(auth)/login screen. The referral code
    # is carried through OTP verification and registration before attribution locks.
    referral_link = f"kezzamobile://login?ref={agent.agent_code}"

    return {
        "agent_code": agent.agent_code,
        "referral_link": referral_link,
        "total_referrals": total_count,
        "converted_count": converted_count,
    }


def list_agent_referrals(agent_id: uuid.UUID, db: Session) -> list[dict]:
    stmt = (
        select(Referral)
        .where(Referral.referring_agent_id == agent_id)
        .order_by(Referral.created_at.desc())
    )
    referrals = db.scalars(stmt).all()
    results = []
    for r in referrals:
        results.append({
            "id": str(r.id),
            "patient_name": r.patient_name,
            "patient_phone_e164": r.patient_phone_e164,
            "referring_agent_id": str(r.referring_agent_id),
            "status": r.status,
            "service_interest": r.service_interest,
            "created_at": r.created_at.isoformat() if r.created_at else "",
            "converted_at": r.converted_at.isoformat() if r.converted_at else None,
        })
    return results


def create_referral_lead(
    agent_id: uuid.UUID,
    patient_name: str,
    patient_phone_e164: str,
    service_interest: str | None,
    preferred_branch_id: str | None,
    db: Session,
) -> dict:
    # Rule 4: Prevent duplicate referrals for the same phone number
    existing = db.scalars(
        select(Referral).where(Referral.patient_phone_e164 == patient_phone_e164)
    ).first()

    if existing:
        raise ValueError(f"Patient with number {patient_phone_e164} has already been registered or referred.")

    # Check if patient already has a user account
    patient_user = db.scalars(
        select(User).where(User.phone_e164 == patient_phone_e164)
    ).first()

    branch_uuid = uuid.UUID(preferred_branch_id) if preferred_branch_id else None

    referral = Referral(
        patient_user_id=patient_user.id if patient_user else None,
        patient_name=patient_name,
        patient_phone_e164=patient_phone_e164,
        referring_agent_id=agent_id,
        preferred_branch_id=branch_uuid,
        service_interest=service_interest,
        status="registered",
    )
    db.add(referral)
    db.commit()
    db.refresh(referral)

    return {
        "id": str(referral.id),
        "patient_name": referral.patient_name,
        "patient_phone_e164": referral.patient_phone_e164,
        "referring_agent_id": str(referral.referring_agent_id),
        "status": referral.status,
        "service_interest": referral.service_interest,
        "created_at": referral.created_at.isoformat() if referral.created_at else "",
        "converted_at": None,
    }
