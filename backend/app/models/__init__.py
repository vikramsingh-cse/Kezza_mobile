# Import all models here so Alembic autogenerate can discover them.
from app.models.user import User
from app.models.branch import Branch
from app.models.patient import Patient
from app.models.agent import Agent
from app.models.referral import Referral
from app.models.payment import Payment
from app.models.points import PointsLedger
from app.models.commission import CommissionTier, CommissionLedger, LegacyCommissionTier
from app.models.otp import OtpRequest

__all__ = [
    "User",
    "Branch",
    "Patient",
    "Agent",
    "Referral",
    "Payment",
    "PointsLedger",
    "CommissionTier",
    "CommissionLedger",
    "LegacyCommissionTier",
    "OtpRequest",
]
