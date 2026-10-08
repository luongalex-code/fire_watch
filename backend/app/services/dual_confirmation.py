from datetime import timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.command import Command
from app.models.device import Device
from app.schemas.commands import CommandIn
from app.services.fire_monitoring import create_command, mark_command_sent, utcnow


ACTIVE_ALERT_STATUSES = ("open", "acknowledged")
ACTIVE_COMMAND_STATUSES = ("pending", "sent", "acknowledged")


def _has_active_alert(db: Session, *, area_id: int, source_type: str) -> bool:
    return (
        db.scalar(
            select(Alert.id)
            .where(Alert.area_id == area_id)
            .where(Alert.source_type == source_type)
            .where(Alert.status.in_(ACTIVE_ALERT_STATUSES))
            .where(Alert.condition_cleared_at.is_(None))
            .limit(1)
        )
        is not None
    )


def _has_recent_pump_command(
    db: Session,
    *,
    device_id: int,
    cooldown_seconds: int,
) -> bool:
    since = utcnow() - timedelta(seconds=cooldown_seconds)
    return (
        db.scalar(
            select(Command.id)
            .where(Command.device_id == device_id)
            .where(Command.target == "pump")
            .where(Command.action == "on")
            .where(Command.status.in_(ACTIVE_COMMAND_STATUSES))
            .where(Command.requested_at >= since)
            .limit(1)
        )
        is not None
    )


def send_pump_on_if_dual_confirmed(
    *,
    db: Session,
    mqtt_service: Any,
    area_id: int,
    esp32_device_code: str,
    cooldown_seconds: int,
    source: str,
    alert_id: int | None = None,
) -> Command | None:
    has_sensor = _has_active_alert(db, area_id=area_id, source_type="sensor")
    has_ai = _has_active_alert(db, area_id=area_id, source_type="ai")

    if not (has_sensor and has_ai):
        return None

    device = db.scalar(select(Device).where(Device.device_code == esp32_device_code))
    if not device:
        raise ValueError(f"Device not found: {esp32_device_code}")

    if _has_recent_pump_command(
        db,
        device_id=device.id,
        cooldown_seconds=cooldown_seconds,
    ):
        return None

    command, device = create_command(
        db,
        CommandIn(
            device_code=esp32_device_code,
            target="pump",
            action="on",
        ),
    )

    mqtt_service.publish_command(
        device.device_code,
        {
            "command_uuid": command.command_uuid,
            "target": command.target,
            "action": command.action,
            "source": source,
            "alert_id": alert_id,
            "dual_confirmed": True,
        },
    )

    return mark_command_sent(db, command)
