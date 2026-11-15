import uuid
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Uuid,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.base import Base


class CommissionTier(Base):
    __tablename__ = "commission_tiers"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    name: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    min_eligible_direct_agents: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    # Exact percentage, configurable up to 10% with eight decimal places.
    commission_percent: Mapped[Decimal] = mapped_column(
        Numeric(12, 8),
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    __table_args__ = (
        CheckConstraint(
            "min_eligible_direct_agents >= 0",
            name="ck_commission_tiers_min_direct_agents",
        ),
        CheckConstraint(
            "commission_percent > 0 AND commission_percent <= 10",
            name="ck_commission_tiers_percent_range",
        ),
        UniqueConstraint(
            "min_eligible_direct_agents",
            name="uq_commission_tiers_min_direct_agents",
        ),
        Index(
            "ix_commission_tiers_active_min_agents",
            "is_active",
            "min_eligible_direct_agents",
        ),
    )


class LegacyCommissionTier(Base):
    """Preserve the pre-INR sales-based tier configuration for audit history."""

    __tablename__ = "commission_tiers_legacy"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
    )

    name: Mapped[str] = mapped_column(String(50), nullable=False)

    min_sales_count: Mapped[int] = mapped_column(Integer, nullable=False)

    commission_percent: Mapped[float] = mapped_column(Float, nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False)


class CommissionLedger(Base):
    __tablename__ = "commission_ledger"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    agent_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("agents.id"),
        nullable=False,
    )

    referral_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("referrals.id"),
        nullable=True,
    )

    payment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("payments.id"),
        nullable=False,
    )

    tier_percent: Mapped[Decimal] = mapped_column(
        Numeric(12, 8),
        nullable=False,
    )

    tier_name: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    eligible_direct_agents: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    # Integer minor units in the currency of the associated payment.
    amount_minor_units: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    reversal_of_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "commission_ledger.id",
            name="fk_commission_ledger_reversal_of_id_commission_ledger",
        ),
        nullable=True,
    )

    # 'pending', 'approved', 'paid', 'reversed'
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="approved",
    )

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    approved_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    approved_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "users.id",
            name="fk_commission_ledger_approved_by_user_id_users",
        ),
        nullable=True,
    )

    paid_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    __table_args__ = (
        Index("ix_commission_agent_status", "agent_id", "status"),
        UniqueConstraint(
            "reversal_of_id",
            name="uq_commission_ledger_reversal_of_id",
        ),
    )
