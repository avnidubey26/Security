from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.domain.reports.models import ReportDocument
from app.infrastructure.database.models.alerts import AlertModel
from app.infrastructure.database.models.detections import (
    DetectionResultModel,
    DetectionRuleModel,
    DetectionRuleVersionModel,
)
from app.infrastructure.database.models.evidence import EvidenceModel
from app.infrastructure.database.models.incidents import IncidentModel
from app.infrastructure.database.models.investigations import (
    InvestigationEventModel,
    InvestigationFindingModel,
    InvestigationModel,
    InvestigationNoteModel,
)
from app.infrastructure.database.models.mitre import (
    InvestigationMitreMappingModel,
    MitreTechniqueModel,
)
from app.infrastructure.database.models.telemetry import SecurityEventModel
from app.infrastructure.database.models.timeline import TimelineEntryModel


class ReportNotFoundError(Exception):
    """Raised when the requested investigation does not exist."""


class ReportService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def generate(self, investigation_id: UUID) -> ReportDocument:
        investigation = self._get_investigation(investigation_id)

        if investigation is None:
            raise ReportNotFoundError(
                f"Investigation {investigation_id} was not found."
            )

        incident = self._get_incident(investigation_id)

        alert_ids = [
            relation.alert_id
            for relation in investigation.alerts
        ]

        event_ids = [
            relation.security_event_id
            for relation in investigation.events
        ]

        alerts = self._get_alerts(alert_ids)
        events = self._get_events(event_ids)
        timeline = self._get_timeline(investigation)
        findings = self._get_findings(investigation)
        notes = self._get_notes(investigation)
        evidence = self._get_evidence(investigation_id)
        detections = self._get_detections(alerts)
        mitre_techniques = self._get_mitre_techniques(investigation_id)

        return ReportDocument(
            investigation=self._investigation(investigation),
            incident=self._incident(incident) if incident else None,
            detections=detections,
            alerts=[self._alert(alert) for alert in alerts],
            events=[self._event(event) for event in events],
            timeline=[self._timeline(entry) for entry in timeline],
            findings=[self._finding(finding) for finding in findings],
            notes=[self._note(note) for note in notes],
            evidence=[self._evidence(item) for item in evidence],
            mitre_techniques=mitre_techniques,
            generated_at=datetime.now(timezone.utc),
        )

    def _get_investigation(
        self,
        investigation_id: UUID,
    ) -> InvestigationModel | None:
        statement = (
            select(InvestigationModel)
            .where(InvestigationModel.id == investigation_id)
            .options(
                selectinload(InvestigationModel.alerts),
                selectinload(InvestigationModel.events),
                selectinload(InvestigationModel.notes),
                selectinload(InvestigationModel.findings),
                selectinload(InvestigationModel.timeline_entries),
            )
        )

        return self.db.scalar(statement)

    def _get_incident(
        self,
        investigation_id: UUID,
    ) -> IncidentModel | None:
        statement = select(IncidentModel).where(
            IncidentModel.investigation_id == investigation_id
        )

        return self.db.scalar(statement)

    def _get_alerts(
        self,
        alert_ids: list[UUID],
    ) -> list[AlertModel]:
        if not alert_ids:
            return []

        statement = (
            select(AlertModel)
            .where(AlertModel.id.in_(alert_ids))
            .order_by(AlertModel.created_at.asc(), AlertModel.id.asc())
        )

        return list(self.db.scalars(statement).all())

    def _get_events(
        self,
        event_ids: list[UUID],
    ) -> list[SecurityEventModel]:
        if not event_ids:
            return []

        statement = (
            select(SecurityEventModel)
            .where(SecurityEventModel.id.in_(event_ids))
            .order_by(
                SecurityEventModel.timestamp.asc(),
                SecurityEventModel.id.asc(),
            )
        )

        return list(self.db.scalars(statement).all())

    def _get_timeline(
        self,
        investigation: InvestigationModel,
    ) -> list[TimelineEntryModel]:
        return sorted(
            investigation.timeline_entries,
            key=lambda item: (
                item.occurred_at,
                item.sequence_number,
                item.id,
            ),
        )

    def _get_findings(
        self,
        investigation: InvestigationModel,
    ) -> list[InvestigationFindingModel]:
        return sorted(
            investigation.findings,
            key=lambda item: (
                item.created_at,
                item.id,
            ),
        )

    def _get_notes(
        self,
        investigation: InvestigationModel,
    ) -> list[InvestigationNoteModel]:
        return sorted(
            investigation.notes,
            key=lambda item: (
                item.created_at,
                item.id,
            ),
        )

    def _get_evidence(
        self,
        investigation_id: UUID,
    ) -> list[EvidenceModel]:
        statement = (
            select(EvidenceModel)
            .where(EvidenceModel.investigation_id == investigation_id)
            .order_by(
                EvidenceModel.created_at.asc(),
                EvidenceModel.id.asc(),
            )
        )

        return list(self.db.scalars(statement).all())

    def _get_detections(
        self,
        alerts: list[AlertModel],
    ) -> list[dict[str, Any]]:
        if not alerts:
            return []

        detection_result_ids = {
            alert.detection_result_id
            for alert in alerts
        }

        if not detection_result_ids:
            return []

        statement = (
            select(DetectionResultModel)
            .where(
                DetectionResultModel.id.in_(detection_result_ids)
            )
            .options(
                selectinload(
                    DetectionResultModel.rule_version
                ).selectinload(
                    DetectionRuleVersionModel.rule
                )
            )
        )

        results = list(self.db.scalars(statement).all())

        results_by_id = {
            result.id: result
            for result in results
        }

        detections: list[dict[str, Any]] = []

        for alert in alerts:
            result = results_by_id.get(alert.detection_result_id)

            if result is None:
                continue

            rule_version = result.rule_version
            rule = rule_version.rule if rule_version else None

            detections.append(
                {
                    "detection_result_id": result.id,
                    "detection_rule_version_id": (
                        result.detection_rule_version_id
                    ),
                    "detection_rule": (
                        {
                            "id": rule.id,
                            "name": rule.name,
                            "slug": rule.slug,
                            "description": rule.description,
                            "status": rule.status,
                        }
                        if rule
                        else None
                    ),
                    "rule_version": (
                        {
                            "id": rule_version.id,
                            "version": rule_version.version,
                            "format": rule_version.format,
                            "definition": rule_version.definition,
                            "severity": rule_version.severity,
                            "confidence": rule_version.confidence,
                            "is_active": rule_version.is_active,
                            "activated_at": rule_version.activated_at,
                            "created_at": rule_version.created_at,
                        }
                        if rule_version
                        else None
                    ),
                    "evaluation": {
                        "type": result.evaluation_type,
                        "matched": result.matched,
                        "evaluated_at": result.evaluated_at,
                        "explanation": result.explanation,
                        "matched_event_ids": result.matched_event_ids,
                        "context": result.context,
                    },
                }
            )

        return detections

    def _get_mitre_techniques(
        self,
        investigation_id: UUID,
    ) -> list[dict[str, Any]]:
        statement = (
            select(
                InvestigationMitreMappingModel,
                MitreTechniqueModel,
            )
            .join(
                MitreTechniqueModel,
                MitreTechniqueModel.id
                == InvestigationMitreMappingModel.technique_id,
            )
            .where(
                InvestigationMitreMappingModel.investigation_id
                == investigation_id
            )
            .order_by(
                MitreTechniqueModel.id.asc(),
            )
        )

        rows = self.db.execute(statement).all()

        return [
            {
                "mapping_id": mapping.id,
                "technique_id": technique.id,
                "name": technique.name,
                "description": technique.description,
                "domain": technique.domain,
                "platforms": technique.platforms,
                "version": technique.version,
                "last_modified": technique.last_modified,
                "rationale": mapping.rationale,
                "mapped_at": mapping.created_at,
                "tactic_id": technique.tactic_id,
            }
            for mapping, technique in rows
        ]

    @staticmethod
    def _investigation(
        investigation: InvestigationModel,
    ) -> dict[str, Any]:
        return {
            "id": investigation.id,
            "title": investigation.title,
            "description": investigation.description,
            "status": investigation.status,
            "priority": investigation.priority,
            "assigned_to": investigation.assigned_to,
            "started_at": investigation.started_at,
            "closed_at": investigation.closed_at,
            "created_at": investigation.created_at,
            "updated_at": investigation.updated_at,
        }

    @staticmethod
    def _incident(
        incident: IncidentModel,
    ) -> dict[str, Any]:
        return {
            "id": incident.id,
            "incident_number": incident.incident_number,
            "investigation_id": incident.investigation_id,
            "title": incident.title,
            "description": incident.description,
            "severity": incident.severity,
            "status": incident.status,
            "assigned_to": incident.assigned_to,
            "detected_at": incident.detected_at,
            "contained_at": incident.contained_at,
            "resolved_at": incident.resolved_at,
            "closed_at": incident.closed_at,
            "created_at": incident.created_at,
            "updated_at": incident.updated_at,
        }

    @staticmethod
    def _alert(
        alert: AlertModel,
    ) -> dict[str, Any]:
        return {
            "id": alert.id,
            "detection_result_id": alert.detection_result_id,
            "detection_rule_version_id": (
                alert.detection_rule_version_id
            ),
            "title": alert.title,
            "severity": alert.severity,
            "confidence": alert.confidence,
            "status": alert.status,
            "explanation": alert.explanation,
            "context": alert.context,
            "created_at": alert.created_at,
            "updated_at": alert.updated_at,
            "acknowledged_at": alert.acknowledged_at,
            "resolved_at": alert.resolved_at,
        }

    @staticmethod
    def _event(
        event: SecurityEventModel,
    ) -> dict[str, Any]:
        return {
            "id": event.id,
            "raw_telemetry_id": event.raw_telemetry_id,
            "timestamp": event.timestamp,
            "event_type": event.event_type,
            "source": event.source,
            "source_user": event.source_user,
            "source_ip": event.source_ip,
            "destination_ip": event.destination_ip,
            "destination_port": event.destination_port,
            "process": event.process,
            "parent_process": event.parent_process,
            "action": event.action,
            "status": event.status,
            "hostname": event.hostname,
            "resource": event.resource,
            "metadata": event.metadata_json,
        }

    @staticmethod
    def _timeline(
        entry: TimelineEntryModel,
    ) -> dict[str, Any]:
        return {
            "id": entry.id,
            "investigation_id": entry.investigation_id,
            "security_event_id": entry.security_event_id,
            "entry_type": entry.entry_type,
            "title": entry.title,
            "description": entry.description,
            "occurred_at": entry.occurred_at,
            "sequence_number": entry.sequence_number,
            "source": entry.source,
            "context": entry.context,
            "created_at": entry.created_at,
        }

    @staticmethod
    def _finding(
        finding: InvestigationFindingModel,
    ) -> dict[str, Any]:
        return {
            "id": finding.id,
            "investigation_id": finding.investigation_id,
            "finding_type": finding.finding_type,
            "title": finding.title,
            "content": finding.content,
            "author": finding.author,
            "created_at": finding.created_at,
            "updated_at": finding.updated_at,
        }

    @staticmethod
    def _note(
        note: InvestigationNoteModel,
    ) -> dict[str, Any]:
        return {
            "id": note.id,
            "investigation_id": note.investigation_id,
            "author": note.author,
            "content": note.content,
            "created_at": note.created_at,
            "updated_at": note.updated_at,
        }

    @staticmethod
    def _evidence(
        evidence: EvidenceModel,
    ) -> dict[str, Any]:
        return {
            "id": evidence.id,
            "investigation_id": evidence.investigation_id,
            "evidence_type": evidence.evidence_type,
            "source_type": evidence.source_type,
            "source_id": evidence.source_id,
            "title": evidence.title,
            "description": evidence.description,
            "snapshot": evidence.snapshot,
            "provenance": evidence.provenance,
            "integrity_hash": evidence.integrity_hash,
            "collected_by": evidence.collected_by,
            "collected_at": evidence.collected_at,
            "created_at": evidence.created_at,
        }