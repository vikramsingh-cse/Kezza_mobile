from pydantic import BaseModel, Field


class ReferralLeadCreateSchema(BaseModel):
    patient_name: str
    patient_phone_e164: str
    preferred_branch_id: str | None = None
    service_interest: str | None = None


class ReferralResponseSchema(BaseModel):
    id: str
    patient_name: str
    patient_phone_e164: str
    referring_agent_id: str
    status: str
    service_interest: str | None = None
    created_at: str
    converted_at: str | None = None


class AgentReferralCodeSchema(BaseModel):
    agent_code: str
    referral_link: str
    total_referrals: int
    converted_count: int
