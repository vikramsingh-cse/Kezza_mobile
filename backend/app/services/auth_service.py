import base64
import hashlib
import hmac
import json
import math
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import APP_ENV, DEV_OTP_CODE, JWT_SECRET
from app.models.agent import Agent
from app.models.otp import OtpRequest
from app.models.patient import Patient
from app.models.referral import Referral
from app.models.user import User

JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 30  # 30 days token

security = HTTPBearer(auto_error=False)

OTP_LIFETIME = timedelta(minutes=10)
OTP_RESEND_COOLDOWN = timedelta(seconds=60)
OTP_REQUEST_WINDOW = timedelta(minutes=15)
OTP_MAX_REQUESTS_PER_WINDOW = 5


class OtpRequestRateLimited(Exception):
    def __init__(self, retry_after_seconds: int):
        super().__init__("Too many verification codes requested. Please try again shortly.")
        self.retry_after_seconds = max(1, retry_after_seconds)


# ---------------------------------------------------------------------------
# Lightweight HMAC-SHA256 JWT implementation (0 external dependencies)
# ---------------------------------------------------------------------------

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64url_decode(s: str) -> bytes:
    padding = "=" * ((4 - len(s) % 4) % 4)
    return base64.b64decode(
        (s + padding).encode("ascii"),
        altchars=b"-_",
        validate=True,
    )


def _otp_digest(phone_e164: str, code: str) -> str:
    """Return a server-keyed, fixed-length digest that fits the existing column."""
    key = hashlib.sha256(b"kezza-otp-storage\0" + JWT_SECRET.encode("utf-8")).digest()
    message = f"{phone_e164}\0{code}".encode("utf-8")
    return _b64url_encode(hmac.new(key, message, hashlib.sha256).digest())[:10]


def _as_utc(value: datetime) -> datetime:
    # SQLite drops timezone information for DateTime(timezone=True) values.
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


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

    header = json.loads(_b64url_decode(parts[0]).decode("utf-8"))
    if (
        not isinstance(header, dict)
        or header.get("alg") != JWT_ALGORITHM
        or header.get("typ") != "JWT"
    ):
        raise ValueError("Invalid JWT header")

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
    if not isinstance(payload, dict) or not isinstance(payload.get("sub"), str):
        raise ValueError("Invalid JWT claims")
    expires_at = payload.get("exp")
    if (
        isinstance(expires_at, bool)
        or not isinstance(expires_at, (int, float))
        or not math.isfinite(expires_at)
    ):
        raise ValueError("JWT expiration is required")
    if expires_at <= time.time():
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
    if APP_ENV not in {"development", "test"}:
        raise RuntimeError("OTP delivery is unavailable: configure a production OTP provider")

    now = datetime.now(timezone.utc)
    request_times = list(db.execute(
        select(OtpRequest.created_at, OtpRequest.is_verified)
        .where(
            OtpRequest.phone_e164 == phone_e164,
            OtpRequest.created_at >= now - OTP_REQUEST_WINDOW,
        )
        .order_by(OtpRequest.created_at.asc(), OtpRequest.id.asc())
    ))
    if request_times:
        most_recent, was_verified = request_times[-1]
        cooldown_remaining = 0
        if not was_verified:
            cooldown_remaining = math.ceil(
                (_as_utc(most_recent) + OTP_RESEND_COOLDOWN - now).total_seconds()
            )
        if cooldown_remaining > 0:
            raise OtpRequestRateLimited(cooldown_remaining)
        if len(request_times) >= OTP_MAX_REQUESTS_PER_WINDOW:
            window_remaining = math.ceil(
                (_as_utc(request_times[0]) + OTP_REQUEST_WINDOW - now).total_seconds()
            )
            raise OtpRequestRateLimited(window_remaining)

    code = DEV_OTP_CODE
    expires_at = now + OTP_LIFETIME

    otp_record = OtpRequest(
        phone_e164=phone_e164,
        otp_code=_otp_digest(phone_e164, code),
        expires_at=expires_at,
        is_verified=False,
    )
    db.add(otp_record)
    db.commit()
    return code


