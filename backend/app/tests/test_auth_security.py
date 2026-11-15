"""Authentication API checks runnable with Python's standard unittest runner."""

import os
import unittest
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

os.environ["APP_ENV"] = "test"
os.environ["JWT_SECRET"] = "test-auth-secret-that-is-long-enough-for-hmac"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["PAYMENT_VERIFICATION_API_KEY"] = "test-only-payment-key-for-automated-journey"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app.base import Base
from app.config import DEV_OTP_CODE
from app.database import get_db
from app.main import app as fastapi_app
import app.models  # noqa: F401
from app.models.otp import OtpRequest
from app.models.agent import Agent
from app.models.patient import Patient
from app.models.points import PointsLedger
from app.models.referral import Referral
from app.models.commission import CommissionTier
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
        if self.transaction.is_active:
            self.transaction.rollback()
        self.connection.close()

    def test_authentication_accepts_only_indian_ten_digit_mobile_numbers(self):
        for phone in (
            "+27821234567",
            "+915123456789",
            "+91912345678",
            "+9191234567890",
        ):
            with self.subTest(phone=phone):
                response = self.client.post(
                    "/api/v1/auth/otp/request",
                    json={"phone_e164": phone},
                )
                self.assertEqual(response.status_code, 422)

        valid = self.client.post(
            "/api/v1/auth/otp/request",
            json={"phone_e164": "+919876543210"},
        )
        self.assertEqual(valid.status_code, 200, valid.text)

    def test_otp_is_not_stored_as_plaintext_and_is_single_use(self):
        phone = "+919821234567"
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
        phone = "+919821234568"
        first = self.client.post("/api/v1/auth/otp/request", json={"phone_e164": phone})
        second = self.client.post("/api/v1/auth/otp/request", json={"phone_e164": phone})

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 429)
        self.assertEqual(second.headers.get("retry-after"), "60")

    def test_only_the_latest_otp_challenge_can_be_verified(self):
        phone = "+919821234571"
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
        phone = "+919821234569"
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

    def test_existing_agent_can_sign_in_with_verified_otp(self):
        user = User(
            phone_e164="+919821110021",
            full_name="Existing Agent",
            role="agent",
        )
        self.db.add(user)
        self.db.flush()
        agent = Agent(user_id=user.id, agent_code="AGT-LOGIN21", status="active")
        self.db.add(agent)
        self.db.commit()

        requested = self.client.post(
            "/api/v1/auth/otp/request",
            json={"phone_e164": user.phone_e164},
        )
        self.assertEqual(requested.status_code, 200)
        verified = self.client.post(
            "/api/v1/auth/otp/verify",
            json={"phone_e164": user.phone_e164, "otp_code": DEV_OTP_CODE},
        )

        self.assertEqual(verified.status_code, 200, verified.text)
        self.assertEqual(verified.json()["user"]["role"], "agent")
        self.assertEqual(verified.json()["user"]["agent_id"], str(agent.id))
        self.assertEqual(verified.json()["user"]["agent_code"], agent.agent_code)

    def test_verified_otp_allows_immediate_retry_after_role_selection_error(self):
        phone = "+919821110022"
        requested = self.client.post(
            "/api/v1/auth/otp/request",
            json={"phone_e164": phone},
        )
        self.assertEqual(requested.status_code, 200)
        verified = self.client.post(
            "/api/v1/auth/otp/verify",
            json={"phone_e164": phone, "otp_code": DEV_OTP_CODE},
        )
        self.assertEqual(verified.json()["status"], "needs_registration")

        retry = self.client.post(
            "/api/v1/auth/otp/request",
            json={"phone_e164": phone},
        )
        self.assertEqual(retry.status_code, 200, retry.text)

    def test_patient_registration_links_existing_lead_by_phone_without_code(self):
        agent_user = User(
            phone_e164="+919821110023",
            full_name="Referring Agent",
            role="agent",
        )
        patient_phone = "+919821110024"
        self.db.add(agent_user)
        self.db.flush()
        agent = Agent(user_id=agent_user.id, agent_code="AGT-LEAD24", status="active")
        self.db.add(agent)
        self.db.flush()
        lead = Referral(
            patient_name="New Patient",
            patient_phone_e164=patient_phone,
            referring_agent_id=agent.id,
            status="registered",
        )
        self.db.add(lead)
        self.db.commit()

        self.client.post("/api/v1/auth/otp/request", json={"phone_e164": patient_phone})
        self.client.post(
            "/api/v1/auth/otp/verify",
            json={"phone_e164": patient_phone, "otp_code": DEV_OTP_CODE},
        )
        registered = self.client.post(
            "/api/v1/auth/register",
            json={"phone_e164": patient_phone, "full_name": "New Patient", "role": "patient"},
        )

        self.assertEqual(registered.status_code, 200, registered.text)
        self.db.refresh(lead)
        self.assertEqual(lead.patient_user_id, uuid.UUID(registered.json()["user"]["id"]))
        self.assertEqual(lead.referring_agent_id, agent.id)

    def test_patient_registration_cannot_override_locked_agent_attribution(self):
        agent_users = [
            User(phone_e164=f"+91982111002{index}", full_name=f"Agent {index}", role="agent")
            for index in (5, 6)
        ]
        self.db.add_all(agent_users)
        self.db.flush()
        locked_agent = Agent(user_id=agent_users[0].id, agent_code="AGT-LOCKED", status="active")
        other_agent = Agent(user_id=agent_users[1].id, agent_code="AGT-OTHER", status="active")
        self.db.add_all([locked_agent, other_agent])
        self.db.flush()
        patient_phone = "+919821110027"
        lead = Referral(
            patient_name="Locked Patient",
            patient_phone_e164=patient_phone,
            referring_agent_id=locked_agent.id,
            status="registered",
        )
        self.db.add(lead)
        self.db.commit()

        self.client.post("/api/v1/auth/otp/request", json={"phone_e164": patient_phone})
        self.client.post(
            "/api/v1/auth/otp/verify",
            json={"phone_e164": patient_phone, "otp_code": DEV_OTP_CODE},
        )
        registered = self.client.post(
            "/api/v1/auth/register",
            json={
                "phone_e164": patient_phone,
                "full_name": "Locked Patient",
                "role": "patient",
                "referral_code": other_agent.agent_code,
            },
        )

        self.assertEqual(registered.status_code, 400)
        self.assertIn("locked to a different agent", registered.json()["detail"])
        self.assertIsNone(self.db.scalar(select(User).where(User.phone_e164 == patient_phone)))

    def test_complete_referral_to_reward_journey_still_works(self):
        from test_journey import test_complete_kezza_journey

        test_complete_kezza_journey(self.client, self.db)

    def test_admin_points_grant_is_server_calculated_and_audited(self):
        admin = User(
            phone_e164="+919824440001",
            full_name="Admin User",
            role="admin",
        )
        patient_user = User(
            phone_e164="+919824440002",
            full_name="Reward Patient",
            role="patient",
        )
        self.db.add_all([admin, patient_user])
        self.db.flush()
        patient = Patient(user_id=patient_user.id)
        self.db.add(patient)
        self.db.commit()

        admin_token = create_access_token({"sub": str(admin.id)})
        patient_token = create_access_token({"sub": str(patient_user.id)})
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        patient_headers = {"Authorization": f"Bearer {patient_token}"}

        search = self.client.get(
            "/api/v1/admin/patients/search",
            params={"query": "Reward"},
            headers=admin_headers,
        )
        self.assertEqual(search.status_code, 200)
        self.assertEqual(search.json()[0]["patient_id"], str(patient.id))

        grant = self.client.post(
            f"/api/v1/admin/patients/{patient.id}/points",
            headers=admin_headers,
            json={"points": 250, "reason": "Clinic service recovery"},
        )
        self.assertEqual(grant.status_code, 200, grant.text)
        self.assertEqual(grant.json()["total_points"], 250)
        self.assertEqual(grant.json()["credit_minor_units"], 1_000)

        wallet = self.client.get("/api/v1/wallet/patient", headers=patient_headers)
        self.assertEqual(wallet.status_code, 200)
        self.assertEqual(wallet.json()["total_points"], 250)
        entry = self.db.scalar(
            select(PointsLedger).where(
                PointsLedger.id == uuid.UUID(grant.json()["ledger_id"])
            )
        )
        self.assertIsNotNone(entry)
        self.assertEqual(entry.event_type, "manual_adjustment")
        self.assertEqual(entry.created_by_user_id, admin.id)
        self.assertIn("Clinic service recovery", entry.description)

        denied = self.client.get(
            "/api/v1/admin/patients/search",
            params={"query": "Reward"},
            headers=patient_headers,
        )
        self.assertEqual(denied.status_code, 403)

    def test_admin_role_cannot_be_selected_during_public_registration(self):
        response = self.client.post(
            "/api/v1/auth/register",
            json={
                "phone_e164": "+919825550001",
                "full_name": "Self Appointed Admin",
                "role": "admin",
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_commission_tiers_use_eligible_direct_agents(self):
        from app.services.payment_service import _commission_tier

        sponsor_user = User(
            phone_e164="+919100000000",
            full_name="Tier Sponsor",
            is_active=True,
        )
        self.db.add(sponsor_user)
        self.db.flush()
        sponsor = Agent(
            user_id=sponsor_user.id,
            agent_code="TIER-SPONSOR",
            status="active",
        )
        self.db.add(sponsor)
        self.db.flush()

        direct_agents = []
        for index in range(1, 11):
            user = User(
                phone_e164=f"+9192000000{index:02d}",
                full_name=f"Direct Agent {index}",
                is_active=True,
            )
            self.db.add(user)
            self.db.flush()
            direct_agent = Agent(
                user_id=user.id,
                agent_code=f"TIER-DIRECT-{index}",
                sponsor_agent_id=sponsor.id,
                status="inactive",
            )
            self.db.add(direct_agent)
            direct_agents.append(direct_agent)

        self.db.add_all(
            [
                CommissionTier(
                    name="Base (1%)",
                    min_eligible_direct_agents=0,
                    commission_percent=Decimal("1.0000"),
                    is_active=True,
                ),
                CommissionTier(
                    name="Growth (2%)",
                    min_eligible_direct_agents=4,
                    commission_percent=Decimal("2.0000"),
                    is_active=True,
                ),
                CommissionTier(
                    name="Network (3%)",
                    min_eligible_direct_agents=10,
                    commission_percent=Decimal("3.0000"),
                    is_active=True,
                ),
            ]
        )
        self.db.flush()

        self.assertEqual(
            _commission_tier(sponsor.id, self.db),
            ("Base (1%)", Decimal("1.0000"), 0),
        )
        for direct_agent in direct_agents[:3]:
            direct_agent.status = "active"
        self.db.flush()
        self.assertEqual(_commission_tier(sponsor.id, self.db)[1:], (Decimal("1.0000"), 3))

        direct_agents[3].status = "active"
        self.db.flush()
        self.assertEqual(_commission_tier(sponsor.id, self.db)[1:], (Decimal("2.0000"), 4))

        for direct_agent in direct_agents[4:9]:
            direct_agent.status = "active"
        self.db.flush()
        self.assertEqual(_commission_tier(sponsor.id, self.db)[1:], (Decimal("2.0000"), 9))

        direct_agents[9].status = "active"
        self.db.flush()
        self.assertEqual(_commission_tier(sponsor.id, self.db)[1:], (Decimal("3.0000"), 10))

        network_tier = self.db.scalars(
            select(CommissionTier).where(CommissionTier.min_eligible_direct_agents == 10)
        ).one()
        network_tier.commission_percent = Decimal("10.0000")
        self.db.flush()
        self.assertEqual(_commission_tier(sponsor.id, self.db)[1], Decimal("10.0000"))

    def test_commission_tier_rejects_rates_above_ten_percent(self):
        self.db.add(
            CommissionTier(
                name="Invalid tier",
                min_eligible_direct_agents=0,
                commission_percent=Decimal("10.0001"),
                is_active=True,
            )
        )
        with self.assertRaises(IntegrityError):
            self.db.flush()
        self.db.rollback()

    def test_agent_registration_locks_sponsor_attribution(self):
        def register_agent(phone: str, referral_code: str | None = None):
            requested = self.client.post(
                "/api/v1/auth/otp/request",
                json={"phone_e164": phone},
            )
            self.assertEqual(requested.status_code, 200)
            verified = self.client.post(
                "/api/v1/auth/otp/verify",
                json={"phone_e164": phone, "otp_code": DEV_OTP_CODE},
            )
            self.assertEqual(verified.status_code, 200)
            payload = {
                "phone_e164": phone,
                "full_name": "Network Agent",
                "role": "agent",
            }
            if referral_code:
                payload["referral_code"] = referral_code
            return self.client.post("/api/v1/auth/register", json=payload)

        sponsor_response = register_agent("+919821110011")
        self.assertEqual(sponsor_response.status_code, 200, sponsor_response.text)
        sponsor_profile = sponsor_response.json()["user"]

        recruit_response = register_agent(
            "+919821110012",
            referral_code=sponsor_profile["agent_code"],
        )
        self.assertEqual(recruit_response.status_code, 200, recruit_response.text)
        recruit_profile = recruit_response.json()["user"]
        recruited_agent = self.db.get(Agent, uuid.UUID(recruit_profile["agent_id"]))

        self.assertIsNotNone(recruited_agent)
        self.assertEqual(
            recruited_agent.sponsor_agent_id,
            uuid.UUID(sponsor_profile["agent_id"]),
        )

        from app.services.payment_service import _commission_tier

        self.assertEqual(
            _commission_tier(uuid.UUID(sponsor_profile["agent_id"]), self.db)[2],
            1,
        )

    def test_inactive_account_cannot_use_an_access_token(self):
        user = User(
            id=uuid.uuid4(),
            phone_e164="+919821234570",
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
