from datetime import datetime, timedelta, timezone
import hashlib
import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.area import Area
from app.models.audit_log import AuditLog
from app.models.device import Device
from app.models.runtime_setting import RuntimeSetting
from app.models.telemetry import Telemetry
from app.mqtt.client import mqtt_service
from app.services.fire_monitoring import ensure_area


router = APIRouter(prefix="/api", tags=["dashboard"])

SETTINGS_KEY = "runtime"
DEFAULT_AREA_CODE = "default"
DEFAULT_AREA_NAME = "Phòng Thủ Dầu Một"

DEFAULT_SETTINGS: dict[str, Any] = {
    "aiModelName": "YOLO Fire/Smoke custom model",
    "aiConfidenceFireThreshold": 0.55,
    "aiConfidenceSmokeThreshold": 0.50,
    "aiConsecutiveFrames": 5,
    "aiCooldownSeconds": 5,
    "flameTriggerThresholdAdc": 2500,
    "flameClearThresholdAdc": 3000,
    "dhtSamplingPeriodMs": 2000,
    "pumpCycleOnMs": 300,
    "pumpCycleOffMs": 3000,
    "pumpMaxDurationSec": 30,
    "hardwareInterlockMode": "manual_override",
}


def _settings_checksum(payload: dict[str, Any]) -> str:
    stable = {
        key: value
        for key, value in payload.items()
        if key != "checksumSha256"
    }
    raw = json.dumps(stable, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:16]


def _load_runtime_settings(db: Session) -> dict[str, Any]:
    payload = dict(DEFAULT_SETTINGS)
    record = db.get(RuntimeSetting, SETTINGS_KEY)
    if record is not None:
        payload.update(record.payload)
    payload["checksumSha256"] = _settings_checksum(payload)
    return payload


def _validate_runtime_settings(payload: dict[str, Any]) -> None:
    integer_ranges = {
        "flameTriggerThresholdAdc": (0, 4095),
        "flameClearThresholdAdc": (0, 4095),
        "dhtSamplingPeriodMs": (2000, 60000),
        "pumpCycleOnMs": (0, 60000),
        "pumpCycleOffMs": (0, 60000),
        "pumpMaxDurationSec": (0, 3600),
        "aiConsecutiveFrames": (1, 60),
        "aiCooldownSeconds": (0, 3600),
    }
    for key, (minimum, maximum) in integer_ranges.items():
        value = payload[key]
        if type(value) is not int or not minimum <= value <= maximum:
            raise ValueError(f"{key} must be an integer between {minimum} and {maximum}")

    for key in ("aiConfidenceFireThreshold", "aiConfidenceSmokeThreshold"):
        value = payload[key]
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not 0 <= value <= 1:
            raise ValueError(f"{key} must be a number between 0 and 1")

    if not isinstance(payload["aiModelName"], str) or not payload["aiModelName"].strip():
        raise ValueError("aiModelName must be a non-empty string")
    if not isinstance(payload["hardwareInterlockMode"], str) or payload["hardwareInterlockMode"] not in {
        "hardware_enforced",
        "manual_override",
        "estop",
    }:
        raise ValueError("hardwareInterlockMode is invalid")


def _save_runtime_settings(db: Session, payload: dict[str, Any]) -> dict[str, Any]:
    saved = _load_runtime_settings(db)
    saved.update(
        {
            key: value
            for key, value in payload.items()
            if key in DEFAULT_SETTINGS
        }
    )
    _validate_runtime_settings(saved)
    saved["checksumSha256"] = _settings_checksum(saved)

    persisted_payload = {
        key: value
        for key, value in saved.items()
        if key in DEFAULT_SETTINGS
    }
    record = db.get(RuntimeSetting, SETTINGS_KEY)
    if record is None:
        record = RuntimeSetting(key=SETTINGS_KEY, payload=persisted_payload)
        db.add(record)
    else:
        record.payload = persisted_payload
    db.commit()
    return saved


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _is_online(last_seen: datetime | None, timeout_seconds: int = 120) -> bool:
    if not last_seen:
        return False
    return last_seen >= _now() - timedelta(seconds=timeout_seconds)


def _number(value: Any) -> float | None:
    return float(value) if value is not None else None


def _area_payload(area: Area) -> dict[str, Any]:
    return {
        "id": area.area_code,
        "name": area.name,
        "code": area.area_code.upper(),
        "tag": area.area_code.upper(),
        "riskLevel": 3,
        "description": area.description or DEFAULT_AREA_NAME,
    }


def _device_payload(device: Device, area_code: str) -> dict[str, Any]:
    online = _is_online(device.last_seen)
    device_type = "mcu_esp32" if device.device_kind == "esp32" else "camera_rtsp"
    metadata: dict[str, Any] = {}
    if device.sensor_config:
        metadata["sensorConfig"] = device.sensor_config
    if device.ai_config:
        metadata["aiConfig"] = device.ai_config
    if device.output_config:
        metadata["outputConfig"] = device.output_config

    return {
        "id": device.device_code,
        "name": device.name or device.device_code,
        "type": device_type,
        "areaId": area_code,
        "firmwareVersion": device.firmware_version,
        "isOnline": online,
        "lastHeartbeat": device.last_seen.isoformat() if device.last_seen else "",
        "status": "active" if online else "offline",
        "metadata": metadata,
    }


