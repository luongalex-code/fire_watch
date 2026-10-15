from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session
from datetime import date, datetime, timezone
from typing import Literal

from app.database.connection import get_db
from app.core.config import get_settings
from app.mqtt.client import mqtt_service
from app.models.vision_detection import VisionDetection
from app.schemas.vision import (
    PersonVisionStateIn,
    PersonVisionStateOut,
    VisionDetectionIn,
    VisionDetectionOut,
)
from app.services.dual_confirmation import send_pump_on_if_dual_confirmed
from app.services.fire_monitoring import record_vision_detection
from app.services.capture_history import capture_filters, capture_groups
from app.websocket.manager import websocket_manager


router = APIRouter(prefix="/api/vision", tags=["vision"])
latest_person_states: dict[str, PersonVisionStateOut] = {}


@router.get("/capture-groups")
def list_capture_groups(
    day: date | None = None,
    label: Literal["fire", "smoke"] | None = None,
    limit: int = Query(default=100, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return capture_groups(db, day=day, label=label, limit=limit)


@router.get("/captures", response_model=list[VisionDetectionOut])
def list_captures(
    alert_id: int | None = None,
    capture_id: int | None = None,
    day: date | None = None,
    label: Literal["fire", "smoke"] | None = None,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = select(VisionDetection).where(*capture_filters(day, label))
    if alert_id is not None:
        query = query.where(VisionDetection.alert_id == alert_id)
    if capture_id is not None:
        query = query.where(VisionDetection.id == capture_id)
    return db.scalars(query.order_by(VisionDetection.frame_at.desc(), VisionDetection.id.desc())
                      .offset(offset).limit(limit)).all()


@router.get("/detections", response_model=list[VisionDetectionOut])
def list_detections(
    camera_device_id: int | None = Query(default=None),
    alert_id: int | None = Query(default=None),
    limit: int = Query(default=100, le=1000),
    db: Session = Depends(get_db),
):
    query = select(VisionDetection).order_by(VisionDetection.frame_at.desc()).limit(limit)
    if camera_device_id:
        query = query.where(VisionDetection.camera_device_id == camera_device_id)
    if alert_id:
        query = query.where(VisionDetection.alert_id == alert_id)
    return db.scalars(query).all()


@router.get("/person-state/{camera_id}", response_model=PersonVisionStateOut)
def get_person_state(camera_id: str):
    state = latest_person_states.get(camera_id)
    if state is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Person state not found.")
    return state


@router.post("/person-state", response_model=PersonVisionStateOut)
async def update_person_state(payload: PersonVisionStateIn):
    state = PersonVisionStateOut(**payload.model_dump(), updated_at=datetime.now(timezone.utc))
    latest_person_states[payload.camera_id] = state
    await websocket_manager.broadcast(
        "person_vision_state",
        state.model_dump(mode="json"),
    )
    return state


@router.post("/detections", response_model=VisionDetectionOut)
async def create_detection(payload: VisionDetectionIn, db: Session = Depends(get_db)):
    detection, alert = record_vision_detection(db, payload)
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
                source="dual_confirmed_ai",
                alert_id=alert.id,
            )
        except ValueError:
            command = None

    await websocket_manager.broadcast(
        "vision_detection",
        {
            "id": detection.id,
            "camera_device_id": detection.camera_device_id,
            "alert_id": detection.alert_id,
            "active_alert_id": alert.id if alert else None,
            "dual_confirmed_command_uuid": command.command_uuid if command else None,
        },
    )
    return detection
