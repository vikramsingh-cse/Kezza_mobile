"""add admin console and financial audit fields

Revision ID: c5f760a25687
Revises: b7c1d4f2a6e9
Create Date: 2026-11-13 17:26:51.327620

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c5f760a25687'
down_revision: Union[str, Sequence[str], None] = 'b7c1d4f2a6e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add explicit user roles and admin-action audit references."""
    op.add_column(
        "commission_ledger",
        sa.Column("approved_by_user_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_commission_ledger_approved_by_user_id_users",
        "commission_ledger",
        "users",
        ["approved_by_user_id"],
        ["id"],
    )

    op.add_column(
        "points_ledger",
        sa.Column("created_by_user_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_points_ledger_created_by_user_id_users",
        "points_ledger",
        "users",
        ["created_by_user_id"],
        ["id"],
    )

    # Backfill from existing profiles before installing the default. Agents take
    # precedence because the existing profile builder historically did so.
    op.add_column("users", sa.Column("role", sa.String(length=20), nullable=True))
    op.execute(
        """
        UPDATE users AS u
        SET role = 'agent'
        WHERE EXISTS (SELECT 1 FROM agents AS a WHERE a.user_id = u.id)
        """
    )
    op.execute(
        """
        UPDATE users AS u
        SET role = 'patient'
        WHERE role IS NULL
          AND EXISTS (SELECT 1 FROM patients AS p WHERE p.user_id = u.id)
        """
    )
    op.execute("UPDATE users SET role = 'patient' WHERE role IS NULL")
    op.alter_column(
        "users",
        "role",
        existing_type=sa.String(length=20),
        nullable=False,
        server_default=sa.text("'patient'"),
    )
    op.create_check_constraint(
        "ck_users_role",
        "users",
        "role IN ('patient', 'agent', 'admin')",
    )


def downgrade() -> None:
    """Remove admin role and audit metadata.

    Downgrading after admin activity loses account roles and approver/creator
    history. Do not use as a routine rollback after the console has been used.
    """
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.drop_column("users", "role")
    op.drop_constraint(
        "fk_points_ledger_created_by_user_id_users",
        "points_ledger",
        type_="foreignkey",
    )
    op.drop_column("points_ledger", "created_by_user_id")
    op.drop_constraint(
        "fk_commission_ledger_approved_by_user_id_users",
        "commission_ledger",
        type_="foreignkey",
    )
    op.drop_column("commission_ledger", "approved_by_user_id")
