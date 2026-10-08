from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.database.connection import get_db
from app.mqtt.client import mqtt_service
from app.models.telemetry import Telemetry
from app.schemas.telemetry import TelemetryIn, TelemetryOut
from app.services.dual_confirmation import send_pump_on_if_dual_confirmed
from app.services.fire_monitoring import record_telemetry
from app.websocket.manager import websocket_manager


router = APIRouter(prefix="/api/telemetry", tags=["telemetry"])


@router.get("", response_model=list[TelemetryOut])
def list_telemetry(
    device_id: int | None = Query(default=None),
    limit: int = Query(default=100, le=1000),
    db: Session = Depends(get_db),
):
    query = select(Telemetry).order_by(Telemetry.measured_at.desc()).limit(limit)
    if device_id:
        query = query.where(Telemetry.device_id == device_id)
    return db.scalars(query).all()


@router.post("", response_model=TelemetryOut)
async def create_telemetry(payload: TelemetryIn, db: Session = Depends(get_db)):
    telemetry, alert = record_telemetry(db, payload)
    command = None
    settings = get_settings()
    if alert and settings.dual_confirmed_pump_enabled:
        try:
            command = send_pump_on_if_dual_confirmed(
                db=db,
                mqtt_service=mqtt_service,
                area_id=alert.area_id,
                esp32_device_code=settings.esp32_device_code,
                cooldown_seconds=settings.dual_confirmed_pump_cooldown_seconds,
                source="dual_confirmed_sensor",
                alert_id=alert.id,
            )
        except ValueError:
            command = None

    await websocket_manager.broadcast(
        "telemetry",
        {
            "id": telemetry.id,
            "device_id": telemetry.device_id,
            "fire_state": telemetry.fire_state,
            "alert_id": alert.id if alert else None,
            "dual_confirmed_command_uuid": command.command_uuid if command else None,
        },
    )
    return telemetry
