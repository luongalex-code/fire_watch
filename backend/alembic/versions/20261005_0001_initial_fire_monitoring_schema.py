"""Initial fire monitoring schema

Revision ID: 20261005_0001
Revises:
Create Date: 2026-10-05 11:30:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20261005_0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("role IN ('admin', 'operator', 'viewer')", name="ck_users_role"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "areas",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("area_code", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_areas_area_code", "areas", ["area_code"], unique=True)

    op.create_table(
        "devices",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("area_id", sa.Integer(), nullable=False),
        sa.Column("device_code", sa.String(length=120), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("device_kind", sa.String(length=32), nullable=False),
        sa.Column("firmware_version", sa.String(length=120), nullable=True),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sensor_config", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("ai_config", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("output_config", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("device_kind IN ('esp32', 'camera')", name="ck_devices_device_kind"),
        sa.ForeignKeyConstraint(["area_id"], ["areas.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_devices_area_kind", "devices", ["area_id", "device_kind"], unique=False)
    op.create_index("ix_devices_device_code", "devices", ["device_code"], unique=True)
    op.create_index("ix_devices_last_seen", "devices", ["last_seen"], unique=False)

    op.create_table(
        "alerts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("area_id", sa.Integer(), nullable=False),
        sa.Column("source_device_id", sa.Integer(), nullable=True),
        sa.Column("source_type", sa.String(length=32), nullable=False),
        sa.Column("severity", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_detected_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("condition_cleared_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("acknowledged_by", sa.Integer(), nullable=True),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_by", sa.Integer(), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("false_positive_reason", sa.Text(), nullable=True),
        sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.CheckConstraint("source_type IN ('ai', 'sensor', 'device_error')", name="ck_alerts_source_type"),
        sa.CheckConstraint("severity IN ('low', 'medium', 'high', 'critical')", name="ck_alerts_severity"),
        sa.CheckConstraint("status IN ('open', 'acknowledged', 'closed', 'false_positive')", name="ck_alerts_status"),
        sa.CheckConstraint("last_detected_at >= started_at", name="ck_alerts_last_after_start"),
        sa.CheckConstraint(
            "condition_cleared_at IS NULL OR condition_cleared_at >= started_at",
            name="ck_alerts_condition_clear_after_start",
        ),
        sa.CheckConstraint("closed_at IS NULL OR closed_at >= started_at", name="ck_alerts_closed_after_start"),
        sa.ForeignKeyConstraint(["acknowledged_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["area_id"], ["areas.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["closed_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["source_device_id"], ["devices.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_alerts_area_status", "alerts", ["area_id", "status"], unique=False)
    op.create_index("ix_alerts_source_status", "alerts", ["source_type", "status"], unique=False)
    op.create_index("ix_alerts_started_at", "alerts", ["started_at"], unique=False)

    op.create_table(
        "telemetry",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("device_id", sa.Integer(), nullable=False),
        sa.Column("measured_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("temperature_c", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("humidity_percent", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("flame_adc", sa.Integer(), nullable=True),
        sa.Column("mq2_adc", sa.Integer(), nullable=True),
        sa.Column("dht22_error_code", sa.Integer(), nullable=True),
        sa.Column("fire_state", sa.String(length=32), nullable=False),
        sa.Column("operating_mode", sa.String(length=32), nullable=False),
        sa.Column("pump_relay_state", sa.Boolean(), nullable=True),
        sa.Column("buzzer_state", sa.Boolean(), nullable=True),
        sa.Column("led_state", sa.Boolean(), nullable=True),
        sa.CheckConstraint("flame_adc IS NULL OR flame_adc BETWEEN 0 AND 4095", name="ck_telemetry_flame_adc"),
        sa.CheckConstraint("mq2_adc IS NULL OR mq2_adc BETWEEN 0 AND 4095", name="ck_telemetry_mq2_adc"),
        sa.CheckConstraint("fire_state IN ('normal', 'fire', 'unknown')", name="ck_telemetry_fire_state"),
        sa.CheckConstraint("operating_mode IN ('auto', 'manual', 'test', 'unknown')", name="ck_telemetry_operating_mode"),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_telemetry_device_time", "telemetry", ["device_id", "measured_at"], unique=False)
    op.create_index("ix_telemetry_fire_state_time", "telemetry", ["fire_state", "measured_at"], unique=False)
    op.create_index("ix_telemetry_measured_at", "telemetry", ["measured_at"], unique=False)

    op.create_table(
        "vision_detections",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("camera_device_id", sa.Integer(), nullable=False),
        sa.Column("alert_id", sa.Integer(), nullable=True),
        sa.Column("frame_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("model_name", sa.String(length=120), nullable=False),
        sa.Column("model_version", sa.String(length=120), nullable=True),
        sa.Column("detections", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("snapshot_path", sa.String(length=500), nullable=True),
        sa.Column("video_path", sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(["alert_id"], ["alerts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["camera_device_id"], ["devices.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_vision_alert_id", "vision_detections", ["alert_id"], unique=False)
    op.create_index("ix_vision_camera_time", "vision_detections", ["camera_device_id", "frame_at"], unique=False)
    op.create_index("ix_vision_detections_gin", "vision_detections", ["detections"], unique=False, postgresql_using="gin")

    op.create_table(
        "commands",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("command_uuid", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("device_id", sa.Integer(), nullable=False),
        sa.Column("target", sa.String(length=32), nullable=False),
        sa.Column("action", sa.String(length=32), nullable=False),
        sa.Column("requested_by", sa.Integer(), nullable=True),
        sa.Column("requested_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("ack_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("failure_reason", sa.String(length=255), nullable=True),
        sa.CheckConstraint("target IN ('pump', 'buzzer', 'led', 'mode')", name="ck_commands_target"),
        sa.CheckConstraint("action IN ('on', 'off', 'toggle', 'auto', 'manual', 'silence', 'reset')", name="ck_commands_action"),
        sa.CheckConstraint("status IN ('pending', 'sent', 'acknowledged', 'failed', 'timeout')", name="ck_commands_status"),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["requested_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_commands_command_uuid", "commands", ["command_uuid"], unique=True)
    op.create_index("ix_commands_device_status", "commands", ["device_id", "status"], unique=False)
    op.create_index("ix_commands_requested_at", "commands", ["requested_at"], unique=False)

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("actor_user_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(length=120), nullable=False),
        sa.Column("entity_type", sa.String(length=120), nullable=True),
        sa.Column("entity_id", sa.String(length=120), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("change_details", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_actor_time", "audit_logs", ["actor_user_id", "occurred_at"], unique=False)
    op.create_index("ix_audit_entity", "audit_logs", ["entity_type", "entity_id"], unique=False)
    op.create_index("ix_audit_occurred_at", "audit_logs", ["occurred_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_audit_occurred_at", table_name="audit_logs")
    op.drop_index("ix_audit_entity", table_name="audit_logs")
    op.drop_index("ix_audit_actor_time", table_name="audit_logs")
    op.drop_table("audit_logs")
    op.drop_index("ix_commands_requested_at", table_name="commands")
    op.drop_index("ix_commands_device_status", table_name="commands")
    op.drop_index("ix_commands_command_uuid", table_name="commands")
    op.drop_table("commands")
    op.drop_index("ix_vision_detections_gin", table_name="vision_detections")
    op.drop_index("ix_vision_camera_time", table_name="vision_detections")
    op.drop_index("ix_vision_alert_id", table_name="vision_detections")
    op.drop_table("vision_detections")
    op.drop_index("ix_telemetry_measured_at", table_name="telemetry")
    op.drop_index("ix_telemetry_fire_state_time", table_name="telemetry")
    op.drop_index("ix_telemetry_device_time", table_name="telemetry")
    op.drop_table("telemetry")
    op.drop_index("ix_alerts_started_at", table_name="alerts")
    op.drop_index("ix_alerts_source_status", table_name="alerts")
    op.drop_index("ix_alerts_area_status", table_name="alerts")
    op.drop_table("alerts")
    op.drop_index("ix_devices_last_seen", table_name="devices")
    op.drop_index("ix_devices_device_code", table_name="devices")
    op.drop_index("ix_devices_area_kind", table_name="devices")
    op.drop_table("devices")
    op.drop_index("ix_areas_area_code", table_name="areas")
    op.drop_table("areas")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
