from pydantic import BaseModel


class PointsLedgerEntrySchema(BaseModel):
    id: str
    points: int
    balance_after: int
    event_type: str
    description: str
    policy_version: str
    reversal_of_id: str | None = None
    created_at: str


class PatientWalletResponseSchema(BaseModel):
    total_points: int
    credit_minor_units: int
    currency: str
    legacy_zar_points: int
    legacy_zar_credit_minor_units: int
    points_rate_description: str
    ledger: list[PointsLedgerEntrySchema]


class CommissionLedgerEntrySchema(BaseModel):
    id: str
    tier_name: str | None = None
    eligible_direct_agents: int | None = None
    tier_percent: float
    amount_minor_units: int
    currency: str
    status: str
    reversal_of_id: str | None = None
    created_at: str
    treatment_name: str | None = None


class CommissionCurrencyTotalsSchema(BaseModel):
    pending_minor_units: int
    approved_minor_units: int
    paid_minor_units: int
    total_earned_minor_units: int


class AgentEarningsResponseSchema(BaseModel):
    agent_code: str
    commission_tier: str
    tier_percent: float
    eligible_direct_agents: int
    pending_minor_units: int
    approved_minor_units: int
    paid_minor_units: int
    total_earned_minor_units: int
    earnings_by_currency: dict[str, CommissionCurrencyTotalsSchema]
    ledger: list[CommissionLedgerEntrySchema]
