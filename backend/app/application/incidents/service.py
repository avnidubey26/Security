from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.domain.incidents.models import INCIDENT_TRANSITIONS, IncidentSeverity, IncidentStatus
from app.infrastructure.database.models import InvestigationModel
from app.infrastructure.database.models.evidence import EvidenceModel
from app.infrastructure.database.models.incidents import IncidentAlertModel, IncidentEvidenceModel, IncidentModel
from app.infrastructure.repositories.incidents import IncidentRepository


class IncidentNotFoundError(LookupError):
    pass


class IncidentStateError(ValueError):
    pass


_ALLOWED_TRANSITIONS = INCIDENT_TRANSITIONS


class IncidentService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = IncidentRepository(db)

    def create(
        self,
        *,
        investigation_id: UUID,
        title: str,
        description: str | None,
        severity: str,
        assigned_to: str | None,
    ) -> IncidentModel:
        investigation = self.db.get(InvestigationModel, investigation_id)
        if investigation is None:
            raise IncidentStateError("Investigation not found")
        if severity not in {item.value for item in IncidentSeverity}:
            raise IncidentStateError("Invalid incident severity")
        if not title.strip():
            raise IncidentStateError("Incident title cannot be empty")
        if self.repository.get_by_investigation(investigation_id) is not None:
            raise IncidentStateError("An incident already exists for this investigation")

        sequence = self.db.execute(text("SELECT nextval('incident_number_seq')")).scalar_one()
        incident = IncidentModel(
            id=uuid4(),
            incident_number=f"SEC-{datetime.now(timezone.utc).year}-{int(sequence):06d}",
            investigation_id=investigation_id,
            title=title.strip(),
            description=description.strip() if description else None,
            severity=severity,
            status=IncidentStatus.OPEN.value,
            assigned_to=assigned_to.strip() if assigned_to else None,
            detected_at=investigation.created_at,
        )
        self.repository.add(incident)
        self.db.flush()

        for investigation_alert in investigation.alerts:
            self.repository.add_alert(
                IncidentAlertModel(
                    id=uuid4(), incident_id=incident.id, alert_id=investigation_alert.alert_id,
                    relationship_type="RELATED",
                )
            )

        self.db.commit()
        return self.get(incident.id)

    def get(self, incident_id: UUID) -> IncidentModel:
        incident = self.repository.get(incident_id)
        if incident is None:
            raise IncidentNotFoundError("Incident not found")
        return incident

    def list(self, *, status: str | None = None, limit: int = 100) -> list[IncidentModel]:
        if status is not None and status not in {item.value for item in IncidentStatus}:
            raise IncidentStateError("Invalid incident status")
        return self.repository.list(status=status, limit=limit)

    def update(
        self,
        *,
        incident_id: UUID,
        status: str | None = None,
        severity: str | None = None,
        assigned_to: str | None = None,
        description: str | None = None,
    ) -> IncidentModel:
        incident = self.get(incident_id)
        now = datetime.now(timezone.utc)

        if status is not None:
            if status not in {item.value for item in IncidentStatus}:
                raise IncidentStateError("Invalid incident status")
            if status not in _ALLOWED_TRANSITIONS[incident.status]:
                raise IncidentStateError(f"Invalid incident transition: {incident.status} -> {status}")
            incident.status = status
            if status == IncidentStatus.CONTAINED.value:
                incident.contained_at = incident.contained_at or now
            elif status == IncidentStatus.RESOLVED.value:
                incident.resolved_at = incident.resolved_at or now
            elif status in {IncidentStatus.CLOSED.value, IncidentStatus.FALSE_POSITIVE.value}:
                incident.closed_at = incident.closed_at or now

        if severity is not None:
            if severity not in {item.value for item in IncidentSeverity}:
                raise IncidentStateError("Invalid incident severity")
            incident.severity = severity
        if assigned_to is not None:
            incident.assigned_to = assigned_to.strip() or None
        if description is not None:
            incident.description = description.strip() or None

        self.db.commit()
        return self.get(incident.id)

    def link_evidence(self, *, incident_id: UUID, evidence_id: UUID) -> IncidentEvidenceModel:
        incident = self.get(incident_id)
        evidence = self.db.get(EvidenceModel, evidence_id)
        if evidence is None:
            raise IncidentStateError("Evidence not found")
        if evidence.investigation_id != incident.investigation_id:
            raise IncidentStateError("Evidence belongs to a different investigation")
        if self.repository.has_evidence(incident.id, evidence_id):
            return self.db.query(IncidentEvidenceModel).filter(
                IncidentEvidenceModel.incident_id == incident.id,
                IncidentEvidenceModel.evidence_id == evidence_id,
            ).one()
        link = IncidentEvidenceModel(id=uuid4(), incident_id=incident.id, evidence_id=evidence_id)
        self.repository.add_evidence(link)
        self.db.commit()
        self.db.refresh(link)
        return link
