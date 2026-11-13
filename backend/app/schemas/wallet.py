from pydantic import BaseModel


class PointsLedgerEntrySchema(BaseModel):
    id: str
    points: int
    balance_after: int
    event_type: str
    description: str
    created_at: str


class PatientWalletResponseSchema(BaseModel):
    total_points: int
    credit_rands: float
    points_rate_description: str
    ledger: list[PointsLedgerEntrySchema]


class CommissionLedgerEntrySchema(BaseModel):
    id: str
    tier_percent: float
    amount_rands: float
    status: str
    created_at: str
    treatment_name: str | None = None


class AgentEarningsResponseSchema(BaseModel):
    agent_code: str
    commission_tier: str
    tier_percent: float
    pending_rands: float
    approved_rands: float
    paid_rands: float
    total_earned_rands: float
    ledger: list[CommissionLedgerEntrySchema]
