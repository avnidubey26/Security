import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database.base import Base


class TimelineEntryModel(Base):
    __tablename__ = "timeline_entries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    investigation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("investigations.id", ondelete="RESTRICT"), nullable=False
    )
    security_event_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("security_events.id", ondelete="RESTRICT")
    )
    entry_type: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    sequence_number: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[str | None] = mapped_column(String(100))
    context: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    investigation = relationship("InvestigationModel", back_populates="timeline_entries")
    security_event = relationship("SecurityEventModel")

    __table_args__ = (
        UniqueConstraint("investigation_id", "security_event_id", name="uq_timeline_investigation_event"),
        UniqueConstraint("investigation_id", "sequence_number", name="uq_timeline_investigation_sequence"),
        Index("ix_timeline_entries_investigation_occurred", "investigation_id", "occurred_at"),
        Index("ix_timeline_entries_investigation_sequence", "investigation_id", "sequence_number"),
        Index("ix_timeline_entries_security_event", "security_event_id"),
    )
