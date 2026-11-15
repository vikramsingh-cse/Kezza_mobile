"""
End-to-End MVP Journey Test:
Tests the complete 7-step business flow from agent referral to reward & commission:
1. Agent generates a referral link
2. Patient registers with the referral link
3. Referral attribution is locked
4. Patient purchases a treatment
5. Patient receives points rewards in ledger
6. Agent receives commission in ledger
7. Both see their results (Patient sees credit; Agent sees commission & conversion)
"""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User


def test_complete_kezza_journey(client: TestClient, db_session: Session):
    # =========================================================================
    # Step 1: Agent registers and gets unique referral code & link
    # =========================================================================
    agent_phone = "+919821110001"
    client.post("/api/v1/auth/otp/request", json={"phone_e164": agent_phone})
    agent_otp_res = client.post(
        "/api/v1/auth/otp/verify",
        json={"phone_e164": agent_phone, "otp_code": "123456"},
    )
    assert agent_otp_res.status_code == 200
    agent_reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "phone_e164": agent_phone,
            "full_name": "Dr. Sarah Agent",
            "role": "agent",
            "email": "sarah.agent@example.com",
        },
    )
    assert agent_reg_res.status_code == 200, agent_reg_res.text
    agent_data = agent_reg_res.json()
    agent_token = agent_data["access_token"]
    agent_code = agent_data["user"]["agent_code"]
    assert agent_code.startswith("AGT-")

    # Agent checks their referral link
    agent_auth_headers = {"Authorization": f"Bearer {agent_token}"}
    ref_code_res = client.get("/api/v1/referrals/my-code", headers=agent_auth_headers)
    assert ref_code_res.status_code == 200
    ref_info = ref_code_res.json()
    assert ref_info["agent_code"] == agent_code
    assert f"ref={agent_code}" in ref_info["referral_link"]
    assert ref_info["total_referrals"] == 0

    # =========================================================================
    # Step 2: Patient registers using agent's referral link
    # =========================================================================
    patient_phone = "+919822220002"
    client.post("/api/v1/auth/otp/request", json={"phone_e164": patient_phone})
    patient_otp_res = client.post(
        "/api/v1/auth/otp/verify",
        json={"phone_e164": patient_phone, "otp_code": "123456"},
    )
    assert patient_otp_res.status_code == 200
    patient_reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "phone_e164": patient_phone,
            "full_name": "John Doe Patient",
            "role": "patient",
            "email": "john.doe@example.com",
            "referral_code": agent_code,
        },
    )
    assert patient_reg_res.status_code == 200, patient_reg_res.text
    patient_data = patient_reg_res.json()
    patient_token = patient_data["access_token"]
    patient_id = patient_data["user"]["patient_id"]
    patient_auth_headers = {"Authorization": f"Bearer {patient_token}"}

    # =========================================================================
    # Step 3: Referral attribution is locked
    # =========================================================================
    # Check patient side: attribution is confirmed
    attr_res = client.get("/api/v1/referrals/patient-attribution", headers=patient_auth_headers)
    assert attr_res.status_code == 200
    attr_data = attr_res.json()
    assert attr_data["has_referral"] is True
    assert attr_data["referring_agent_code"] == agent_code
    assert attr_data["status"] == "registered"

    # Check agent side: referral shows up in agent's pipeline
    agent_refs_res = client.get("/api/v1/referrals", headers=agent_auth_headers)
    assert agent_refs_res.status_code == 200
    agent_refs = agent_refs_res.json()
    assert len(agent_refs) == 1
    assert agent_refs[0]["patient_name"] == "John Doe Patient"
    assert agent_refs[0]["status"] == "registered"

    # =========================================================================
    # Step 4, 5, 6: Patient purchases treatment for ₹50,000.
    # =========================================================================
    payment_payload = {
        "patient_id": patient_id,
        "treatment_name": "Premium Teeth Whitening",
        "amount_rupees": "50000.00",
        "payment_reference": "INV-2026-001",
    }
    treatment_res = client.post(
        "/api/v1/payments/verify-collected",
        headers={"X-Payment-Verification-Key": "test-only-payment-key-for-automated-journey"},
        json=payment_payload,
    )
    assert treatment_res.status_code == 200, treatment_res.text
    treatment_data = treatment_res.json()

    assert treatment_data["amount_minor_units"] == 5_000_000
    assert treatment_data["currency"] == "INR"

    # Step 5: ₹1 eligible spend = 1 point.
    assert treatment_data["points_earned"] == 50_000
    assert treatment_data["new_points_balance"] == 50_000

    # Step 6: The base tier is 1% (₹500 on this payment).
    assert treatment_data["referral_converted"] is True
    assert treatment_data["agent_commission_minor_units"] == 50_000

    # =========================================================================
    # Step 7: Both see their results!
    # =========================================================================
    # 7a. Patient sees treatment credit in wallet
    patient_wallet_res = client.get("/api/v1/wallet/patient", headers=patient_auth_headers)
    assert patient_wallet_res.status_code == 200
    wallet_data = patient_wallet_res.json()
    assert wallet_data["total_points"] == 50_000
    assert wallet_data["credit_minor_units"] == 200_000
    assert wallet_data["currency"] == "INR"
    assert len(wallet_data["ledger"]) == 1
    assert wallet_data["ledger"][0]["policy_version"] == "inr_v1"
    assert "Premium Teeth Whitening" in wallet_data["ledger"][0]["description"]

    # Payment creates a pending commission for the administrator to review.
    agent_earnings_res = client.get("/api/v1/wallet/agent", headers=agent_auth_headers)
    assert agent_earnings_res.status_code == 200
    earnings_data = agent_earnings_res.json()
    assert earnings_data["pending_minor_units"] == 50_000
    assert earnings_data["approved_minor_units"] == 0
    assert earnings_data["total_earned_minor_units"] == 0
    assert earnings_data["commission_tier"] == "Base (1%)"
    assert earnings_data["eligible_direct_agents"] == 0
    assert len(earnings_data["ledger"]) == 1
    assert earnings_data["ledger"][0]["amount_minor_units"] == 50_000
    assert earnings_data["ledger"][0]["currency"] == "INR"
    assert earnings_data["ledger"][0]["tier_name"] == "Base (1%)"
    assert earnings_data["ledger"][0]["eligible_direct_agents"] == 0
    assert earnings_data["ledger"][0]["treatment_name"] == "Premium Teeth Whitening"

    # An OTP-authenticated, provisioned admin approves the commission.
    admin_phone = "+919823330003"
    admin_user = User(
        phone_e164=admin_phone,
        full_name="Kezza Administrator",
        role="admin",
    )
    db_session.add(admin_user)
    db_session.commit()
    client.post("/api/v1/auth/otp/request", json={"phone_e164": admin_phone})
    admin_login = client.post(
        "/api/v1/auth/otp/verify",
        json={"phone_e164": admin_phone, "otp_code": "123456"},
    )
    assert admin_login.status_code == 200
    assert admin_login.json()["user"]["role"] == "admin"
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    pending_res = client.get("/api/v1/admin/commissions/pending", headers=admin_headers)
    assert pending_res.status_code == 200
    assert len(pending_res.json()) == 1
    assert pending_res.json()[0]["agent_code"] == agent_code
    approval_res = client.post(
        f"/api/v1/admin/commissions/{pending_res.json()[0]['commission_id']}/approve",
        headers=admin_headers,
    )
    assert approval_res.status_code == 200, approval_res.text
    assert approval_res.json()["status"] == "approved"
    assert approval_res.json()["approved_by_user_id"] == str(admin_user.id)

    # 7b. Agent sees approved earnings and updated referral details
    agent_earnings_res = client.get("/api/v1/wallet/agent", headers=agent_auth_headers)
    earnings_data = agent_earnings_res.json()
    assert earnings_data["pending_minor_units"] == 0
    assert earnings_data["approved_minor_units"] == 50_000
    assert earnings_data["total_earned_minor_units"] == 50_000

    # 7c. Agent sees referral status converted
    updated_refs_res = client.get("/api/v1/referrals", headers=agent_auth_headers)
    assert updated_refs_res.status_code == 200
    updated_refs = updated_refs_res.json()
    assert updated_refs[0]["status"] == "converted"
    assert updated_refs[0]["converted_at"] is not None

    # Agent checks summary stats
    updated_summary_res = client.get("/api/v1/referrals/my-code", headers=agent_auth_headers)
    assert updated_summary_res.status_code == 200
    summary = updated_summary_res.json()
    assert summary["total_referrals"] == 1
    assert summary["converted_count"] == 1

    # A repeated collection reference is rejected without duplicating rewards.
    duplicate_res = client.post(
        "/api/v1/payments/verify-collected",
        headers={"X-Payment-Verification-Key": "test-only-payment-key-for-automated-journey"},
        json=payment_payload,
    )
    assert duplicate_res.status_code == 409

    # Refunds keep the original rows and append linked point/commission reversals.
    refund_res = client.post(
        f"/api/v1/payments/{treatment_data['payment_id']}/refund",
        headers={"X-Payment-Verification-Key": "test-only-payment-key-for-automated-journey"},
        json={"reason": "Patient cancelled the treatment"},
    )
    assert refund_res.status_code == 200, refund_res.text
    assert refund_res.json()["reversed_points"] == 50_000
    assert refund_res.json()["reversed_commission_minor_units"] == 50_000

    refunded_wallet = client.get(
        "/api/v1/wallet/patient",
        headers=patient_auth_headers,
    ).json()
    assert refunded_wallet["total_points"] == 0
    assert refunded_wallet["credit_minor_units"] == 0
    assert [entry["event_type"] for entry in refunded_wallet["ledger"]] == [
        "refund_reversal",
        "treatment_reward",
    ]
    assert refunded_wallet["ledger"][0]["reversal_of_id"] == refunded_wallet["ledger"][1]["id"]

    refunded_earnings = client.get(
        "/api/v1/wallet/agent",
        headers=agent_auth_headers,
    ).json()
    assert refunded_earnings["approved_minor_units"] == 0
    assert refunded_earnings["total_earned_minor_units"] == 0
    assert len(refunded_earnings["ledger"]) == 2
    reversal = next(entry for entry in refunded_earnings["ledger"] if entry["status"] == "reversed")
    original = next(entry for entry in refunded_earnings["ledger"] if entry["status"] == "approved")
    assert reversal["amount_minor_units"] == -50_000
    assert reversal["reversal_of_id"] == original["id"]
