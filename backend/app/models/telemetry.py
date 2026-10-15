from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class Telemetry(Base):
    __tablename__ = "telemetry"
    __table_args__ = (
        CheckConstraint("flame_adc IS NULL OR flame_adc BETWEEN 0 AND 4095", name="ck_telemetry_flame_adc"),
        CheckConstraint("mq2_adc IS NULL OR mq2_adc BETWEEN 0 AND 4095", name="ck_telemetry_mq2_adc"),
        CheckConstraint("fire_state IN ('normal', 'fire', 'unknown')", name="ck_telemetry_fire_state"),
        CheckConstraint("operating_mode IN ('auto', 'manual', 'test', 'unknown')", name="ck_telemetry_operating_mode"),
        Index("ix_telemetry_device_time", "device_id", "measured_at"),
        Index("ix_telemetry_fire_state_time", "fire_state", "measured_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id", ondelete="RESTRICT"), nullable=False)
    measured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )
    temperature_c: Mapped[float | None] = mapped_column(Numeric(5, 2))
    humidity_percent: Mapped[float | None] = mapped_column(Numeric(5, 2))
    flame_adc: Mapped[int | None] = mapped_column(Integer)
    mq2_adc: Mapped[int | None] = mapped_column(Integer)
    mq2_smoke_detected: Mapped[bool | None] = mapped_column(Boolean)
    dht22_error_code: Mapped[int | None] = mapped_column(Integer)
    fire_state: Mapped[str] = mapped_column(String(32), nullable=False, default="unknown")
    operating_mode: Mapped[str] = mapped_column(String(32), nullable=False, default="unknown")
    pump_relay_state: Mapped[bool | None] = mapped_column(Boolean)
    fan_state: Mapped[bool | None] = mapped_column(Boolean)
    buzzer_state: Mapped[bool | None] = mapped_column(Boolean)
    led_state: Mapped[bool | None] = mapped_column(Boolean)
