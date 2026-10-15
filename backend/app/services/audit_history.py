from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.alert import Alert
from app.models.area import Area
from app.models.command import Command
from app.models.device import Device


def enrich_audit_logs(db: Session, rows: list) -> list[dict]:
    """Resolve display context without changing the original audit records."""
    command_ids = set()
    alert_ids = set()
    for row in rows:
        if row.entity_type == "command":
            try:
                command_ids.add(str(UUID(str((row.change_details or {}).get("command_uuid") or row.entity_id))))
            except (ValueError, TypeError):
                pass
        if row.entity_type == "alert" and str(row.entity_id).isdigit():
            alert_ids.add(int(row.entity_id))

    commands = {}
    if command_ids:
        for command, device, area in db.execute(
            select(Command, Device, Area)
            .join(Device, Device.id == Command.device_id)
            .join(Area, Area.id == Device.area_id)
            .where(Command.command_uuid.in_(command_ids))
        ):
            commands[str(command.command_uuid)] = (command, device, area)
    alerts = {}
    if alert_ids:
        for alert, area, device in db.execute(
            select(Alert, Area, Device)
            .join(Area, Area.id == Alert.area_id)
            .outerjoin(Device, Device.id == Alert.source_device_id)
            .where(Alert.id.in_(alert_ids))
        ):
            alerts[str(alert.id)] = (device, area)

    payload = []
    prefix = get_settings().mqtt_topic_prefix.strip("/")
    for row in rows:
        details = dict(row.change_details or {})
        device = area = None
        command_id = str(details.get("command_uuid") or row.entity_id or "")
        if row.entity_type == "command":
            details["command_uuid"] = command_id
            context = commands.get(command_id)
            if context:
                command, device, area = context
                details["target"] = command.target
                details["action"] = command.action
                details["command"] = {
                    "requested_at": command.requested_at.isoformat(),
                    "sent_at": command.sent_at.isoformat() if command.sent_at else None,
                    "acknowledged_at": command.acknowledged_at.isoformat() if command.acknowledged_at else None,
                    "status": command.status,
                    "ack_payload": command.ack_payload,
                    "failure_reason": command.failure_reason,
                }
                details["mqtt_topic"] = f"{prefix}/devices/{device.device_code}/commands"
        elif row.entity_type == "alert":
            device, area = alerts.get(str(row.entity_id), (None, None))
        payload.append({
            "id": str(row.id),
            "timestamp": row.occurred_at.isoformat(),
            "source": row.entity_type or "backend",
            "channel": row.action,
            "level": details.get("level", "AUDIT"),
            "message": details.get("message", row.action),
            "entityId": row.entity_id,
            "device": device.device_code if device else None,
            "deviceName": device.name if device else None,
            "areaName": area.name if area else None,
            "operator": str(row.actor_user_id) if row.actor_user_id else None,
            "details": details,
        })
    return payload
