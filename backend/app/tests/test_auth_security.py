"""Authentication API checks runnable with Python's standard unittest runner."""

import os
import unittest
import uuid
from datetime import datetime, timedelta, timezone

os.environ["APP_ENV"] = "test"
os.environ["JWT_SECRET"] = "test-auth-secret-that-is-long-enough-for-hmac"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["PAYMENT_VERIFICATION_API_KEY"] = "test-only-payment-key-for-automated-journey"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.base import Base
from app.config import DEV_OTP_CODE
from app.database import get_db
from app.main import app as fastapi_app
import app.models  # noqa: F401
from app.models.otp import OtpRequest
from app.models.user import User
from app.services.auth_service import (
    _otp_digest,
    create_access_token,
    decode_access_token,
    verify_otp_code,
)


test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
)
TestSession = sessionmaker(
    bind=test_engine,
    autoflush=False,
    expire_on_commit=False,
)
Base.metadata.create_all(bind=test_engine)


class AuthenticationSecurityTests(unittest.TestCase):
    def setUp(self):
        self.connection = test_engine.connect()
        self.transaction = self.connection.begin()
        self.db = TestSession(bind=self.connection)

        def override_get_db():
            yield self.db

        fastapi_app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(fastapi_app)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        fastapi_app.dependency_overrides.clear()
        self.db.close()
        self.transaction.rollback()
        self.connection.close()

    def test_otp_is_not_stored_as_plaintext_and_is_single_use(self):
        phone = "+27821234567"
        request = self.client.post("/api/v1/auth/otp/request", json={"phone_e164": phone})
        self.assertEqual(request.status_code, 200)
        self.assertNotIn("dev_code", request.json())
        code = DEV_OTP_CODE

        record = self.db.scalars(
            select(OtpRequest).where(OtpRequest.phone_e164 == phone)
        ).first()
        self.assertIsNotNone(record)
        self.assertNotEqual(record.otp_code, code)
        self.assertEqual(len(record.otp_code), 10)

        verified = self.client.post(
            "/api/v1/auth/otp/verify",
            json={"phone_e164": phone, "otp_code": code},
        )
        self.assertEqual(verified.status_code, 200)
        self.assertEqual(verified.json()["status"], "needs_registration")

        replay = self.client.post(
            "/api/v1/auth/otp/verify",
            json={"phone_e164": phone, "otp_code": code},
        )
        self.assertEqual(replay.status_code, 400)

    def test_otp_request_is_rate_limited_during_resend_cooldown(self):
        phone = "+27821234568"
        first = self.client.post("/api/v1/auth/otp/request", json={"phone_e164": phone})
        second = self.client.post("/api/v1/auth/otp/request", json={"phone_e164": phone})

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 429)
        self.assertEqual(second.headers.get("retry-after"), "60")

    def test_only_the_latest_otp_challenge_can_be_verified(self):
        phone = "+27821234571"
        self.client.post("/api/v1/auth/otp/request", json={"phone_e164": phone})
        newer_verified_challenge = OtpRequest(
            phone_e164=phone,
            otp_code=_otp_digest(phone, "654321"),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
            is_verified=True,
            created_at=datetime.now(timezone.utc) + timedelta(seconds=1),
        )
        self.db.add(newer_verified_challenge)
        self.db.commit()

        self.assertFalse(verify_otp_code(phone, "123456", self.db))

    def test_registration_requires_verified_otp_and_rejects_duplicate_account(self):
        phone = "+27821234569"
        payload = {"phone_e164": phone, "full_name": "Kezza Patient", "role": "patient"}
        unauthorized = self.client.post("/api/v1/auth/register", json=payload)
        self.assertEqual(unauthorized.status_code, 401)

        otp_request = self.client.post("/api/v1/auth/otp/request", json={"phone_e164": phone})
        code = DEV_OTP_CODE
        verification = self.client.post(
            "/api/v1/auth/otp/verify",
            json={"phone_e164": phone, "otp_code": code},
        )
        self.assertEqual(verification.status_code, 200)

        registration = self.client.post("/api/v1/auth/register", json=payload)
        self.assertEqual(registration.status_code, 200, registration.text)
        duplicate = self.client.post("/api/v1/auth/register", json=payload)
        self.assertEqual(duplicate.status_code, 409)

    def test_complete_referral_to_reward_journey_still_works(self):
        from test_journey import test_complete_kezza_journey

        test_complete_kezza_journey(self.client)

    def test_inactive_account_cannot_use_an_access_token(self):
        user = User(
            id=uuid.uuid4(),
            phone_e164="+27821234570",
            full_name="Inactive User",
            is_active=False,
        )
        self.db.add(user)
        self.db.commit()
        token = create_access_token({"sub": str(user.id)})

        response = self.client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(response.status_code, 401)

        otp_request = self.client.post(
            "/api/v1/auth/otp/request",
            json={"phone_e164": user.phone_e164},
        )
        self.assertEqual(otp_request.status_code, 200)
        otp_login = self.client.post(
            "/api/v1/auth/otp/verify",
            json={"phone_e164": user.phone_e164, "otp_code": DEV_OTP_CODE},
        )
        self.assertEqual(otp_login.status_code, 403)

    def test_jwt_requires_expiration_and_rejects_expired_token(self):
        expired = create_access_token({"sub": str(uuid.uuid4()), "exp": 0})
        with self.assertRaises(ValueError):
            decode_access_token(expired)

        # A correctly signed payload without exp must still fail closed.
        import base64
        import hashlib
        import hmac
        import json

        from app.config import JWT_SECRET

        encode = lambda value: base64.urlsafe_b64encode(value).decode().rstrip("=")
        header = encode(b'{"alg":"HS256","typ":"JWT"}')
        payload = encode(json.dumps({"sub": str(uuid.uuid4())}).encode())
        unsigned = f"{header}.{payload}"
        signature = encode(hmac.new(JWT_SECRET.encode(), unsigned.encode(), hashlib.sha256).digest())
        with self.assertRaises(ValueError):
            decode_access_token(f"{unsigned}.{signature}")


if __name__ == "__main__":
    unittest.main()
