from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.infrastructure.database.models.mitre import (
    DetectionRuleMitreMappingModel,
    InvestigationMitreMappingModel,
    MitreTacticModel,
    MitreTechniqueModel,
    TimelineMitreMappingModel,
)


class MitreRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_techniques(self) -> list[MitreTechniqueModel]:
        return list(self.db.scalars(select(MitreTechniqueModel).order_by(MitreTechniqueModel.id)))

    def get_technique(self, technique_id: str) -> MitreTechniqueModel | None:
        return self.db.get(MitreTechniqueModel, technique_id)

    def get_tactic(self, tactic_id: str) -> MitreTacticModel | None:
        return self.db.get(MitreTacticModel, tactic_id)

    def add_investigation_mapping(self, investigation_id: UUID, technique_id: str, rationale: str | None) -> InvestigationMitreMappingModel:
        existing = self.db.scalar(select(InvestigationMitreMappingModel).where(
            InvestigationMitreMappingModel.investigation_id == investigation_id,
            InvestigationMitreMappingModel.technique_id == technique_id,
        ))
        if existing:
            if rationale and existing.rationale != rationale:
                existing.rationale = rationale
            return existing
        item = InvestigationMitreMappingModel(investigation_id=investigation_id, technique_id=technique_id, rationale=rationale)
        self.db.add(item)
        return item

    def add_timeline_mapping(self, timeline_entry_id: UUID, technique_id: str, rationale: str | None) -> TimelineMitreMappingModel:
        existing = self.db.scalar(select(TimelineMitreMappingModel).where(
            TimelineMitreMappingModel.timeline_entry_id == timeline_entry_id,
            TimelineMitreMappingModel.technique_id == technique_id,
        ))
        if existing:
            if rationale and existing.rationale != rationale:
                existing.rationale = rationale
            return existing
        item = TimelineMitreMappingModel(timeline_entry_id=timeline_entry_id, technique_id=technique_id, rationale=rationale)
        self.db.add(item)
        return item

    def add_detection_mapping(self, version_id: UUID, technique_id: str, rationale: str | None) -> DetectionRuleMitreMappingModel:
        existing = self.db.scalar(select(DetectionRuleMitreMappingModel).where(
            DetectionRuleMitreMappingModel.detection_rule_version_id == version_id,
            DetectionRuleMitreMappingModel.technique_id == technique_id,
        ))
        if existing:
            if rationale and existing.rationale != rationale:
                existing.rationale = rationale
            return existing
        item = DetectionRuleMitreMappingModel(detection_rule_version_id=version_id, technique_id=technique_id, rationale=rationale)
        self.db.add(item)
        return item

    def list_investigation_mappings(self, investigation_id: UUID) -> list[InvestigationMitreMappingModel]:
        return list(self.db.scalars(select(InvestigationMitreMappingModel).where(
            InvestigationMitreMappingModel.investigation_id == investigation_id
        ).order_by(InvestigationMitreMappingModel.created_at, InvestigationMitreMappingModel.id)))

    def list_timeline_mappings(self, timeline_entry_id: UUID) -> list[TimelineMitreMappingModel]:
        return list(self.db.scalars(select(TimelineMitreMappingModel).where(
            TimelineMitreMappingModel.timeline_entry_id == timeline_entry_id
        ).order_by(TimelineMitreMappingModel.created_at, TimelineMitreMappingModel.id)))

    def list_detection_mappings(self, version_id: UUID) -> list[DetectionRuleMitreMappingModel]:
        return list(self.db.scalars(select(DetectionRuleMitreMappingModel).where(
            DetectionRuleMitreMappingModel.detection_rule_version_id == version_id
        ).order_by(DetectionRuleMitreMappingModel.created_at, DetectionRuleMitreMappingModel.id)))
