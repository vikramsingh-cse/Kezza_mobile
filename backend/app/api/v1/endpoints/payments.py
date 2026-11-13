import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.patient import Patient
from app.models.payment import Payment
from app.schemas.payments import PaymentResponseSchema, TreatmentPaymentCreateSchema
from app.services.auth_service import get_current_user
from app.services.payment_service import process_treatment_payment

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.post("/purchase-treatment", response_model=PaymentResponseSchema)
def purchase_treatment_endpoint(
    payload: TreatmentPaymentCreateSchema,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Step 4, 5, 6:
    Records verified treatment payment.
    - Credits patient points ledger (1 point per R10 spent).
    - If patient was referred by an agent, marks referral converted and awards 10% commission!
    """
    # Determine target patient
    target_patient_id = None
    if payload.patient_id:
        target_patient_id = uuid.UUID(payload.patient_id)
    elif current_user.get("patient_id"):
        target_patient_id = uuid.UUID(current_user["patient_id"])
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No patient profile found. Please register as a patient or specify patient_id.",
        )

    try:
        result = process_treatment_payment(
            patient_id=target_patient_id,
            treatment_name=payload.treatment_name,
            amount_rands=payload.amount_rands,
            payment_reference=payload.payment_reference,
            branch_id=payload.branch_id,
            db=db,
        )
        return PaymentResponseSchema(**result)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/history")
def get_payment_history(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.get("patient_id"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Patient profile required",
        )

    patient_id = uuid.UUID(current_user["patient_id"])
    stmt = (
        select(Payment)
        .where(Payment.patient_id == patient_id)
        .order_by(Payment.created_at.desc())
    )
    payments = db.scalars(stmt).all()

    return [
        {
            "id": str(p.id),
            "treatment_name": p.treatment_name,
            "amount_rands": p.amount_cents / 100.0,
            "currency": p.currency,
            "status": p.status,
            "payment_reference": p.payment_reference,
            "verified_at": p.verified_at.isoformat() if p.verified_at else None,
            "created_at": p.created_at.isoformat() if p.created_at else "",
        }
        for p in payments
    ]
