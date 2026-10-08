from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import ORMModel


class TelemetryIn(BaseModel):
    device_code: str
    area_code: str = "default"
    area_name: str = "Phòng Thủ Dầu Một"
    measured_at: datetime | None = None
    temperature_c: float | None = None
    humidity_percent: float | None = None
    flame_adc: int | None = None
    mq2_adc: int | None = None
    dht22_error_code: int | None = None
    fire_state: str = "unknown"
    operating_mode: str = "unknown"
    pump_relay_state: bool | None = None
    buzzer_state: bool | None = None
    led_state: bool | None = None
    firmware_version: str | None = None


class TelemetryOut(ORMModel):
    id: int
    device_id: int
    measured_at: datetime
    temperature_c: float | None = None
    humidity_percent: float | None = None
    flame_adc: int | None = None
    mq2_adc: int | None = None
    dht22_error_code: int | None = None
    fire_state: str
    operating_mode: str
    pump_relay_state: bool | None = None
    buzzer_state: bool | None = None
    led_state: bool | None = None
