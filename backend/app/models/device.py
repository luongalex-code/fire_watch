from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class Device(Base):
    __tablename__ = "devices"
    __table_args__ = (
        CheckConstraint(
            "device_kind IN ('esp32', 'camera')",
            name="ck_devices_device_kind",
        ),
        Index("ix_devices_area_kind", "area_id", "device_kind"),
        Index("ix_devices_last_seen", "last_seen"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    area_id: Mapped[int] = mapped_column(ForeignKey("areas.id", ondelete="RESTRICT"), nullable=False)
    device_code: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    name: Mapped[str | None] = mapped_column(String(255))
    device_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    firmware_version: Mapped[str | None] = mapped_column(String(120))
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    sensor_config: Mapped[dict | None] = mapped_column(JSONB)
    ai_config: Mapped[dict | None] = mapped_column(JSONB)
    output_config: Mapped[dict | None] = mapped_column(JSONB)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
