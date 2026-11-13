import uuid

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Uuid,
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

    min_sales_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    # e.g. 5.0 for 5%, 10.0 for 10%
    commission_percent: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )


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

    tier_percent: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    # Commission amount in cents (e.g. 15000 = R 150.00)
    amount_cents: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
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

    paid_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    __table_args__ = (
        Index("ix_commission_agent_status", "agent_id", "status"),
    )
