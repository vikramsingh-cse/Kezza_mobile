from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.auth import (
    OtpRequestSchema,
    OtpVerifySchema,
    TokenResponseSchema,
    UserProfileSchema,
    UserRegisterSchema,
)
from app.services.auth_service import (
    build_user_profile,
    create_access_token,
    get_current_user,
    get_user_by_phone,
    register_user,
    request_otp,
    verify_otp_code,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/otp/request")
def request_otp_endpoint(payload: OtpRequestSchema, db: Session = Depends(get_db)):
    """
    Step 1: Request 6-digit OTP for mobile verification.
    """
    code = request_otp(payload.phone_e164, db)
    return {
        "status": "success",
        "message": f"Verification code sent to {payload.phone_e164}",
        "dev_code": code,  # Provided for seamless local testing
    }


@router.post("/otp/verify")
def verify_otp_endpoint(payload: OtpVerifySchema, db: Session = Depends(get_db)):
    """
    Step 2: Verify OTP. Returns JWT and user profile if existing,
    or signals that registration is required.
    """
    is_valid = verify_otp_code(payload.phone_e164, payload.otp_code, db)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification code",
        )

    user = get_user_by_phone(payload.phone_e164, db)
    if not user:
        return {
            "status": "needs_registration",
            "phone_e164": payload.phone_e164,
            "message": "User not registered. Please complete registration.",
        }

    profile = build_user_profile(user, db)
    token = create_access_token({
        "sub": str(user.id),
        "phone": user.phone_e164,
        "role": profile["role"],
    })

    return {
        "status": "success",
        "access_token": token,
        "token_type": "bearer",
        "user": profile,
    }


@router.post("/register", response_model=TokenResponseSchema)
def register_endpoint(payload: UserRegisterSchema, db: Session = Depends(get_db)):
    """
    Step 3: Register user account. If patient signs up with referral_code,
    locks attribution to the referring agent.
    """
    try:
        token, profile = register_user(
            phone_e164=payload.phone_e164,
            full_name=payload.full_name,
            role=payload.role,
            email=payload.email,
            referral_code=payload.referral_code,
            db=db,
        )
        return TokenResponseSchema(access_token=token, user=UserProfileSchema(**profile))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/me", response_model=UserProfileSchema)
def get_me_endpoint(current_user: dict = Depends(get_current_user)):
    """
    Returns current authenticated user profile.
    """
    return UserProfileSchema(**current_user)
