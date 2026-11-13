import uuid

from sqlalchemy import (
    Boolean,
    DateTime,
    Index,
    String,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.base import Base


class OtpRequest(Base):
    __tablename__ = "otp_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    phone_e164: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    otp_code: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
    )

    expires_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        Index("ix_otp_phone_code", "phone_e164", "otp_code"),
    )
