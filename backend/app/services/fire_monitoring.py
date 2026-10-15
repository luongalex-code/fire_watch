from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.area import Area
from app.models.command import Command
from app.models.device import Device
from app.models.telemetry import Telemetry
from app.models.audit_log import AuditLog
from app.models.vision_detection import VisionDetection
from app.schemas.commands import CommandIn
from app.schemas.telemetry import TelemetryIn
from app.schemas.vision import VisionDetectionIn


FIRE_LABELS = {"fire", "smoke"}


def default_device_name(device_code: str, device_kind: str, area_name: str | None = None) -> str:
    if device_kind == "esp32":
        return f"ESP32-S3 {device_code}"
    if device_kind == "camera":
        return f"Camera AI {device_code}"
    return device_code


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def ensure_area(db: Session, area_code: str, area_name: str | None = None) -> Area:
    area = db.scalar(select(Area).where(Area.area_code == area_code))
    if area:
        if area_name and area.name != area_name:
            area.name = area_name
        return area

    area = Area(
        area_code=area_code,
        name=area_name or area_code,
    )
    db.add(area)
    db.flush()
    return area


def ensure_device(
    db: Session,
    *,
    area: Area,
    device_code: str,
    device_kind: str,
    firmware_version: str | None = None,
) -> Device:
    device = db.scalar(select(Device).where(Device.device_code == device_code))
    now = utcnow()

    if device:
        device.area_id = area.id
        device.last_seen = now
        if not device.name or device.name == device.device_code:
            device.name = default_device_name(device_code, device_kind, area.name)
        if firmware_version:
            device.firmware_version = firmware_version
        return device

    device = Device(
        area_id=area.id,
        device_code=device_code,
        name=default_device_name(device_code, device_kind, area.name),
        device_kind=device_kind,
        firmware_version=firmware_version,
        last_seen=now,
    )
    db.add(device)
    db.flush()
    return device


def _find_active_alert(db: Session, *, area_id: int, source_device_id: int, source_type: str) -> Alert | None:
    return db.scalar(
        select(Alert)
        .where(Alert.area_id == area_id)
        .where(Alert.source_device_id == source_device_id)
        .where(Alert.source_type == source_type)
        .where(Alert.status.in_(["open", "acknowledged"]))
        .where(Alert.condition_cleared_at.is_(None))
        .order_by(Alert.started_at.desc())
    )


def open_or_touch_alert(
    db: Session,
    *,
    area: Area,
    device: Device,
    source_type: str,
    severity: str,
    title: str,
    message: str | None,
    details: dict | None = None,
) -> Alert:
    now = utcnow()
    alert = _find_active_alert(
        db,
        area_id=area.id,
        source_device_id=device.id,
        source_type=source_type,
    )

    if alert:
        alert.last_detected_at = now
        alert.severity = severity
        alert.message = message
        alert.details = details
        return alert

    alert = Alert(
        area_id=area.id,
        source_device_id=device.id,
        source_type=source_type,
        severity=severity,
        status="open",
        title=title,
        message=message,
        started_at=now,
        last_detected_at=now,
        details=details,
    )
    db.add(alert)
    db.flush()
    return alert


def clear_sensor_alert_if_needed(db: Session, *, area: Area, device: Device, fire_state: str) -> Alert | None:
    if fire_state != "normal":
        return None

    alert = _find_active_alert(
        db,
        area_id=area.id,
        source_device_id=device.id,
        source_type="sensor",
    )
    if not alert:
        return None

    alert.condition_cleared_at = utcnow()
    return alert


def clear_ai_alert_if_needed(db: Session, *, area: Area, camera: Device, has_fire_or_smoke: bool) -> Alert | None:
    if has_fire_or_smoke:
        return None

    alert = _find_active_alert(
        db,
        area_id=area.id,
        source_device_id=camera.id,
        source_type="ai",
    )
    if not alert:
        return None

    alert.condition_cleared_at = utcnow()
    return alert


