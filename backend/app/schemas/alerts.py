from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.schemas.common import ORMModel


class AlertOut(ORMModel):
    id: int
    area_id: int
    area_code: str | None = None
    area_name: str | None = None
    source_device_id: int | None = None
    source_type: str
    severity: str
    status: str
    title: str
    message: str | None = None
    started_at: datetime
    last_detected_at: datetime
    condition_cleared_at: datetime | None = None
    acknowledged_by: int | None = None
    acknowledged_at: datetime | None = None
    details: dict[str, Any] | None = None


class AlertUpdateIn(BaseModel):
    user_id: int | None = None
    operator_name: str | None = None