def _empty_reading(area_id: str) -> dict[str, Any]:
    return {
        "id": "empty",
        "areaId": area_id,
        "timestamp": _now().isoformat(),
        "temperatureC": None,
        "humidityPercent": None,
        "flameAdc": None,
        "mq2Adc": None,
        "flameFireDetected": False,
        "pumpRelayState": None,
        "buzzerState": None,
        "ledState": None,
        "operatingMode": "unknown",
        "isStale": True,
    }


def _reading_payload(row: Telemetry, area_code: str, device: Device | None = None) -> dict[str, Any]:
    timestamp = row.measured_at
    stale = timestamp < _now() - timedelta(seconds=120)
    return {
        "id": str(row.id),
        "areaId": area_code,
        "timestamp": timestamp.isoformat(),
        "temperatureC": _number(row.temperature_c),
        "humidityPercent": _number(row.humidity_percent),
        "flameAdc": row.flame_adc,
        "mq2Adc": row.mq2_adc,
        "flameFireDetected": row.fire_state == "fire",
        "pumpRelayState": row.pump_relay_state,
        "buzzerState": row.buzzer_state,
        "ledState": row.led_state,
        "operatingMode": row.operating_mode,
        "isStale": stale or not _is_online(device.last_seen if device else None),
    }


def _command_level(action: str) -> str:
    if action in {"reset", "silence"}:
        return "INFO"
    return "AUDIT"


@router.get("/areas")
def list_areas(db: Session = Depends(get_db)):
    ensure_area(db, DEFAULT_AREA_CODE, DEFAULT_AREA_NAME)
    db.commit()
    areas = db.scalars(select(Area).order_by(Area.name)).all()
    return [_area_payload(area) for area in areas]


@router.get("/devices")
def list_devices(area_id: str | None = Query(default=None, alias="areaId"), db: Session = Depends(get_db)):
    query = select(Device, Area.area_code).join(Area, Area.id == Device.area_id).order_by(Device.device_code)
    if area_id:
        query = query.where(Area.area_code == area_id)
    return [_device_payload(device, area_code) for device, area_code in db.execute(query).all()]


@router.get("/sensors/latest")
def latest_sensor_reading(area_id: str = Query(alias="areaId"), db: Session = Depends(get_db)):
    area = db.scalar(select(Area).where(Area.area_code == area_id))
    if not area:
        return _empty_reading(area_id)

    row = db.execute(
        select(Telemetry, Device)
        .join(Device, Device.id == Telemetry.device_id)
        .where(Device.area_id == area.id)
        .where(Device.device_kind == "esp32")
        .order_by(desc(Telemetry.measured_at))
        .limit(1)
    ).first()
    if not row:
        return _empty_reading(area.area_code)

    telemetry, device = row
    return _reading_payload(telemetry, area.area_code, device)


@router.get("/sensors/history")
def sensor_history(
    area_id: str = Query(alias="areaId"),
    range_minutes: int = Query(default=60, alias="range"),
    db: Session = Depends(get_db),
):
    area = db.scalar(select(Area).where(Area.area_code == area_id))
    if not area:
        return []

    since = _now() - timedelta(minutes=range_minutes)
    rows = db.scalars(
        select(Telemetry)
        .join(Device, Device.id == Telemetry.device_id)
        .where(Device.area_id == area.id)
        .where(Device.device_kind == "esp32")
        .where(Telemetry.measured_at >= since)
        .order_by(Telemetry.measured_at)
    ).all()
    return [
        {
            "time": row.measured_at.isoformat(),
            "temp": _number(row.temperature_c),
            "humidity": _number(row.humidity_percent),
            "flameAdc": row.flame_adc,
            "mq2Adc": row.mq2_adc,
        }
        for row in rows
    ]


@router.get("/logs")
def list_audit_logs(
    level: str | None = Query(default=None),
    q: str | None = Query(default=None),
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
):
    rows = db.scalars(select(AuditLog).order_by(desc(AuditLog.occurred_at)).limit(limit)).all()
    payload = []
    for row in rows:
        details = row.change_details or {}
        item = {
            "id": str(row.id),
            "timestamp": row.occurred_at.isoformat(),
            "source": row.entity_type or "backend",
            "channel": row.action,
            "level": details.get("level", "AUDIT"),
            "message": details.get("message", row.action),
            "device": row.entity_id,
            "operator": str(row.actor_user_id) if row.actor_user_id else None,
            "details": details,
        }
        if level and item["level"] != level:
            continue
        if q and q.lower() not in item["message"].lower():
            continue
        payload.append(item)
    return payload


@router.get("/settings")
def get_settings_payload(db: Session = Depends(get_db)):
    return _load_runtime_settings(db)


@router.put("/settings")
def save_settings_payload(settings: dict[str, Any], db: Session = Depends(get_db)):
    try:
        saved = _save_runtime_settings(db, settings)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    config_queued = mqtt_service.publish_device_config(
        {
            "command_uuid": f"config-{saved['checksumSha256']}",
            "target": "config",
            "action": "set",
            "checksum": saved["checksumSha256"],
            "config": {
                "dht_sampling_period_ms": saved["dhtSamplingPeriodMs"],
            },
        }
    )
    return {**saved, "deviceConfigQueued": config_queued}



