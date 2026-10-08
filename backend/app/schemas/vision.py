from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.schemas.common import ORMModel


class DetectionObject(BaseModel):
    label: str
    confidence: float
    bbox: dict[str, float]


class VisionDetectionIn(BaseModel):
    camera_code: str
    area_code: str = "default"
    area_name: str = "Phòng Thủ Dầu Một"
    frame_at: datetime | None = None
    model_name: str
    model_version: str | None = None
    detections: list[DetectionObject]
    snapshot_path: str | None = None
    video_path: str | None = None


class VisionDetectionOut(ORMModel):
    id: int
    camera_device_id: int
    alert_id: int | None = None
    frame_at: datetime
    model_name: str
    model_version: str | None = None
    detections: list[dict[str, Any]]
    snapshot_path: str | None = None
    video_path: str | None = None


class PersonVisionStateIn(BaseModel):
    camera_id: str
    camera_code: str
    area_code: str = "default"
    area_name: str = "Phòng Thủ Dầu Một"
    frame_at: datetime
    status: str
    person_count: int
    detections: list[DetectionObject] = []


class PersonVisionStateOut(PersonVisionStateIn):
    updated_at: datetime