def record_telemetry(db: Session, payload: TelemetryIn) -> tuple[Telemetry, Alert | None]:
    area = ensure_area(db, payload.area_code, payload.area_name)
    device = ensure_device(
        db,
        area=area,
        device_code=payload.device_code,
        device_kind="esp32",
        firmware_version=payload.firmware_version,
    )

    telemetry = Telemetry(
        device_id=device.id,
        measured_at=payload.measured_at or utcnow(),
        temperature_c=payload.temperature_c,
        humidity_percent=payload.humidity_percent,
        flame_adc=payload.flame_adc,
        mq2_adc=payload.mq2_adc,
        mq2_smoke_detected=payload.mq2_smoke_detected,
        dht22_error_code=payload.dht22_error_code,
        fire_state=payload.fire_state,
        operating_mode=payload.operating_mode,
        pump_relay_state=payload.pump_relay_state,
        fan_state=payload.fan_state,
        buzzer_state=payload.buzzer_state,
        led_state=payload.led_state,
    )
    db.add(telemetry)
    db.flush()

    alert = None
    if payload.fire_state == "fire":
        alert = open_or_touch_alert(
            db,
            area=area,
            device=device,
            source_type="sensor",
            severity="critical",
            title="Fire detected by ESP32 sensors",
            message="ESP32 reported FIRE state from flame sensor.",
            details={
                "flame_adc": payload.flame_adc,
                "mq2_adc": payload.mq2_adc,
                "mq2_smoke_detected": payload.mq2_smoke_detected,
                "dht22_error_code": payload.dht22_error_code,
            },
        )
    else:
        alert = clear_sensor_alert_if_needed(db, area=area, device=device, fire_state=payload.fire_state)

    db.commit()
    db.refresh(telemetry)
    if alert:
        db.refresh(alert)
    return telemetry, alert


def record_vision_detection(db: Session, payload: VisionDetectionIn) -> tuple[VisionDetection, Alert | None]:
    area = ensure_area(db, payload.area_code, payload.area_name)
    camera = ensure_device(
        db,
        area=area,
        device_code=payload.camera_code,
        device_kind="camera",
    )

    detection_rows = [item.model_dump() for item in payload.detections]
    has_fire_or_smoke = any(item.label.strip().lower() in FIRE_LABELS for item in payload.detections)

    alert = None
    if has_fire_or_smoke:
        best_confidence = max((item.confidence for item in payload.detections), default=0.0)
        alert = open_or_touch_alert(
            db,
            area=area,
            device=camera,
            source_type="ai",
            severity="high",
            title="Fire or smoke detected by camera AI",
            message="YOLO detected Fire/Smoke in camera frame.",
            details={
                "model_name": payload.model_name,
                "model_version": payload.model_version,
                "best_confidence": best_confidence,
            },
        )
    else:
        alert = clear_ai_alert_if_needed(db, area=area, camera=camera, has_fire_or_smoke=has_fire_or_smoke)

    detection = VisionDetection(
        camera_device_id=camera.id,
        alert_id=alert.id if alert else None,
        frame_at=payload.frame_at or utcnow(),
        model_name=payload.model_name,
        model_version=payload.model_version,
        detections=detection_rows,
        snapshot_path=payload.snapshot_path,
        video_path=payload.video_path,
    )
    db.add(detection)
    db.commit()
    db.refresh(detection)
    if alert:
        db.refresh(alert)
    return detection, alert


def create_command(db: Session, payload: CommandIn) -> tuple[Command, Device]:
    device = db.scalar(select(Device).where(Device.device_code == payload.device_code))
    if not device:
        raise ValueError(f"Device not found: {payload.device_code}")

    command = Command(
        command_uuid=str(uuid4()),
        device_id=device.id,
        target=payload.target,
        action=payload.action,
        requested_by=payload.requested_by,
        status="pending",
    )
    db.add(command)
    db.commit()
    db.refresh(command)
    
    try:
        db.add(AuditLog(
            action="command_created",
            entity_type="command",
            entity_id=command.command_uuid,
            change_details={
                "level": "INFO",
                "message": f"Yêu cầu lệnh {payload.action} cho {payload.target}",
                "command_uuid": command.command_uuid,
                "target": payload.target,
                "action": payload.action,
            }
        ))
        db.commit()
    except Exception:
        db.rollback()

    return command, device


def mark_command_sent(db: Session, command: Command) -> Command:
    command.status = "sent"
    command.sent_at = utcnow()
    db.commit()
    db.refresh(command)
    
    try:
        db.add(AuditLog(
            action="mqtt_command_sent",
            entity_type="command",
            entity_id=command.command_uuid,
            change_details={
                "level": "INFO",
                "message": f"Đã gửi lệnh tới thiết bị qua MQTT",
                "command_uuid": command.command_uuid,
                "target": command.target,
                "action": command.action,
            }
        ))
        db.commit()
    except Exception:
        db.rollback()

    return command


def acknowledge_command(db: Session, command_uuid: str, payload: dict) -> Command | None:
    command = db.scalar(select(Command).where(Command.command_uuid == command_uuid))
    if not command:
        return None

    command.status = "acknowledged"
    command.acknowledged_at = utcnow()
    command.ack_payload = payload
    db.commit()
    db.refresh(command)

    try:
        db.add(AuditLog(
            action="command_acknowledged",
            entity_type="command",
            entity_id=command.command_uuid,
            change_details={
                "level": "INFO",
                "message": f"Thiết bị đã nhận và phản hồi lệnh",
                "command_uuid": command.command_uuid,
                "target": command.target,
                "action": command.action,
                "ack_payload": payload,
            }
        ))
        db.commit()
    except Exception:
        db.rollback()

    return command


