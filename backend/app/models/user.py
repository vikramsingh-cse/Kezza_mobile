import uuid

from sqlalchemy import Boolean, CheckConstraint, DateTime, String, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    phone_e164: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        unique=True,
    )

    full_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="patient",
        server_default=text("'patient'"),
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("true"),
    )

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        CheckConstraint(
            "role IN ('patient', 'agent', 'admin')",
            name="ck_users_role",
        ),
    )
