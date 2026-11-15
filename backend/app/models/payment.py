import uuid

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.base import Base


class Payment(Base):
    __tablename__ = "payments"

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

    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("branches.id"),
        nullable=True,
    )

    treatment_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    # Integer minor units: paise for INR, cents for historical ZAR payments.
    amount_minor_units: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    currency: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="INR",
        server_default=text("'INR'"),
    )

    # 'pending', 'verified', 'refunded'
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="verified",
    )

    payment_reference: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
    )

    verified_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    refunded_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    refund_reason: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        Index("ix_payments_patient_id", "patient_id"),
        Index("ix_payments_reference", "payment_reference"),
    )
