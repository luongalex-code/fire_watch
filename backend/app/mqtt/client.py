import asyncio
import hashlib
import json
import logging
from typing import Any

import paho.mqtt.client as mqtt
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import get_settings
from app.database.connection import SessionLocal
from app.models.runtime_setting import RuntimeSetting
from app.schemas.telemetry import TelemetryIn
from app.schemas.vision import DetectionObject, VisionDetectionIn
from app.services.dual_confirmation import send_pump_on_if_dual_confirmed
from app.services.fire_monitoring import (
    acknowledge_command,
    record_telemetry,
    record_vision_detection,
)
from app.websocket.manager import websocket_manager


logger = logging.getLogger(__name__)


class MQTTService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.client = mqtt.Client(
            mqtt.CallbackAPIVersion.VERSION2,
            client_id=self.settings.mqtt_client_id,
        )
        self.loop: asyncio.AbstractEventLoop | None = None
        self.connected = False

        if self.settings.mqtt_username:
            self.client.username_pw_set(
                self.settings.mqtt_username,
                self.settings.mqtt_password,
            )

        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_message = self._on_message

    @property
    def prefix(self) -> str:
        return self.settings.mqtt_topic_prefix.strip("/")

    def start(self, loop: asyncio.AbstractEventLoop) -> None:
        self.loop = loop
        self.client.connect_async(self.settings.mqtt_host, self.settings.mqtt_port, keepalive=60)
        self.client.loop_start()

    def stop(self) -> None:
        self.client.loop_stop()
        self.client.disconnect()

    def publish_command(self, device_code: str, payload: dict[str, Any]) -> None:
        topic = f"{self.prefix}/devices/{device_code}/commands"
        self.client.publish(topic, json.dumps(payload), qos=1)

    def publish_device_config(self, payload: dict[str, Any]) -> bool:
        topic = f"{self.prefix}/devices/{self.settings.esp32_device_code}/commands"
        result = self.client.publish(topic, json.dumps(payload), qos=1, retain=True)
        return self.connected and result.rc == mqtt.MQTT_ERR_SUCCESS

    def _publish_saved_device_config(self) -> None:
        try:
            with SessionLocal() as db:
                record = db.get(RuntimeSetting, "runtime")
                if record is None:
                    return

                checksum = hashlib.sha256(
                    json.dumps(
                        record.payload,
                        sort_keys=True,
                        separators=(",", ":"),
                    ).encode("utf-8")
                ).hexdigest()[:16]
                queued = self.publish_device_config(
                    {
                        "command_uuid": f"config-{checksum}",
                        "target": "config",
                        "action": "set",
                        "checksum": checksum,
                        "config": {
                            "dht_sampling_period_ms": record.payload["dhtSamplingPeriodMs"],
                        },
                    }
                )
                if not queued:
                    logger.warning("Could not queue saved ESP32 runtime configuration command")
        except SQLAlchemyError:
            logger.exception("Could not load saved ESP32 runtime configuration")

    def _broadcast_threadsafe(self, event_type: str, payload: dict) -> None:
        if not self.loop:
            return

        asyncio.run_coroutine_threadsafe(
            websocket_manager.broadcast(event_type, payload),
            self.loop,
        )

    def _on_connect(self, client, userdata, flags, reason_code, properties=None) -> None:
        if reason_code != 0:
            self.connected = False
            logger.error("MQTT connection rejected: %s", reason_code)
            self._broadcast_threadsafe(
                "mqtt_status",
                {"connected": False, "reason": str(reason_code)},
            )
            return

        self.connected = True
        client.subscribe(f"{self.prefix}/devices/+/telemetry", qos=1)
        client.subscribe(f"{self.prefix}/devices/+/commands/ack", qos=1)
        client.subscribe(f"{self.prefix}/ai/+/detections", qos=1)
        self._publish_saved_device_config()
        self._broadcast_threadsafe(
            "mqtt_status",
            {"connected": True, "host": self.settings.mqtt_host, "port": self.settings.mqtt_port},
        )

    def _on_disconnect(self, client, userdata, disconnect_flags, reason_code, properties=None) -> None:
        self.connected = False
        self._broadcast_threadsafe("mqtt_status", {"connected": False, "reason": str(reason_code)})

    def _on_message(self, client, userdata, message) -> None:
        try:
            payload = json.loads(message.payload.decode("utf-8"))
        except json.JSONDecodeError:
            self._broadcast_threadsafe("mqtt_error", {"topic": message.topic, "error": "invalid_json"})
            return

        try:
            self._route_message(message.topic, payload)
        except (ValidationError, ValueError) as exc:
            self._broadcast_threadsafe(
                "mqtt_error",
                {"topic": message.topic, "error": str(exc), "payload": payload},
            )
        except Exception as exc:
            self._broadcast_threadsafe("mqtt_error", {"topic": message.topic, "error": repr(exc)})

    def _route_message(self, topic: str, payload: dict[str, Any]) -> None:
        parts = topic.split("/")
        if len(parts) < 4:
            return

        if parts[0] == self.prefix and parts[1] == "devices" and parts[3] == "telemetry":
            device_code = parts[2]
            payload.setdefault("device_code", device_code)
            self._handle_telemetry(payload)
            return

        if parts[0] == self.prefix and parts[1] == "devices" and parts[3:5] == ["commands", "ack"]:
            self._handle_command_ack(payload)
            return

        if parts[0] == self.prefix and parts[1] == "ai" and parts[3] == "detections":
            camera_code = parts[2]
            payload.setdefault("camera_code", camera_code)
            self._handle_vision(payload)

    def _handle_telemetry(self, payload: dict[str, Any]) -> None:
        data = TelemetryIn(**payload)
        with SessionLocal() as db:
            telemetry, alert = record_telemetry(db, data)
            command = None
            if alert and self.settings.dual_confirmed_pump_enabled:
                try:
                    command = send_pump_on_if_dual_confirmed(
                        db=db,
                        mqtt_service=self,
                        area_id=alert.area_id,
                        esp32_device_code=self.settings.esp32_device_code,
                        cooldown_seconds=self.settings.dual_confirmed_pump_cooldown_seconds,
                        source="dual_confirmed_sensor",
                        alert_id=alert.id,
                    )
                except ValueError:
                    command = None

        self._broadcast_threadsafe(
            "telemetry",
            {
                "id": telemetry.id,
                "device_id": telemetry.device_id,
                "measured_at": telemetry.measured_at.isoformat(),
                "fire_state": telemetry.fire_state,
                "flame_adc": telemetry.flame_adc,
                "mq2_adc": telemetry.mq2_adc,
                "alert_id": alert.id if alert else None,
                "dual_confirmed_command_uuid": command.command_uuid if command else None,
            },
        )

    def _handle_vision(self, payload: dict[str, Any]) -> None:
        normalized = dict(payload)
        normalized["detections"] = [
            self._normalize_detection(item) for item in payload.get("detections", [])
        ]
        data = VisionDetectionIn(**normalized)

        with SessionLocal() as db:
            detection, alert = record_vision_detection(db, data)
            command = None
            if alert and self.settings.dual_confirmed_pump_enabled:
                try:
                    command = send_pump_on_if_dual_confirmed(
                        db=db,
                        mqtt_service=self,
                        area_id=alert.area_id,
                        esp32_device_code=self.settings.esp32_device_code,
                        cooldown_seconds=self.settings.dual_confirmed_pump_cooldown_seconds,
                        source="dual_confirmed_ai",
                        alert_id=alert.id,
                    )
                except ValueError:
                    command = None

        self._broadcast_threadsafe(
            "vision_detection",
            {
                "id": detection.id,
                "camera_device_id": detection.camera_device_id,
                "frame_at": detection.frame_at.isoformat(),
                "alert_id": detection.alert_id,
                "detections": detection.detections,
                "active_alert_id": alert.id if alert else None,
                "dual_confirmed_command_uuid": command.command_uuid if command else None,
            },
        )

    def _handle_command_ack(self, payload: dict[str, Any]) -> None:
        command_uuid = str(payload.get("command_uuid", ""))
        if not command_uuid:
            raise ValueError("Missing command_uuid")

        with SessionLocal() as db:
            command = acknowledge_command(db, command_uuid, payload)

        if command:
            self._broadcast_threadsafe(
                "command_ack",
                {"command_uuid": command.command_uuid, "status": command.status},
            )

    def _normalize_detection(self, item: dict[str, Any]) -> dict[str, Any]:
        label = item.get("label") or item.get("class_name") or item.get("name")
        confidence = item.get("confidence") or item.get("conf") or 0.0
        bbox = item.get("bbox") or item.get("box") or {}

        if isinstance(bbox, list) and len(bbox) == 4:
            bbox = {"x1": bbox[0], "y1": bbox[1], "x2": bbox[2], "y2": bbox[3]}

        return DetectionObject(
            label=str(label),
            confidence=float(confidence),
            bbox=bbox,
        ).model_dump()


mqtt_service = MQTTService()
