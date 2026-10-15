"""add_alert_media

Revision ID: 20261010_0006
Revises: 20261007_0005_name_default_devices
Create Date: 2026-10-10 11:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20261010_0006'
down_revision: Union[str, None] = '20261007_0005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('alert_media',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('alert_id', sa.Integer(), nullable=False),
    sa.Column('camera_id', sa.Integer(), nullable=True),
    sa.Column('media_type', sa.String(length=32), nullable=False),
    sa.Column('chunk_index', sa.Integer(), server_default='0', nullable=False),
    sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('upload_status', sa.String(length=32), server_default='pending', nullable=False),
    sa.Column('cloudinary_public_id', sa.String(length=255), nullable=True),
    sa.Column('cloudinary_secure_url', sa.String(length=512), nullable=True),
    sa.Column('local_path', sa.String(length=512), nullable=True),
    sa.ForeignKeyConstraint(['alert_id'], ['alerts.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['camera_id'], ['devices.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_alert_media_alert_id'), 'alert_media', ['alert_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_alert_media_alert_id'), table_name='alert_media')
    op.drop_table('alert_media')
