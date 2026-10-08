from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.mqtt.client import mqtt_service
from app.models.area import Area
from app.models.command import Command
from app.models.device import Device
from app.schemas.commands import CommandIn, CommandOut
from app.services.fire_monitoring import create_command, mark_command_sent
from app.websocket.manager import websocket_manager


router = APIRouter(prefix="/api/commands", tags=["commands"])


def _command_payload(command: Command, device: Device, area: Area | None = None) -> dict:
    return {
        "id": command.id,
        "command_uuid": command.command_uuid,
        "device_id": command.device_id,
        "device_code": device.device_code,
        "device_name": device.name or device.device_code,
        "area_name": area.name if area else None,
        "target": command.target,
        "action": command.action,
        "requested_by": command.requested_by,
        "requested_at": command.requested_at,
        "sent_at": command.sent_at,
        "acknowledged_at": command.acknowledged_at,
        "status": command.status,
        "ack_payload": command.ack_payload,
        "failure_reason": command.failure_reason,
    }


@router.get("", response_model=list[CommandOut])
def list_commands(limit: int = 100, db: Session = Depends(get_db)):
    rows = db.execute(
        select(Command, Device, Area)
        .join(Device, Device.id == Command.device_id)
        .join(Area, Area.id == Device.area_id)
        .order_by(desc(Command.requested_at))
        .limit(limit)
    ).all()
    return [_command_payload(command, device, area) for command, device, area in rows]


@router.post("", response_model=CommandOut)
async def send_command(payload: CommandIn, db: Session = Depends(get_db)):
    try:
        command, device = create_command(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    mqtt_service.publish_command(
        device.device_code,
        {
            "command_uuid": command.command_uuid,
            "target": command.target,
            "action": command.action,
        },
    )
    command = mark_command_sent(db, command)
    area = db.get(Area, device.area_id)
    await websocket_manager.broadcast(
        "command_sent",
        {
            "command_uuid": command.command_uuid,
            "device_code": device.device_code,
            "device_name": device.name or device.device_code,
            "target": command.target,
            "action": command.action,
        },
    )
    return _command_payload(command, device, area)
