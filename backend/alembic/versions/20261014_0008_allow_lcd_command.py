"""allow lcd command target

Revision ID: 20261014_0008
Revises: 20261014_0007
Create Date: 2026-10-14
"""

from alembic import op


revision = "20261014_0008"
down_revision = "20261014_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_commands_target", "commands", type_="check")
    op.create_check_constraint(
        "ck_commands_target",
        "commands",
        "target IN ('pump', 'buzzer', 'led', 'mode', 'fan', 'lcd')",
    )
    op.drop_constraint("ck_commands_action", "commands", type_="check")
    op.create_check_constraint(
        "ck_commands_action",
        "commands",
        "action IN ('on', 'off', 'toggle', 'auto', 'manual', 'silence', 'reset', 'clear')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_commands_action", "commands", type_="check")
    op.create_check_constraint(
        "ck_commands_action",
        "commands",
        "action IN ('on', 'off', 'toggle', 'auto', 'manual', 'silence', 'reset')",
    )
    op.drop_constraint("ck_commands_target", "commands", type_="check")
    op.create_check_constraint(
        "ck_commands_target",
        "commands",
        "target IN ('pump', 'buzzer', 'led', 'mode', 'fan')",
    )
