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


def test_complete_kezza_journey(client: TestClient):
    # =========================================================================
    # Step 1: Agent registers and gets unique referral code & link
    # =========================================================================
    agent_phone = "+27821110001"
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
    patient_phone = "+27822220002"
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
    # Step 4, 5, 6: Patient purchases a treatment for R 1,500
    # =========================================================================
    treatment_res = client.post(
        "/api/v1/payments/purchase-treatment",
        headers=patient_auth_headers,
        json={
            "treatment_name": "Premium Teeth Whitening",
            "amount_rands": 1500.00,
            "payment_reference": "INV-2026-001",
        },
    )
    assert treatment_res.status_code == 200, treatment_res.text
    treatment_data = treatment_res.json()

    # Step 5: Verify Patient received points (10% back = 150 points)
    assert treatment_data["points_earned"] == 150
    assert treatment_data["new_points_balance"] == 150

    # Step 6: Verify Agent received commission (10% of R1,500 = R150)
    assert treatment_data["referral_converted"] is True
    assert treatment_data["agent_commission_rands"] == 150.00

    # =========================================================================
    # Step 7: Both see their results!
    # =========================================================================
    # 7a. Patient sees treatment credit in wallet
    patient_wallet_res = client.get("/api/v1/wallet/patient", headers=patient_auth_headers)
    assert patient_wallet_res.status_code == 200
    wallet_data = patient_wallet_res.json()
    assert wallet_data["total_points"] == 150
    assert wallet_data["credit_rands"] == 150.00
    assert len(wallet_data["ledger"]) == 1
    assert "Premium Teeth Whitening" in wallet_data["ledger"][0]["description"]

    # 7b. Agent sees earnings and updated referral details
    agent_earnings_res = client.get("/api/v1/wallet/agent", headers=agent_auth_headers)
    assert agent_earnings_res.status_code == 200
    earnings_data = agent_earnings_res.json()
    assert earnings_data["approved_rands"] == 150.00
    assert earnings_data["total_earned_rands"] == 150.00
    assert len(earnings_data["ledger"]) == 1
    assert earnings_data["ledger"][0]["amount_rands"] == 150.00
    assert earnings_data["ledger"][0]["treatment_name"] == "Premium Teeth Whitening"

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
