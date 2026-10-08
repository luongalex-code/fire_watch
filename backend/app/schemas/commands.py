from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.schemas.common import ORMModel


class CommandIn(BaseModel):
    device_code: str
    target: str
    action: str
    requested_by: int | None = None


class CommandOut(ORMModel):
    id: int
    command_uuid: str
    device_id: int
    device_code: str | None = None
    device_name: str | None = None
    area_name: str | None = None
    target: str
    action: str
    requested_by: int | None = None
    requested_at: datetime
    sent_at: datetime | None = None
    acknowledged_at: datetime | None = None
    status: str
    ack_payload: dict[str, Any] | None = None
    failure_reason: str | None = None


