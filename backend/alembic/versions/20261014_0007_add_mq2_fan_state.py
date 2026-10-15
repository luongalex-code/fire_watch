"""add mq2 smoke and fan state

Revision ID: 20261014_0007
Revises: 20261010_0006
Create Date: 2026-10-14
"""

from alembic import op
import sqlalchemy as sa


revision = "20261014_0007"
down_revision = "20261010_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("telemetry", sa.Column("mq2_smoke_detected", sa.Boolean(), nullable=True))
    op.add_column("telemetry", sa.Column("fan_state", sa.Boolean(), nullable=True))
    op.drop_constraint("ck_commands_target", "commands", type_="check")
    op.create_check_constraint(
        "ck_commands_target",
        "commands",
        "target IN ('pump', 'buzzer', 'led', 'mode', 'fan')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_commands_target", "commands", type_="check")
    op.create_check_constraint(
        "ck_commands_target",
        "commands",
        "target IN ('pump', 'buzzer', 'led', 'mode')",
    )
    op.drop_column("telemetry", "fan_state")
    op.drop_column("telemetry", "mq2_smoke_detected")
