"""Remove the unused alert_media table.

Revision ID: 20261015_0009
Revises: 20261014_0008
"""

from alembic import op
import sqlalchemy as sa


revision = "20261015_0009"
down_revision = "20261014_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("alert_media")


def downgrade() -> None:
    # Restore the historical schema on rollback, without restoring old data.
    op.create_table(
        "alert_media",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("alert_id", sa.Integer(), nullable=False),
        sa.Column("camera_id", sa.Integer(), nullable=True),
        sa.Column("media_type", sa.String(32), nullable=False),
        sa.Column("chunk_index", sa.Integer(), server_default="0", nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("upload_status", sa.String(32), server_default="pending", nullable=False),
        sa.Column("cloudinary_public_id", sa.String(255), nullable=True),
        sa.Column("cloudinary_secure_url", sa.String(512), nullable=True),
        sa.Column("local_path", sa.String(512), nullable=True),
        sa.ForeignKeyConstraint(["alert_id"], ["alerts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["camera_id"], ["devices.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_alert_media_alert_id", "alert_media", ["alert_id"], unique=False)
