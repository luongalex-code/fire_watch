from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class Command(Base):
    __tablename__ = "commands"
    __table_args__ = (
        CheckConstraint(
            "target IN ('pump', 'buzzer', 'led', 'mode')",
            name="ck_commands_target",
        ),
        CheckConstraint(
            "action IN ('on', 'off', 'toggle', 'auto', 'manual', 'silence', 'reset')",
            name="ck_commands_action",
        ),
        CheckConstraint(
            "status IN ('pending', 'sent', 'acknowledged', 'failed', 'timeout')",
            name="ck_commands_status",
        ),
        Index("ix_commands_device_status", "device_id", "status"),
        Index("ix_commands_requested_at", "requested_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    command_uuid: Mapped[str] = mapped_column(UUID(as_uuid=False), unique=True, nullable=False, index=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id", ondelete="RESTRICT"), nullable=False)
    target: Mapped[str] = mapped_column(String(32), nullable=False)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    requested_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    ack_payload: Mapped[dict | None] = mapped_column(JSONB)
    failure_reason: Mapped[str | None] = mapped_column(String(255))
