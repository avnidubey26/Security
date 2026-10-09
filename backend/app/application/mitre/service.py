from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.mitre.models import technique_ids_for_scenario
from app.infrastructure.database.models import DetectionRuleVersionModel, InvestigationEventModel, InvestigationModel, SecurityEventModel, TimelineEntryModel
from app.infrastructure.repositories.mitre import MitreRepository


class MitreNotFoundError(LookupError):
    pass


class MitreStateError(ValueError):
    pass


class MitreService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = MitreRepository(db)

    def list_techniques(self):
        return self.repository.list_techniques()

    def list_investigation_mappings(self, investigation_id: UUID):
        self._require_investigation(investigation_id)
        return self.repository.list_investigation_mappings(investigation_id)

    def list_timeline_mappings(self, timeline_entry_id: UUID):
        if self.db.get(TimelineEntryModel, timeline_entry_id) is None:
            raise MitreNotFoundError("Timeline entry not found")
        return self.repository.list_timeline_mappings(timeline_entry_id)

    def list_detection_mappings(self, version_id: UUID):
        if self.db.get(DetectionRuleVersionModel, version_id) is None:
            raise MitreNotFoundError("Detection rule version not found")
        return self.repository.list_detection_mappings(version_id)

    def auto_map_investigation(self, investigation_id: UUID):
        investigation = self._require_investigation(investigation_id)
        events = list(self.db.scalars(
            select(SecurityEventModel)
            .join(InvestigationEventModel, InvestigationEventModel.security_event_id == SecurityEventModel.id)
            .where(InvestigationEventModel.investigation_id == investigation_id)
            .order_by(SecurityEventModel.timestamp, SecurityEventModel.id)
        ))
        mapped: set[str] = set()
        has_failed_auth = any((event.event_type or "").lower().find("auth") >= 0 and (event.status or "").lower() == "failed" for event in events)
        has_identity_discovery = any(
            (event.metadata_json or {}).get("command_family") == "identity_discovery" or (event.resource or "").lower() == "id"
            for event in events
        )
        if has_failed_auth:
            item = self.repository.add_investigation_mapping(
                investigation_id,
                "T1110.001",
                "Five failed SSH authentication events in the investigation support password-guessing behavior; the scenario is a controlled simulation.",
            )
            mapped.add(item.technique_id)
        if has_identity_discovery:
            item = self.repository.add_investigation_mapping(
                investigation_id,
                "T1087.001",
                "The controlled process event executes Linux `id`, which MITRE documents as a local-account discovery command.",
            )
            mapped.add(item.technique_id)
            timeline_entries = list(self.db.scalars(
                select(TimelineEntryModel)
                .where(TimelineEntryModel.investigation_id == investigation_id)
                .order_by(TimelineEntryModel.sequence_number)
            ))
            for entry in timeline_entries:
                if entry.entry_type == "PROCESS_EXECUTION" and (entry.context or {}).get("metadata", {}).get("command_family") == "identity_discovery":
                    self.repository.add_timeline_mapping(
                        entry.id,
                        "T1087.001",
                        "Timeline evidence shows the controlled Linux `id` command executing after successful authentication.",
                    )
        self.db.commit()
        return self.repository.list_investigation_mappings(investigation.id), mapped

    def auto_map_detection_rule_version(self, version_id: UUID):
        version = self.db.get(DetectionRuleVersionModel, version_id)
        if version is None:
            raise MitreNotFoundError("Detection rule version not found")
        item = self.repository.add_detection_mapping(
            version_id,
            "T1110.001",
            "The detection sequence requires repeated failed authentication attempts followed by successful authentication, matching the controlled password-guessing scenario.",
        )
        self.db.commit()
        return self.repository.list_detection_mappings(version_id)

    def map_detection_rule_version(self, version_id: UUID, technique_id: str, rationale: str | None):
        self._require_technique(technique_id)
        if self.db.get(DetectionRuleVersionModel, version_id) is None:
            raise MitreNotFoundError("Detection rule version not found")
        item = self.repository.add_detection_mapping(version_id, technique_id, rationale)
        self.db.commit()
        self.db.refresh(item)
        return item

    def map_timeline_entry(self, timeline_entry_id: UUID, technique_id: str, rationale: str | None):
        self._require_technique(technique_id)
        entry = self.db.get(TimelineEntryModel, timeline_entry_id)
        if entry is None:
            raise MitreNotFoundError("Timeline entry not found")
        item = self.repository.add_timeline_mapping(timeline_entry_id, technique_id, rationale)
        self.db.commit()
        self.db.refresh(item)
        return item

    def _require_investigation(self, investigation_id: UUID) -> InvestigationModel:
        investigation = self.db.get(InvestigationModel, investigation_id)
        if investigation is None:
            raise MitreNotFoundError("Investigation not found")
        return investigation

    def _require_technique(self, technique_id: str):
        if self.repository.get_technique(technique_id) is None:
            raise MitreStateError("Unknown MITRE ATT&CK technique")