def verify_otp_code(phone_e164: str, otp_code: str, db: Session) -> bool:
    """
    Verifies that the OTP code matches for the given phone number.
    The fixed development code is only valid against a fresh request record.
    """
    stmt = (
        select(OtpRequest)
        .where(
            OtpRequest.phone_e164 == phone_e164,
        )
        .order_by(OtpRequest.created_at.desc(), OtpRequest.id.desc())
        .limit(1)
        .with_for_update()
    )
    record = db.scalars(stmt).first()
    candidate_digest = _otp_digest(phone_e164, otp_code)
    if (
        record
        and not record.is_verified
        and _as_utc(record.expires_at) > datetime.now(timezone.utc)
        and hmac.compare_digest(record.otp_code, candidate_digest)
    ):
        record.is_verified = True
        db.commit()
        return True
    return False


def has_verified_otp(phone_e164: str, db: Session) -> bool:
    """Only the latest challenge can authorize registration."""
    stmt = (
        select(OtpRequest)
        .where(OtpRequest.phone_e164 == phone_e164)
        .order_by(OtpRequest.created_at.desc(), OtpRequest.id.desc())
        .limit(1)
    )
    record = db.scalars(stmt).first()
    return bool(
        record
        and record.is_verified
        and _as_utc(record.expires_at) > datetime.now(timezone.utc)
    )


def get_user_by_phone(phone_e164: str, db: Session) -> User | None:
    return db.scalars(select(User).where(User.phone_e164 == phone_e164)).first()


def build_user_profile(user: User, db: Session) -> dict:
    """
    Determines whether the user is an agent or patient and returns full profile.
    """
    agent = db.scalars(select(Agent).where(Agent.user_id == user.id)).first()
    patient = db.scalars(select(Patient).where(Patient.user_id == user.id)).first()

    role = user.role
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
    Patient attribution comes from the referral code or an existing phone-matched lead.
    """
    user = get_user_by_phone(phone_e164, db)
    if not user:
        user = User(
            phone_e164=phone_e164,
            full_name=full_name,
            email=email,
            role=role,
            is_active=True,
        )
        db.add(user)
        db.flush()

    if role == "agent":
        agent = db.scalars(select(Agent).where(Agent.user_id == user.id)).first()
        if not agent:
            sponsor_agent_id = None
            if referral_code:
                cleaned_code = referral_code.strip().upper()
                sponsor = db.scalars(
                    select(Agent).where(Agent.agent_code == cleaned_code)
                ).first()
                if not sponsor:
                    raise ValueError("Referral code is invalid")
                sponsor_agent_id = sponsor.id

            # Generate unique agent code (e.g. AGT-847291)
            code_suffix = secrets.token_hex(3).upper()
            code = f"AGT-{code_suffix}"
            agent = Agent(
                user_id=user.id,
                agent_code=code,
                sponsor_agent_id=sponsor_agent_id,
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

        # Lock attribution to an existing phone-matched lead when one exists.
        existing_ref = db.scalars(
            select(Referral)
            .where(Referral.patient_phone_e164 == phone_e164)
            .with_for_update()
        ).first()
        referring_agent = None
        if referral_code:
            referral_code_clean = referral_code.strip().upper()
            referring_agent = db.scalars(
                select(Agent).where(Agent.agent_code == referral_code_clean)
            ).first()
            if not referring_agent:
                raise ValueError("Referral code is invalid")

        if existing_ref:
            if existing_ref.patient_user_id not in (None, user.id):
                raise ValueError("Referral attribution is already linked to another account")
            if (
                referring_agent
                and existing_ref.referring_agent_id != referring_agent.id
            ):
                raise ValueError("Referral attribution is already locked to a different agent")
            existing_ref.patient_user_id = user.id
            existing_ref.patient_name = full_name
            existing_ref.status = "registered"
        elif referring_agent:
            db.add(
                Referral(
                    patient_user_id=user.id,
                    patient_name=full_name,
                    patient_phone_e164=phone_e164,
                    referring_agent_id=referring_agent.id,
                    status="registered",
                )
            )
        if existing_ref or referring_agent:
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
        if not user or not user.is_active:
            raise ValueError()
        return build_user_profile(user, db)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
        )


def get_current_admin(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Require a provisioned, active administrator account."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required",
        )
    return current_user
