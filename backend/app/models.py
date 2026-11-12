
import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.base import Base


# -------------------------
# USER ACCOUNTS
# -------------------------

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


# -------------------------
# CLINIC BRANCHES
# -------------------------

class Branch(Base):
    __tablename__ = "branches"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    code: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        unique=True,
    )

    name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
    )

    city: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("true"),
    )


# -------------------------
# PATIENT PROFILES
# -------------------------

class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        unique=True,
    )

    preferred_branch_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("branches.id"),
        nullable=True,
    )

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


# -------------------------
# AGENT PROFILES
# -------------------------

class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        unique=True,
    )

    agent_code: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
        unique=True,
    )

    # The agent who recruited this agent
    sponsor_agent_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("agents.id"),
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        server_default="pending_verification",
    )

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        CheckConstraint(
            "status IN "
            "('pending_verification', 'active', 'inactive', 'suspended')",
            name="ck_agents_status",
        ),
        Index("ix_agents_sponsor_agent_id", "sponsor_agent_id"),
    )


# -------------------------
# PATIENT REFERRALS
# -------------------------

class Referral(Base):
    __tablename__ = "referrals"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Nullable because an agent can register a lead
    # before the patient creates an account.
    patient_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
        unique=True,
    )

    patient_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    patient_phone_e164: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    referring_agent_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("agents.id"),
        nullable=False,
    )

    preferred_branch_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("branches.id"),
        nullable=True,
    )

    service_interest: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        server_default="registered",
    )

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    converted_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    __table_args__ = (
        CheckConstraint(
            "status IN "
            "('registered', 'contacted', 'consultation_booked', "
            "'converted', 'not_converted', 'rejected')",
            name="ck_referrals_status",
        ),
        Index(
            "ix_referrals_agent_status",
            "referring_agent_id",
            "status",
        ),
    )
