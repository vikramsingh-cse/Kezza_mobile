import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.wallet import AgentEarningsResponseSchema, PatientWalletResponseSchema
from app.services.auth_service import get_current_user
from app.services.wallet_service import get_agent_earnings, get_patient_wallet

router = APIRouter(prefix="/wallet", tags=["Wallet & Commissions"])


@router.get("/patient", response_model=PatientWalletResponseSchema)
def get_patient_wallet_endpoint(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Step 7 (Patient): Patient views earned treatment credit and reward points ledger.
    """
    if current_user.get("role") != "patient" or not current_user.get("patient_id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not have a patient profile",
        )

    patient_id = uuid.UUID(current_user["patient_id"])
    return get_patient_wallet(patient_id, db)


@router.get("/agent", response_model=AgentEarningsResponseSchema)
def get_agent_earnings_endpoint(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Step 7 (Agent): Agent views commission tier, pending/approved earnings, and commission ledger.
    """
    if current_user.get("role") != "agent" or not current_user.get("agent_id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not have an agent profile",
        )

    agent_id = uuid.UUID(current_user["agent_id"])
    return get_agent_earnings(agent_id, db)
