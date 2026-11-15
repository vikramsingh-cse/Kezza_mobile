from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class TreatmentPaymentCreateSchema(BaseModel):
    patient_id: UUID
    treatment_name: str = Field(..., min_length=1, max_length=150)
    amount_rupees: Decimal = Field(..., gt=0, decimal_places=2)
    payment_reference: str = Field(..., min_length=1, max_length=100)
    branch_id: UUID | None = None


class PaymentResponseSchema(BaseModel):
    payment_id: str
    treatment_name: str
    amount_minor_units: int
    currency: str
    status: str
    points_earned: int
    new_points_balance: int
    agent_commission_minor_units: int | None = None
    referral_converted: bool = False


class PaymentRefundSchema(BaseModel):
    reason: str = Field(..., min_length=3, max_length=255)
