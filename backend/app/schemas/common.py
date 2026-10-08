from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class AreaOut(ORMModel):
    id: int
    area_code: str
    name: str
    description: str | None = None


class DeviceOut(ORMModel):
    id: int
    area_id: int
    device_code: str
    name: str | None = None
    device_kind: str
    firmware_version: str | None = None
    last_seen: datetime | None = None
    sensor_config: dict[str, Any] | None = None
    ai_config: dict[str, Any] | None = None
    output_config: dict[str, Any] | None = None
