"""Seed default admin user

Revision ID: 20261007_0003
Revises: 20261006_0002
Create Date: 2026-10-07 00:00:00

"""
from typing import Sequence, Union

from alembic import op


revision: str = "20261007_0003"
down_revision: Union[str, Sequence[str], None] = "20261006_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ADMIN_PASSWORD_HASH = (
    "pbkdf2_sha256$260000$696f745f666972655f77617463685f61646d696e5f7631"
    "$c640b7ffa9db012fe5f19ea30e9142dc1c31b2ef18b58e29e5a0c5e1c84b45a9"
)


def upgrade() -> None:
    op.execute(
        f"""
        INSERT INTO users (email, password_hash, full_name, role, active)
        VALUES ('admin@firewatch.local', '{ADMIN_PASSWORD_HASH}', 'System Admin', 'admin', true)
        ON CONFLICT (email) DO UPDATE
        SET password_hash = EXCLUDED.password_hash,
            full_name = EXCLUDED.full_name,
            role = EXCLUDED.role,
            active = true,
            updated_at = now()
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM users
        WHERE email = 'admin@firewatch.local'
        """
    )
