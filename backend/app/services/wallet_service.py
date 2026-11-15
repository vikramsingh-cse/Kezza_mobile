import uuid
from collections import defaultdict

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models.agent import Agent
from app.models.commission import CommissionLedger
from app.models.payment import Payment
from app.models.points import PointsLedger
from app.services.payment_service import (
    INR_POLICY_VERSION,
    LEGACY_ZAR_POLICY_VERSION,
    POINTS_PER_RUPEE_OF_TREATMENT_CREDIT,
    _commission_tier,
    _points_balance,
)


def get_patient_wallet(patient_id: uuid.UUID, db: Session) -> dict:
    total_points = _points_balance(patient_id, db, INR_POLICY_VERSION)
    legacy_zar_points = int(
        db.scalar(
            select(func.coalesce(func.sum(PointsLedger.points), 0)).where(
                PointsLedger.patient_id == patient_id,
                PointsLedger.policy_version == LEGACY_ZAR_POLICY_VERSION,
            )
        )
        or 0
    )
    # 25 current-policy points equal ₹1, so each point is exactly 4 paise.
    credit_minor_units = (
        total_points * 100 // POINTS_PER_RUPEE_OF_TREATMENT_CREDIT
    )
    # The legacy policy valued one point at R1; retain that value separately.
    legacy_zar_credit_minor_units = legacy_zar_points * 100

    entries = db.scalars(
        select(PointsLedger)
        .where(PointsLedger.patient_id == patient_id)
        .order_by(
            PointsLedger.created_at.desc(),
            case((PointsLedger.reversal_of_id.is_not(None), 0), else_=1),
            PointsLedger.id.desc(),
        )
    ).all()
    ledger = [
        {
            "id": str(entry.id),
            "points": entry.points,
            "balance_after": entry.balance_after,
            "event_type": entry.event_type,
            "description": entry.description,
            "policy_version": entry.policy_version,
            "reversal_of_id": str(entry.reversal_of_id) if entry.reversal_of_id else None,
            "created_at": entry.created_at.isoformat() if entry.created_at else "",
        }
        for entry in entries
    ]

    return {
        "total_points": total_points,
        "credit_minor_units": credit_minor_units,
        "currency": "INR",
        "legacy_zar_points": legacy_zar_points,
        "legacy_zar_credit_minor_units": legacy_zar_credit_minor_units,
        "points_rate_description": "₹1 eligible spend = 1 point. 25 points = ₹1 treatment credit.",
        "ledger": ledger,
    }


def _new_currency_totals() -> dict[str, int]:
    return {
        "pending_minor_units": 0,
        "approved_minor_units": 0,
        "paid_minor_units": 0,
        "total_earned_minor_units": 0,
    }


def get_agent_earnings(agent_id: uuid.UUID, db: Session) -> dict:
    agent = db.get(Agent, agent_id)
    if not agent:
        raise ValueError("Agent not found")

    results = db.execute(
        select(CommissionLedger, Payment.treatment_name, Payment.currency)
        .join(Payment, CommissionLedger.payment_id == Payment.id)
        .where(CommissionLedger.agent_id == agent_id)
        .order_by(CommissionLedger.created_at.desc())
    ).all()

    rows_by_id = {entry.id: entry for entry, _, _ in results}
    totals_by_currency: defaultdict[str, dict[str, int]] = defaultdict(
        _new_currency_totals
    )
    reversal_entries = []
    ledger = []

    for entry, treatment_name, currency in results:
        bucket = f"{entry.status}_minor_units"
        if entry.status in {"pending", "approved", "paid"}:
            totals_by_currency[currency][bucket] += entry.amount_minor_units
        elif entry.status == "reversed":
            reversal_entries.append((entry, currency))

        ledger.append(
            {
                "id": str(entry.id),
                "tier_name": entry.tier_name,
                "eligible_direct_agents": entry.eligible_direct_agents,
                "tier_percent": float(entry.tier_percent),
                "amount_minor_units": entry.amount_minor_units,
                "currency": currency,
                "status": entry.status,
                "reversal_of_id": str(entry.reversal_of_id) if entry.reversal_of_id else None,
                "created_at": entry.created_at.isoformat() if entry.created_at else "",
                "treatment_name": treatment_name,
            }
        )

    for reversal, currency in reversal_entries:
        original = rows_by_id.get(reversal.reversal_of_id) if reversal.reversal_of_id else None
        if original is None:
            # Legacy reversal rows predate explicit reversal_of_id links.
            original = next(
                (
                    candidate
                    for candidate, _, _ in results
                    if candidate.payment_id == reversal.payment_id
                    and candidate.agent_id == reversal.agent_id
                    and candidate.status in {"pending", "approved", "paid"}
                ),
                None,
            )
        if original and original.status in {"pending", "approved", "paid"}:
            totals_by_currency[currency][
                f"{original.status}_minor_units"
            ] += reversal.amount_minor_units

    for totals in totals_by_currency.values():
        totals["total_earned_minor_units"] = (
            totals["approved_minor_units"] + totals["paid_minor_units"]
        )

    tier_name, tier_percent, eligible_direct_agents = _commission_tier(agent_id, db)
    inr_totals = totals_by_currency["INR"]

    return {
        "agent_code": agent.agent_code,
        "commission_tier": tier_name,
        "tier_percent": float(tier_percent),
        "eligible_direct_agents": eligible_direct_agents,
        "pending_minor_units": inr_totals["pending_minor_units"],
        "approved_minor_units": inr_totals["approved_minor_units"],
        "paid_minor_units": inr_totals["paid_minor_units"],
        "total_earned_minor_units": inr_totals["total_earned_minor_units"],
        "earnings_by_currency": dict(totals_by_currency),
        "ledger": ledger,
    }
