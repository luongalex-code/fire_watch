"""Seed default monitored area

Revision ID: 20261006_0002
Revises: 20261005_0001
Create Date: 2026-10-06 00:00:00

"""
from typing import Sequence, Union

from alembic import op


revision: str = "20261006_0002"
down_revision: Union[str, Sequence[str], None] = "20261005_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO areas (area_code, name, description)
        SELECT 'default', 'Phòng Thủ Dầu Một', 'Phòng Thủ Dầu Một'
        WHERE NOT EXISTS (
            SELECT 1 FROM areas WHERE area_code = 'default'
        )
        """
    )
    op.execute(
        """
        UPDATE areas
        SET name = 'Phòng Thủ Dầu Một',
            description = COALESCE(description, 'Phòng Thủ Dầu Một'),
            updated_at = now()
        WHERE area_code = 'default'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE areas
        SET name = 'default',
            updated_at = now()
        WHERE area_code = 'default'
          AND name = 'Phòng Thủ Dầu Một'
        """
    )
