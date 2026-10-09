import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database.base import Base


class MitreTacticModel(Base):
    __tablename__ = "mitre_tactics"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    techniques: Mapped[list["MitreTechniqueModel"]] = relationship(back_populates="tactic")


class MitreTechniqueModel(Base):
    __tablename__ = "mitre_techniques"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    tactic_id: Mapped[str] = mapped_column(ForeignKey("mitre_tactics.id", ondelete="RESTRICT"), nullable=False)
    parent_technique_id: Mapped[str | None] = mapped_column(ForeignKey("mitre_techniques.id", ondelete="RESTRICT"))
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    domain: Mapped[str] = mapped_column(String(50), nullable=False, default="enterprise")
    platforms: Mapped[list[Any] | None] = mapped_column(JSONB)
    version: Mapped[str | None] = mapped_column(String(30))
    last_modified: Mapped[str | None] = mapped_column(String(30))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    tactic: Mapped[MitreTacticModel] = relationship(back_populates="techniques")
    parent: Mapped["MitreTechniqueModel | None"] = relationship(remote_side=[id])


class DetectionRuleMitreMappingModel(Base):
    __tablename__ = "detection_rule_mitre_mappings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    detection_rule_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("detection_rule_versions.id", ondelete="RESTRICT"), nullable=False
    )
    technique_id: Mapped[str] = mapped_column(ForeignKey("mitre_techniques.id", ondelete="RESTRICT"), nullable=False)
    rationale: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("detection_rule_version_id", "technique_id", name="uq_detection_rule_mitre_mapping"),
        Index("ix_detection_rule_mitre_mapping_version", "detection_rule_version_id"),
        Index("ix_detection_rule_mitre_mapping_technique", "technique_id"),
    )


class InvestigationMitreMappingModel(Base):
    __tablename__ = "investigation_mitre_mappings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    investigation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("investigations.id", ondelete="RESTRICT"), nullable=False
    )
    technique_id: Mapped[str] = mapped_column(ForeignKey("mitre_techniques.id", ondelete="RESTRICT"), nullable=False)
    rationale: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("investigation_id", "technique_id", name="uq_investigation_mitre_mapping"),
        Index("ix_investigation_mitre_mapping_investigation", "investigation_id"),
        Index("ix_investigation_mitre_mapping_technique", "technique_id"),
    )


class TimelineMitreMappingModel(Base):
    __tablename__ = "timeline_mitre_mappings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timeline_entry_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("timeline_entries.id", ondelete="RESTRICT"), nullable=False
    )
    technique_id: Mapped[str] = mapped_column(ForeignKey("mitre_techniques.id", ondelete="RESTRICT"), nullable=False)
    rationale: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("timeline_entry_id", "technique_id", name="uq_timeline_mitre_mapping"),
        Index("ix_timeline_mitre_mapping_entry", "timeline_entry_id"),
        Index("ix_timeline_mitre_mapping_technique", "technique_id"),
    )
