import base64
import hashlib
import hmac
import json
import os
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.agent import Agent
from app.models.otp import OtpRequest
from app.models.patient import Patient
from app.models.referral import Referral
from app.models.user import User

JWT_SECRET = os.getenv("JWT_SECRET", "kezza_super_secret_jwt_key_2026")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 30  # 30 days token

security = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Lightweight HMAC-SHA256 JWT implementation (0 external dependencies)
# ---------------------------------------------------------------------------

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64url_decode(s: str) -> bytes:
    padding = 4 - (len(s) % 4)
    if padding != 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s.encode("utf-8"))


def create_access_token(payload: dict) -> str:
    header = {"alg": JWT_ALGORITHM, "typ": "JWT"}
    header_json = json.dumps(header, separators=(",", ":")).encode("utf-8")
    payload_copy = payload.copy()
    if "exp" not in payload_copy:
        payload_copy["exp"] = int(time.time()) + (JWT_EXPIRATION_HOURS * 3600)
    payload_json = json.dumps(payload_copy, separators=(",", ":")).encode("utf-8")

    unsigned_token = f"{_b64url_encode(header_json)}.{_b64url_encode(payload_json)}"
    signature = hmac.new(
        JWT_SECRET.encode("utf-8"),
        unsigned_token.encode("utf-8"),
        hashlib.sha256,
    ).digest()

    return f"{unsigned_token}.{_b64url_encode(signature)}"


def decode_access_token(token: str) -> dict:
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Invalid JWT format")

    unsigned_token = f"{parts[0]}.{parts[1]}"
    expected_sig = hmac.new(
        JWT_SECRET.encode("utf-8"),
        unsigned_token.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    actual_sig = _b64url_decode(parts[2])

    if not hmac.compare_digest(expected_sig, actual_sig):
        raise ValueError("Invalid token signature")

    payload_bytes = _b64url_decode(parts[1])
    payload = json.loads(payload_bytes.decode("utf-8"))

    if "exp" in payload and payload["exp"] < time.time():
        raise ValueError("Token has expired")

    return payload


# ---------------------------------------------------------------------------
# OTP & Authentication Services
# ---------------------------------------------------------------------------

def request_otp(phone_e164: str, db: Session) -> str:
    """
    Creates an OTP record for the phone number.
    In development/testing, standard mock code '123456' is generated.
    """
    code = "123456"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    otp_record = OtpRequest(
        phone_e164=phone_e164,
        otp_code=code,
        expires_at=expires_at,
        is_verified=False,
    )
    db.add(otp_record)
    db.commit()
    return code


def verify_otp_code(phone_e164: str, otp_code: str, db: Session) -> bool:
    """
    Verifies that the OTP code matches for the given phone number.
    Accepts '123456' as standard test code or valid active OTP record.
    """
    if otp_code == "123456":
        return True

    stmt = (
        select(OtpRequest)
        .where(
            OtpRequest.phone_e164 == phone_e164,
            OtpRequest.otp_code == otp_code,
            OtpRequest.is_verified.is_(False),
            OtpRequest.expires_at > datetime.now(timezone.utc),
        )
        .order_by(OtpRequest.created_at.desc())
    )
    record = db.scalars(stmt).first()
    if record:
        record.is_verified = True
        db.commit()
        return True
    return False


def get_user_by_phone(phone_e164: str, db: Session) -> User | None:
    return db.scalars(select(User).where(User.phone_e164 == phone_e164)).first()


def build_user_profile(user: User, db: Session) -> dict:
    """
    Determines whether the user is an agent or patient and returns full profile.
    """
    agent = db.scalars(select(Agent).where(Agent.user_id == user.id)).first()
    patient = db.scalars(select(Patient).where(Patient.user_id == user.id)).first()

    role = "agent" if agent else "patient"
    agent_code = agent.agent_code if agent else None

    return {
        "id": str(user.id),
        "phone_e164": user.phone_e164,
        "full_name": user.full_name,
        "email": user.email,
        "role": role,
        "agent_code": agent_code,
        "patient_id": str(patient.id) if patient else None,
        "agent_id": str(agent.id) if agent else None,
        "is_active": user.is_active,
    }


def register_user(
    phone_e164: str,
    full_name: str,
    role: str,
    email: str | None,
    referral_code: str | None,
    db: Session,
) -> tuple[str, dict]:
    """
    Registers a new user as Patient or Agent.
    If Patient registers with a referral_code, links and locks referral attribution!
    """
    user = get_user_by_phone(phone_e164, db)
    if not user:
        user = User(
            phone_e164=phone_e164,
            full_name=full_name,
            email=email,
            is_active=True,
        )
        db.add(user)
        db.flush()

    if role == "agent":
        agent = db.scalars(select(Agent).where(Agent.user_id == user.id)).first()
        if not agent:
            # Generate unique agent code (e.g. AGT-847291)
            code_suffix = secrets.token_hex(3).upper()
            code = f"AGT-{code_suffix}"
            agent = Agent(
                user_id=user.id,
                agent_code=code,
                status="active",
            )
            db.add(agent)
            db.flush()
    else:
        # Patient
        patient = db.scalars(select(Patient).where(Patient.user_id == user.id)).first()
        if not patient:
            patient = Patient(user_id=user.id)
            db.add(patient)
            db.flush()

        # Check referral attribution locking
        if referral_code:
            referral_code_clean = referral_code.strip().upper()
            referring_agent = db.scalars(
                select(Agent).where(Agent.agent_code == referral_code_clean)
            ).first()

            if referring_agent:
                # Check if lead already exists for this phone
                existing_ref = db.scalars(
                    select(Referral).where(
                        Referral.patient_phone_e164 == phone_e164
                    )
                ).first()

                if existing_ref:
                    existing_ref.patient_user_id = user.id
                    existing_ref.status = "registered"
                else:
                    new_ref = Referral(
                        patient_user_id=user.id,
                        patient_name=full_name,
                        patient_phone_e164=phone_e164,
                        referring_agent_id=referring_agent.id,
                        status="registered",
                    )
                    db.add(new_ref)
                db.flush()

    db.commit()
    db.refresh(user)

    profile = build_user_profile(user, db)
    token = create_access_token({
        "sub": str(user.id),
        "phone": user.phone_e164,
        "role": profile["role"],
    })

    return token, profile


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> dict:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required",
        )

    try:
        payload = decode_access_token(credentials.credentials)
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError()
        user = db.get(User, uuid.UUID(user_id))
        if not user:
            raise ValueError()
        return build_user_profile(user, db)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
        )
