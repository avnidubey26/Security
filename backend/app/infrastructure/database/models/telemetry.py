import uuid
from datetime import datetime
from typing import Any
from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.infrastructure.database.base import Base


class RawTelemetryModel(Base):
    __tablename__ = "raw_telemetry"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scenario_run_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("scenario_runs.id", ondelete="RESTRICT"))
    source: Mapped[str] = mapped_column(String(100), nullable=False)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    security_events: Mapped[list["SecurityEventModel"]] = relationship(back_populates="raw_telemetry")
    __table_args__ = (Index("ix_raw_telemetry_run_occurred", "scenario_run_id", "occurred_at"),)


class SecurityEventModel(Base):
    __tablename__ = "security_events"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    raw_telemetry_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("raw_telemetry.id", ondelete="RESTRICT"))
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    source: Mapped[str] = mapped_column(String(100), nullable=False)
    source_user: Mapped[str | None] = mapped_column(String(150))
    source_ip: Mapped[str | None] = mapped_column(String(45))
    destination_ip: Mapped[str | None] = mapped_column(String(45))
    destination_port: Mapped[int | None] = mapped_column(Integer)
    process: Mapped[str | None] = mapped_column(String(255))
    parent_process: Mapped[str | None] = mapped_column(String(255))
    action: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str | None] = mapped_column(String(50))
    hostname: Mapped[str | None] = mapped_column(String(255))
    resource: Mapped[str | None] = mapped_column(String(500))
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    raw_telemetry: Mapped[RawTelemetryModel | None] = relationship(back_populates="security_events")
    __table_args__ = (Index("ix_security_events_timestamp", "timestamp"), Index("ix_security_events_type_timestamp", "event_type", "timestamp"), Index("ix_security_events_source_ip", "source_ip"), Index("ix_security_events_source_user", "source_user"))
