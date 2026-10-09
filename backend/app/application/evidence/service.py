from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.domain.evidence.models import EvidenceSourceType, EvidenceType
from app.infrastructure.database.models import (
    AlertModel,
    DetectionResultModel,
    InvestigationFindingModel,
    InvestigationModel,
    InvestigationNoteModel,
    SecurityEventModel,
    InvestigationAlertModel,
    InvestigationEventModel,
    TimelineEntryModel,
)
from app.infrastructure.database.models.evidence import EvidenceModel
from app.infrastructure.repositories.evidence import EvidenceRepository


class EvidenceError(ValueError):
    pass


class EvidenceNotFoundError(LookupError):
    pass


class EvidenceService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = EvidenceRepository(db)

    def list_for_investigation(self, investigation_id: UUID) -> list[EvidenceModel]:
        self._require_investigation(investigation_id)
        return self.repository.list_for_investigation(investigation_id)

    def get(self, evidence_id: UUID) -> EvidenceModel:
        evidence = self.repository.get(evidence_id)
        if evidence is None:
            raise EvidenceNotFoundError("Evidence not found")
        return evidence

    def collect(
        self,
        *,
        investigation_id: UUID,
        source_type: str,
        source_id: UUID,
        collected_by: str,
        title: str | None = None,
        description: str | None = None,
    ) -> EvidenceModel:
        investigation = self._require_investigation(investigation_id)
        if not collected_by.strip():
            raise EvidenceError("Evidence collector is required")
        try:
            source_enum = EvidenceSourceType(source_type)
        except ValueError as exc:
            raise EvidenceError("Unsupported evidence source type") from exc

        existing = self.repository.get_by_source(investigation_id, source_enum.value, source_id)
        if existing is not None:
            return existing

        snapshot, default_title, evidence_type = self._snapshot_source(
            investigation_id, source_enum, source_id
        )
        canonical = json.dumps(snapshot, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
        integrity_hash = hashlib.sha256(canonical).hexdigest()
        now = datetime.now(timezone.utc)
        record = EvidenceModel(
            id=uuid4(),
            investigation_id=investigation.id,
            evidence_type=evidence_type.value,
            source_type=source_enum.value,
            source_id=source_id,
            title=(title or default_title).strip(),
            description=description.strip() if description else None,
            snapshot=snapshot,
            provenance={
                "investigation_id": str(investigation.id),
                "source_type": source_enum.value,
                "source_id": str(source_id),
                "collected_by": collected_by.strip(),
                "collected_at": now.isoformat(),
                "hash_algorithm": "SHA-256",
            },
            integrity_hash=integrity_hash,
            collected_by=collected_by.strip(),
            collected_at=now,
        )
        self.repository.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def verify_integrity(self, evidence_id: UUID) -> bool:
        evidence = self.get(evidence_id)
        canonical = json.dumps(evidence.snapshot, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
        return hashlib.sha256(canonical).hexdigest() == evidence.integrity_hash

    def _require_investigation(self, investigation_id: UUID) -> InvestigationModel:
        investigation = self.db.get(InvestigationModel, investigation_id)
        if investigation is None:
            raise EvidenceError("Investigation not found")
        return investigation

    def _snapshot_source(
        self, investigation_id: UUID, source_type: EvidenceSourceType, source_id: UUID
    ) -> tuple[dict[str, Any], str, EvidenceType]:
        if source_type == EvidenceSourceType.ALERT:
            source = self.db.get(AlertModel, source_id)
            if source is None:
                raise EvidenceError("Alert not found")
            self._require_alert_link(investigation_id, source_id)
            return (
                {
                    "id": str(source.id), "title": source.title, "severity": source.severity,
                    "confidence": source.confidence, "status": source.status,
                    "explanation": source.explanation, "context": source.context,
                    "created_at": source.created_at.isoformat() if source.created_at else None,
                },
                source.title,
                EvidenceType.ALERT,
            )
        if source_type == EvidenceSourceType.DETECTION_RESULT:
            source = self.db.get(DetectionResultModel, source_id)
            if source is None:
                raise EvidenceError("Detection result not found")
            alert = self.db.query(AlertModel.id).filter(AlertModel.detection_result_id == source_id).first()
            if alert is None:
                raise EvidenceError("Detection result is not linked to an alert")
            self._require_alert_link(investigation_id, alert[0])
            return (
                {
                    "id": str(source.id), "detection_rule_version_id": str(source.detection_rule_version_id),
                    "evaluation_type": source.evaluation_type, "matched": source.matched,
                    "evaluated_at": source.evaluated_at.isoformat(), "explanation": source.explanation,
                    "matched_event_ids": source.matched_event_ids, "context": source.context,
                },
                "Detection result",
                EvidenceType.DETECTION_RESULT,
            )
        if source_type == EvidenceSourceType.SECURITY_EVENT:
            source = self.db.get(SecurityEventModel, source_id)
            if source is None:
                raise EvidenceError("Security event not found")
            self._require_event_link(investigation_id, source_id)
            return (
                {
                    "id": str(source.id), "timestamp": source.timestamp.isoformat(), "event_type": source.event_type,
                    "source": source.source, "source_user": source.source_user, "source_ip": source.source_ip,
                    "destination_ip": source.destination_ip, "destination_port": source.destination_port,
                    "process": source.process, "parent_process": source.parent_process, "action": source.action,
                    "status": source.status, "hostname": source.hostname, "resource": source.resource,
                    "metadata": source.metadata_json,
                },
                f"Security event {source.event_type}",
                EvidenceType.SECURITY_EVENT,
            )
        if source_type == EvidenceSourceType.TIMELINE_ENTRY:
            source = self.db.get(TimelineEntryModel, source_id)
            if source is None:
                raise EvidenceError("Timeline entry not found")
            if source.investigation_id != investigation_id:
                raise EvidenceError("Timeline entry is not part of the investigation")
            return (
                {
                    "id": str(source.id), "entry_type": source.entry_type, "title": source.title,
                    "description": source.description, "occurred_at": source.occurred_at.isoformat(),
                    "sequence_number": source.sequence_number, "source": source.source, "context": source.context,
                    "security_event_id": str(source.security_event_id) if source.security_event_id else None,
                },
                source.title,
                EvidenceType.TIMELINE_ENTRY,
            )
        if source_type == EvidenceSourceType.INVESTIGATION_NOTE:
            source = self.db.get(InvestigationNoteModel, source_id)
            if source is None or source.investigation_id != investigation_id:
                raise EvidenceError("Investigation note not found for this investigation")
            return (
                {"id": str(source.id), "author": source.author, "content": source.content,
                 "created_at": source.created_at.isoformat(), "updated_at": source.updated_at.isoformat()},
                "Investigation note",
                EvidenceType.ANALYST_NOTE,
            )
        source = self.db.get(InvestigationFindingModel, source_id)
        if source is None or source.investigation_id != investigation_id:
            raise EvidenceError("Investigation finding not found for this investigation")
        return (
            {"id": str(source.id), "finding_type": source.finding_type, "title": source.title,
             "content": source.content, "author": source.author, "created_at": source.created_at.isoformat(),
             "updated_at": source.updated_at.isoformat()},
            source.title,
            EvidenceType.INVESTIGATION_FINDING,
        )

    def _require_alert_link(self, investigation_id: UUID, alert_id: UUID) -> None:
        link = self.db.query(InvestigationAlertModel.id).filter(
            InvestigationAlertModel.investigation_id == investigation_id,
            InvestigationAlertModel.alert_id == alert_id,
        ).first()
        if link is None:
            raise EvidenceError("Alert is not linked to this investigation")

    def _require_event_link(self, investigation_id: UUID, event_id: UUID) -> None:
        link = self.db.query(InvestigationEventModel.id).filter(
            InvestigationEventModel.investigation_id == investigation_id,
            InvestigationEventModel.security_event_id == event_id,
        ).first()
        if link is None:
            raise EvidenceError("Security event is not linked to this investigation")
