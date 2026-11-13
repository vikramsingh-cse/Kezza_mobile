import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.agent import Agent
from app.models.patient import Patient
from app.models.referral import Referral
from app.schemas.referrals import (
    AgentReferralCodeSchema,
    ReferralLeadCreateSchema,
    ReferralResponseSchema,
)
from app.services.auth_service import get_current_user
from app.services.referral_service import (
    create_referral_lead,
    get_agent_referral_summary,
    list_agent_referrals,
)

router = APIRouter(prefix="/referrals", tags=["Referrals"])


@router.get("/my-code", response_model=AgentReferralCodeSchema)
def get_my_referral_code(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Step 1: Agent retrieves their unique referral code, shareable link, and stats.
    """
    if current_user.get("role") != "agent" or not current_user.get("agent_id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only agents have a referral code",
        )

    agent_id = uuid.UUID(current_user["agent_id"])
    try:
        summary = get_agent_referral_summary(agent_id, db)
        return AgentReferralCodeSchema(**summary)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=list[ReferralResponseSchema])
def get_agent_referrals(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Agent retrieves list of referred patients and their progression.
    """
    if current_user.get("role") != "agent" or not current_user.get("agent_id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only agents can view referral lists",
        )

    agent_id = uuid.UUID(current_user["agent_id"])
    return list_agent_referrals(agent_id, db)


@router.post("/lead", response_model=ReferralResponseSchema)
def create_lead(
    payload: ReferralLeadCreateSchema,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Agent registers a patient lead before they download the app.
    Prevents duplicate referrals.
    """
    if current_user.get("role") != "agent" or not current_user.get("agent_id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only agents can register referral leads",
        )

    agent_id = uuid.UUID(current_user["agent_id"])
    try:
        result = create_referral_lead(
            agent_id=agent_id,
            patient_name=payload.patient_name,
            patient_phone_e164=payload.patient_phone_e164,
            service_interest=payload.service_interest,
            preferred_branch_id=payload.preferred_branch_id,
            db=db,
        )
        return ReferralResponseSchema(**result)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/patient-attribution")
def get_patient_attribution(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Patient checks which agent referred them.
    """
    user_id = uuid.UUID(current_user["id"])
    referral = db.scalars(
        select(Referral).where(Referral.patient_user_id == user_id)
    ).first()

    if not referral:
        return {"has_referral": False, "message": "Direct sign up without referral"}

    agent = db.get(Agent, referral.referring_agent_id)
    return {
        "has_referral": True,
        "referring_agent_code": agent.agent_code if agent else "UNKNOWN",
        "status": referral.status,
        "converted_at": referral.converted_at.isoformat() if referral.converted_at else None,
    }
