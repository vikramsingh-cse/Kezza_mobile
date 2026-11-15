import hmac
import uuid
from fastapi import APIRouter, Depends, Header, HTTPException, status  # pyright: ignore[reportMissingImports]
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import PAYMENT_VERIFICATION_API_KEY
from app.models.patient import Patient
from app.models.payment import Payment
from app.schemas.payments import (
    PaymentRefundSchema,
    PaymentResponseSchema,
    TreatmentPaymentCreateSchema,
)
from app.services.auth_service import get_current_user
from app.services.payment_service import process_treatment_payment, reverse_treatment_payment

router = APIRouter(prefix="/payments", tags=["Payments"])


def require_payment_source_key(
    x_payment_verification_key: str | None = Header(default=None),
) -> None:
    if not PAYMENT_VERIFICATION_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment verification integration is not configured",
        )
    if len(PAYMENT_VERIFICATION_API_KEY) < 32:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment verification credential is too short",
        )
    if not x_payment_verification_key or not hmac.compare_digest(
        x_payment_verification_key, PAYMENT_VERIFICATION_API_KEY
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A trusted payment verification credential is required",
        )


@router.post("/verify-collected", response_model=PaymentResponseSchema)
def verify_collected_payment_endpoint(
    payload: TreatmentPaymentCreateSchema,
    _: None = Depends(require_payment_source_key),
    db: Session = Depends(get_db),
):
    """
    Internal integration endpoint. Call only after a POS/payment provider confirms
    collection. Mobile user tokens are deliberately not accepted here.
    """
    try:
        result = process_treatment_payment(
            patient_id=payload.patient_id,
            treatment_name=payload.treatment_name,
            amount_rupees=payload.amount_rupees,
            payment_reference=payload.payment_reference,
            branch_id=payload.branch_id,
            db=db,
        )
        return PaymentResponseSchema(**result)
    except ValueError as e:
        code = status.HTTP_409_CONFLICT if "already" in str(e).lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=str(e))


@router.post("/{payment_id}/refund")
def refund_collected_payment_endpoint(
    payment_id: uuid.UUID,
    payload: PaymentRefundSchema,
    _: None = Depends(require_payment_source_key),
    db: Session = Depends(get_db),
):
    """Append points and commission reversals for a trusted refund event."""
    try:
        return reverse_treatment_payment(payment_id, payload.reason, db)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/history")
def get_payment_history(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.get("role") != "patient" or not current_user.get("patient_id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
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
            "amount_minor_units": p.amount_minor_units,
            "currency": p.currency,
            "status": p.status,
            "payment_reference": p.payment_reference,
            "verified_at": p.verified_at.isoformat() if p.verified_at else None,
            "refunded_at": p.refunded_at.isoformat() if p.refunded_at else None,
            "refund_reason": p.refund_reason,
            "created_at": p.created_at.isoformat() if p.created_at else "",
        }
        for p in payments
    ]
