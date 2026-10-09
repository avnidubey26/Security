import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database.base import Base


class InvestigationModel(Base):
    __tablename__ = "investigations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="OPEN")
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="MEDIUM")
    assigned_to: Mapped[str | None] = mapped_column(String(150))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    alerts: Mapped[list["InvestigationAlertModel"]] = relationship(
        back_populates="investigation", cascade="all, delete-orphan"
    )
    events: Mapped[list["InvestigationEventModel"]] = relationship(
        back_populates="investigation", cascade="all, delete-orphan"
    )
    notes: Mapped[list["InvestigationNoteModel"]] = relationship(
        back_populates="investigation", cascade="all, delete-orphan"
    )
    findings: Mapped[list["InvestigationFindingModel"]] = relationship(
        back_populates="investigation", cascade="all, delete-orphan"
    )
    timeline_entries: Mapped[list["TimelineEntryModel"]] = relationship(
        back_populates="investigation", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_investigations_status_created", "status", "created_at"),
        Index("ix_investigations_priority_created", "priority", "created_at"),
        Index("ix_investigations_assigned_to", "assigned_to"),
    )


class InvestigationAlertModel(Base):
    __tablename__ = "investigation_alerts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    investigation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("investigations.id", ondelete="RESTRICT"), nullable=False
    )
    alert_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("alerts.id", ondelete="RESTRICT"), nullable=False
    )
    relationship_type: Mapped[str] = mapped_column(String(30), nullable=False, default="RELATED")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    investigation: Mapped[InvestigationModel] = relationship(back_populates="alerts")

    __table_args__ = (
        UniqueConstraint("investigation_id", "alert_id", name="uq_investigation_alert"),
        Index("ix_investigation_alerts_investigation", "investigation_id"),
        Index("ix_investigation_alerts_alert", "alert_id"),
    )


class InvestigationEventModel(Base):
    __tablename__ = "investigation_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    investigation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("investigations.id", ondelete="RESTRICT"), nullable=False
    )
    security_event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("security_events.id", ondelete="RESTRICT"), nullable=False
    )
    relationship_type: Mapped[str] = mapped_column(String(30), nullable=False, default="INVESTIGATIVE")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    investigation: Mapped[InvestigationModel] = relationship(back_populates="events")

    __table_args__ = (
        UniqueConstraint("investigation_id", "security_event_id", name="uq_investigation_event"),
        Index("ix_investigation_events_investigation", "investigation_id"),
        Index("ix_investigation_events_security_event", "security_event_id"),
    )


class InvestigationNoteModel(Base):
    __tablename__ = "investigation_notes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    investigation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("investigations.id", ondelete="RESTRICT"), nullable=False
    )
    author: Mapped[str] = mapped_column(String(150), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    investigation: Mapped[InvestigationModel] = relationship(back_populates="notes")

    __table_args__ = (Index("ix_investigation_notes_investigation_created", "investigation_id", "created_at"),)


class InvestigationFindingModel(Base):
    __tablename__ = "investigation_findings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    investigation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("investigations.id", ondelete="RESTRICT"), nullable=False
    )
    finding_type: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    author: Mapped[str] = mapped_column(String(150), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    investigation: Mapped[InvestigationModel] = relationship(back_populates="findings")

    __table_args__ = (
        Index("ix_investigation_findings_investigation_created", "investigation_id", "created_at"),
    )
