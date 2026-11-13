from pydantic import BaseModel, Field


class OtpRequestSchema(BaseModel):
    phone_e164: str = Field(..., description="E.164 phone number, e.g. +27821234567")


class OtpVerifySchema(BaseModel):
    phone_e164: str = Field(..., description="E.164 phone number")
    otp_code: str = Field(..., description="6-digit verification code")


class UserRegisterSchema(BaseModel):
    phone_e164: str
    full_name: str
    role: str = Field("patient", description="'patient' or 'agent'")
    email: str | None = None
    referral_code: str | None = Field(None, description="Optional agent referral code")


class UserProfileSchema(BaseModel):
    id: str
    phone_e164: str
    full_name: str
    email: str | None = None
    role: str
    agent_code: str | None = None
    patient_id: str | None = None
    agent_id: str | None = None
    is_active: bool = True


class TokenResponseSchema(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfileSchema
