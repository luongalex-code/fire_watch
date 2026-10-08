"""Name default fire monitoring devices.

Revision ID: 20261007_0005
Revises: 20261007_0004
Create Date: 2026-10-07 18:45:00
"""

from alembic import op


revision = "20261007_0005"
down_revision = "20261007_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE devices
        SET name = 'ESP32-S3 esp32-s3-01'
        WHERE device_code = 'esp32-s3-01'
          AND (name IS NULL OR name = '' OR name = device_code OR name = 'Device 1')
        """
    )
    op.execute(
        """
        UPDATE devices
        SET name = 'Camera AI camera-01'
        WHERE device_code IN ('camera-01', 'CAM-01')
          AND (name IS NULL OR name = '' OR name = device_code OR name = 'Device 1')
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE devices
        SET name = device_code
        WHERE device_code IN ('esp32-s3-01', 'camera-01', 'CAM-01')
          AND name IN (
            'ESP32-S3 esp32-s3-01',
            'Camera AI camera-01',
            'Camera AI CAM-01'
          )
        """
    )

