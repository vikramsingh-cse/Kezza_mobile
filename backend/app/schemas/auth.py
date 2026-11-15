from typing import Literal

from pydantic import BaseModel, Field

INDIAN_MOBILE_PATTERN = r"^\+91[6-9]\d{9}$"


class OtpRequestSchema(BaseModel):
    phone_e164: str = Field(
        ...,
        pattern=INDIAN_MOBILE_PATTERN,
        description="Indian mobile number in E.164 format, e.g. +919876543210",
    )


class OtpVerifySchema(BaseModel):
    phone_e164: str = Field(..., pattern=INDIAN_MOBILE_PATTERN)
    otp_code: str = Field(..., pattern=r"^\d{6}$", description="6-digit verification code")


class UserRegisterSchema(BaseModel):
    phone_e164: str = Field(..., pattern=INDIAN_MOBILE_PATTERN)
    full_name: str = Field(..., min_length=1, max_length=150)
    role: Literal["patient", "agent"] = "patient"
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
