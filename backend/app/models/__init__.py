# Import all models here so Alembic autogenerate can discover them.
from app.models.user import User
from app.models.branch import Branch
from app.models.patient import Patient
from app.models.agent import Agent
from app.models.referral import Referral

__all__ = [
    "User",
    "Branch",
    "Patient",
    "Agent",
    "Referral",
]
