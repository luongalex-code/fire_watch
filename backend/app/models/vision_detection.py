from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class VisionDetection(Base):
    __tablename__ = "vision_detections"
    __table_args__ = (
        Index("ix_vision_camera_time", "camera_device_id", "frame_at"),
        Index("ix_vision_alert_id", "alert_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    camera_device_id: Mapped[int] = mapped_column(ForeignKey("devices.id", ondelete="RESTRICT"), nullable=False)
    alert_id: Mapped[int | None] = mapped_column(ForeignKey("alerts.id", ondelete="SET NULL"))
    frame_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    model_name: Mapped[str] = mapped_column(String(120), nullable=False)
    model_version: Mapped[str | None] = mapped_column(String(120))
    detections: Mapped[list] = mapped_column(JSONB, nullable=False)
    snapshot_path: Mapped[str | None] = mapped_column(String(500))
    video_path: Mapped[str | None] = mapped_column(String(500))
