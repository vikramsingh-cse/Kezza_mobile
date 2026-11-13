import os
import secrets
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")
load_dotenv(BACKEND_DIR.parent / ".env")

# Default closed: production behavior is used unless local/test mode is explicit.
APP_ENV = os.getenv("APP_ENV", "production").strip().lower()

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    if APP_ENV in {"development", "test"}:
        JWT_SECRET = secrets.token_urlsafe(48)
    else:
        raise RuntimeError("JWT_SECRET must be configured outside development and test environments")

DEV_OTP_CODE = os.getenv("DEV_OTP_CODE", "123456")
PAYMENT_VERIFICATION_API_KEY = os.getenv("PAYMENT_VERIFICATION_API_KEY")

if APP_ENV in {"development", "test"} and (
    len(DEV_OTP_CODE) != 6 or not DEV_OTP_CODE.isdigit()
):
    raise RuntimeError("DEV_OTP_CODE must contain exactly six digits")

if APP_ENV not in {"development", "test"} and PAYMENT_VERIFICATION_API_KEY:
    if len(PAYMENT_VERIFICATION_API_KEY) < 32:
        raise RuntimeError("PAYMENT_VERIFICATION_API_KEY must be at least 32 characters")

if APP_ENV not in {"development", "test"} and len(JWT_SECRET) < 32:
    raise RuntimeError("JWT_SECRET must be at least 32 characters")
