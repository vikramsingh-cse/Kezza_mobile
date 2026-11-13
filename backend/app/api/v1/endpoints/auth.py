# pyright: reportMissingImports=false
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import APP_ENV
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
    has_verified_otp,
    OtpRequestRateLimited,
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
    try:
        code = request_otp(payload.phone_e164, db)
    except OtpRequestRateLimited as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(exc),
            headers={"Retry-After": str(exc.retry_after_seconds)},
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))

    response = {
        "status": "success",
        "message": f"Verification code sent to {payload.phone_e164}",
    }
    if APP_ENV == "development":
        response["dev_code"] = code
    return response


@router.post("/otp/verify")
def verify_otp_endpoint(payload: OtpVerifySchema, db: Session = Depends(get_db)):
    """
    Step 2: Verify OTP. Returns JWT and user profile if existing,
    or signals that registration is required.
    """
    try:
        is_valid = verify_otp_code(payload.phone_e164, payload.otp_code, db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

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
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is inactive. Contact Kezza support.",
        )

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
    if not has_verified_otp(payload.phone_e164, db):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Verify the mobile number before completing registration",
        )
    if get_user_by_phone(payload.phone_e164, db):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This mobile number already has an account. Verify the number to sign in.",
        )

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
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This mobile number already has an account. Verify the number to sign in.",
        )


@router.get("/me", response_model=UserProfileSchema)
def get_me_endpoint(current_user: dict = Depends(get_current_user)):
    """
    Returns current authenticated user profile.
    """
    return UserProfileSchema(**current_user)
