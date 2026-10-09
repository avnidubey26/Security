import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database.base import Base


class DetectionRuleModel(Base):
    __tablename__ = "detection_rules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="DRAFT")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    versions: Mapped[list["DetectionRuleVersionModel"]] = relationship(back_populates="rule")


class DetectionRuleVersionModel(Base):
    __tablename__ = "detection_rule_versions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    detection_rule_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("detection_rules.id", ondelete="RESTRICT"), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    format: Mapped[str] = mapped_column(String(50), nullable=False, default="sigma-inspired")
    definition: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    confidence: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    rule: Mapped[DetectionRuleModel] = relationship(back_populates="versions")
    results: Mapped[list["DetectionResultModel"]] = relationship(back_populates="rule_version")

    __table_args__ = (
        UniqueConstraint("detection_rule_id", "version", name="uq_detection_rule_version"),
        Index("ix_detection_rule_versions_rule_active", "detection_rule_id", "is_active"),
    )


class DetectionTestModel(Base):
    __tablename__ = "detection_tests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    detection_rule_version_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("detection_rule_versions.id", ondelete="RESTRICT"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    events: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False)
    expected_match: Mapped[bool] = mapped_column(Boolean, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class DetectionResultModel(Base):
    __tablename__ = "detection_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    detection_rule_version_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("detection_rule_versions.id", ondelete="RESTRICT"), nullable=False)
    evaluation_type: Mapped[str] = mapped_column(String(30), nullable=False)
    matched: Mapped[bool] = mapped_column(Boolean, nullable=False)
    evaluated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    explanation: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    matched_event_ids: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    context: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    rule_version: Mapped[DetectionRuleVersionModel] = relationship(back_populates="results")

    __table_args__ = (
        Index("ix_detection_results_rule_evaluated", "detection_rule_version_id", "evaluated_at"),
        Index("ix_detection_results_matched", "matched", "evaluated_at"),
    )
