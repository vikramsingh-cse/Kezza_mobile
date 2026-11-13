import uuid
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.agent import Agent
from app.models.commission import CommissionLedger
from app.models.payment import Payment
from app.models.points import PointsLedger


def get_patient_wallet(patient_id: uuid.UUID, db: Session) -> dict:
    latest_entry = db.scalars(
        select(PointsLedger)
        .where(PointsLedger.patient_id == patient_id)
        .order_by(PointsLedger.created_at.desc())
    ).first()

    total_points = latest_entry.balance_after if latest_entry else 0
    credit_rands = float(total_points)  # 1 Point = R 1.00 treatment credit

    stmt = (
        select(PointsLedger)
        .where(PointsLedger.patient_id == patient_id)
        .order_by(PointsLedger.created_at.desc())
    )
    entries = db.scalars(stmt).all()

    ledger = [
        {
            "id": str(e.id),
            "points": e.points,
            "balance_after": e.balance_after,
            "event_type": e.event_type,
            "description": e.description,
            "created_at": e.created_at.isoformat() if e.created_at else "",
        }
        for e in entries
    ]

    return {
        "total_points": total_points,
        "credit_rands": credit_rands,
        "points_rate_description": "1 reward point per R10 spent. 1 point = R1.00 treatment credit.",
        "ledger": ledger,
    }


def get_agent_earnings(agent_id: uuid.UUID, db: Session) -> dict:
    agent = db.get(Agent, agent_id)
    if not agent:
        raise ValueError("Agent not found")

    stmt = (
        select(CommissionLedger, Payment.treatment_name)
        .join(Payment, CommissionLedger.payment_id == Payment.id)
        .where(CommissionLedger.agent_id == agent_id)
        .order_by(CommissionLedger.created_at.desc())
    )
    results = db.execute(stmt).all()

    pending_cents = 0
    approved_cents = 0
    paid_cents = 0
    ledger = []

    for item, treatment_name in results:
        if item.status == "pending":
            pending_cents += item.amount_cents
        elif item.status == "approved":
            approved_cents += item.amount_cents
        elif item.status == "paid":
            paid_cents += item.amount_cents

        ledger.append({
            "id": str(item.id),
            "tier_percent": item.tier_percent,
            "amount_rands": item.amount_cents / 100.0,
            "status": item.status,
            "created_at": item.created_at.isoformat() if item.created_at else "",
            "treatment_name": treatment_name,
        })

    total_earned_cents = approved_cents + paid_cents

    return {
        "agent_code": agent.agent_code,
        "commission_tier": "Standard Tier (10%)",
        "tier_percent": 10.0,
        "pending_rands": pending_cents / 100.0,
        "approved_rands": approved_cents / 100.0,
        "paid_rands": paid_cents / 100.0,
        "total_earned_rands": total_earned_cents / 100.0,
        "ledger": ledger,
    }
