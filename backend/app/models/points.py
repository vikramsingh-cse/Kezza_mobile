import uuid

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Uuid,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.base import Base


class PointsLedger(Base):
    __tablename__ = "points_ledger"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    patient_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("patients.id"),
        nullable=False,
    )

    payment_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("payments.id"),
        nullable=True,
    )

    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "users.id",
            name="fk_points_ledger_created_by_user_id_users",
        ),
        nullable=True,
    )

    reversal_of_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "points_ledger.id",
            name="fk_points_ledger_reversal_of_id_points_ledger",
        ),
        nullable=True,
    )

    # Positive for earn, negative for redeem
    points: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    balance_after: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    # 'treatment_reward', 'redemption', 'manual_adjustment', 'refund_reversal'
    event_type: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
    )

    description: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    # Existing rows retain their previous rand valuation; new rows use INR v1.
    policy_version: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="inr_v1",
        server_default=text("'inr_v1'"),
    )

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        Index("ix_points_patient_id", "patient_id"),
        UniqueConstraint(
            "reversal_of_id",
            name="uq_points_ledger_reversal_of_id",
        ),
    )
