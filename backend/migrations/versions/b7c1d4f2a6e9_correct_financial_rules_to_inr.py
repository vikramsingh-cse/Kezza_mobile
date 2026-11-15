"""switch new financial activity to INR and preserve legacy history

Revision ID: b7c1d4f2a6e9
Revises: a89c31bdf721
Create Date: 2026-11-13 15:00:00.000000

Existing payment and commission minor-unit values are renamed without
conversion. Their payment currency remains unchanged, so historical ZAR cents
stay intact while new INR payments store paise. Existing point rows are tagged
with the prior ZAR reward policy rather than being revalued as INR points.
"""

from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa


revision: str = "b7c1d4f2a6e9"
down_revision: Union[str, Sequence[str], None] = "a89c31bdf721"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Keep the previous sales-based tier configuration available for audit.
    op.rename_table("commission_tiers", "commission_tiers_legacy")
    op.execute(
        "ALTER TABLE commission_tiers_legacy "
        "RENAME CONSTRAINT commission_tiers_pkey TO commission_tiers_legacy_pkey"
    )

    op.create_table(
        "commission_tiers",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("min_eligible_direct_agents", sa.Integer(), nullable=False),
        sa.Column("commission_percent", sa.Numeric(12, 8), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.CheckConstraint(
            "min_eligible_direct_agents >= 0",
            name="ck_commission_tiers_min_direct_agents",
        ),
        sa.CheckConstraint(
            "commission_percent > 0 AND commission_percent <= 10",
            name="ck_commission_tiers_percent_range",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "min_eligible_direct_agents",
            name="uq_commission_tiers_min_direct_agents",
        ),
    )
    op.create_index(
        "ix_commission_tiers_active_min_agents",
        "commission_tiers",
        ["is_active", "min_eligible_direct_agents"],
        unique=False,
    )

    tier_table = sa.table(
        "commission_tiers",
        sa.column("id", sa.Uuid()),
        sa.column("name", sa.String(50)),
        sa.column("min_eligible_direct_agents", sa.Integer()),
        sa.column("commission_percent", sa.Numeric(12, 8)),
        sa.column("is_active", sa.Boolean()),
    )
    op.bulk_insert(
        tier_table,
        [
            {
                "id": uuid.UUID("b7c1d4f2-a6e9-4a10-8000-000000000001"),
                "name": "Base (1%)",
                "min_eligible_direct_agents": 0,
                "commission_percent": 1,
                "is_active": True,
            },
            {
                "id": uuid.UUID("b7c1d4f2-a6e9-4a10-8000-000000000002"),
                "name": "Growth (2%)",
                "min_eligible_direct_agents": 4,
                "commission_percent": 2,
                "is_active": True,
            },
            {
                "id": uuid.UUID("b7c1d4f2-a6e9-4a10-8000-000000000003"),
                "name": "Network (3%)",
                "min_eligible_direct_agents": 10,
                "commission_percent": 3,
                "is_active": True,
            },
        ],
    )

    op.alter_column(
        "payments",
        "amount_cents",
        new_column_name="amount_minor_units",
        existing_type=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "payments",
        "currency",
        existing_type=sa.String(length=10),
        existing_nullable=False,
        server_default=sa.text("'INR'"),
    )
    op.add_column("payments", sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("payments", sa.Column("refund_reason", sa.String(length=255), nullable=True))

    op.alter_column(
        "commission_ledger",
        "amount_cents",
        new_column_name="amount_minor_units",
        existing_type=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "commission_ledger",
        "tier_percent",
        existing_type=sa.Float(),
        type_=sa.Numeric(12, 8),
        existing_nullable=False,
    )
    op.add_column(
        "commission_ledger",
        sa.Column("tier_name", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "commission_ledger",
        sa.Column("eligible_direct_agents", sa.Integer(), nullable=True),
    )
    op.add_column(
        "commission_ledger",
        sa.Column("reversal_of_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_commission_ledger_reversal_of_id_commission_ledger",
        "commission_ledger",
        "commission_ledger",
        ["reversal_of_id"],
        ["id"],
    )
    op.create_unique_constraint(
        "uq_commission_ledger_reversal_of_id",
        "commission_ledger",
        ["reversal_of_id"],
    )

    op.add_column(
        "points_ledger",
        sa.Column(
            "policy_version",
            sa.String(length=30),
            server_default=sa.text("'legacy_zar_v1'"),
            nullable=False,
        ),
    )
    op.alter_column(
        "points_ledger",
        "policy_version",
        existing_type=sa.String(length=30),
        server_default=sa.text("'inr_v1'"),
        existing_nullable=False,
    )
    op.add_column(
        "points_ledger",
        sa.Column("reversal_of_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_points_ledger_reversal_of_id_points_ledger",
        "points_ledger",
        "points_ledger",
        ["reversal_of_id"],
        ["id"],
    )
    op.create_unique_constraint(
        "uq_points_ledger_reversal_of_id",
        "points_ledger",
        ["reversal_of_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_points_ledger_reversal_of_id", "points_ledger", type_="unique")
    op.drop_constraint(
        "fk_points_ledger_reversal_of_id_points_ledger",
        "points_ledger",
        type_="foreignkey",
    )
    op.drop_column("points_ledger", "reversal_of_id")
    op.drop_column("points_ledger", "policy_version")

    op.drop_constraint(
        "uq_commission_ledger_reversal_of_id",
        "commission_ledger",
        type_="unique",
    )
    op.drop_constraint(
        "fk_commission_ledger_reversal_of_id_commission_ledger",
        "commission_ledger",
        type_="foreignkey",
    )
    op.drop_column("commission_ledger", "reversal_of_id")
    op.drop_column("commission_ledger", "eligible_direct_agents")
    op.drop_column("commission_ledger", "tier_name")
    op.alter_column(
        "commission_ledger",
        "tier_percent",
        existing_type=sa.Numeric(12, 8),
        type_=sa.Float(),
        existing_nullable=False,
    )
    op.alter_column(
        "commission_ledger",
        "amount_minor_units",
        new_column_name="amount_cents",
        existing_type=sa.Integer(),
        existing_nullable=False,
    )

    op.drop_column("payments", "refund_reason")
    op.drop_column("payments", "refunded_at")
    op.alter_column(
        "payments",
        "currency",
        existing_type=sa.String(length=10),
        existing_nullable=False,
        server_default=None,
    )
    op.alter_column(
        "payments",
        "amount_minor_units",
        new_column_name="amount_cents",
        existing_type=sa.Integer(),
        existing_nullable=False,
    )

    op.drop_index("ix_commission_tiers_active_min_agents", table_name="commission_tiers")
    op.drop_table("commission_tiers")
    op.rename_table("commission_tiers_legacy", "commission_tiers")
    op.execute(
        "ALTER TABLE commission_tiers "
        "RENAME CONSTRAINT commission_tiers_legacy_pkey TO commission_tiers_pkey"
    )
