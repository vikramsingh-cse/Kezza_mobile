from pydantic import BaseModel, Field


class TreatmentPaymentCreateSchema(BaseModel):
    patient_id: str | None = Field(None, description="Patient UUID (if omitted, uses authenticated patient)")
    treatment_name: str = Field(..., description="Name of dental/aesthetic treatment, e.g. 'Teeth Whitening'")
    amount_rands: float = Field(..., description="Amount paid in Rands, e.g. 1500.00")
    payment_reference: str | None = Field(None, description="Optional unique clinic invoice/receipt reference")
    branch_id: str | None = None


class PaymentResponseSchema(BaseModel):
    payment_id: str
    treatment_name: str
    amount_rands: float
    status: str
    points_earned: int
    new_points_balance: int
    agent_commission_rands: float | None = None
    referral_converted: bool = False
