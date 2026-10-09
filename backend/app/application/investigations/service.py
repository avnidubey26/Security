from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.domain.investigations.models import (
    FINDING_TYPES,
    INVESTIGATION_PRIORITIES,
    INVESTIGATION_STATUSES,
)
from app.infrastructure.database.models import (
    AlertEventModel,
    AlertModel,
    InvestigationAlertModel,
    InvestigationEventModel,
    InvestigationFindingModel,
    InvestigationModel,
    InvestigationNoteModel,
    SecurityEventModel,
)
from app.infrastructure.repositories.investigations import InvestigationRepository


class InvestigationNotFoundError(LookupError):
    pass


class InvestigationStateError(ValueError):
    pass


_ALLOWED_TRANSITIONS = {
    "OPEN": {"OPEN", "IN_PROGRESS", "CLOSED", "FALSE_POSITIVE"},
    "IN_PROGRESS": {"IN_PROGRESS", "CONTAINED", "CLOSED", "FALSE_POSITIVE"},
    "CONTAINED": {"CONTAINED", "CLOSED"},
    "CLOSED": {"CLOSED"},
    "FALSE_POSITIVE": {"FALSE_POSITIVE"},
}


class InvestigationService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = InvestigationRepository(db)

    def create(
        self,
        *,
        title: str,
        description: str | None,
        priority: str,
        assigned_to: str | None,
        alert_id: UUID | None,
    ) -> InvestigationModel:
        if priority not in INVESTIGATION_PRIORITIES:
            raise InvestigationStateError("Invalid investigation priority")
        if not title.strip():
            raise InvestigationStateError("Investigation title cannot be empty")

        investigation = InvestigationModel(
            id=uuid4(),
            title=title.strip(),
            description=description.strip() if description else None,
            status="OPEN",
            priority=priority,
            assigned_to=assigned_to.strip() if assigned_to else None,
        )
        self.repository.add(investigation)
        self.db.flush()

        if alert_id is not None:
            self._link_alert(investigation.id, alert_id, auto_link_events=True)

        self.db.commit()
        return self.get(investigation.id)

    def get(self, investigation_id: UUID) -> InvestigationModel:
        investigation = self.repository.get(investigation_id)
        if investigation is None:
            raise InvestigationNotFoundError("Investigation not found")
        return investigation

    def list(self, *, status: str | None = None, limit: int = 100) -> list[InvestigationModel]:
        if status is not None and status not in INVESTIGATION_STATUSES:
            raise InvestigationStateError("Invalid investigation status")
        return self.repository.list(status=status, limit=limit)

    def update(
        self,
        *,
        investigation_id: UUID,
        status: str | None = None,
        priority: str | None = None,
        assigned_to: str | None = None,
        description: str | None = None,
    ) -> InvestigationModel:
        investigation = self.get(investigation_id)

        if status is not None:
            if status not in INVESTIGATION_STATUSES:
                raise InvestigationStateError("Invalid investigation status")
            if status not in _ALLOWED_TRANSITIONS[investigation.status]:
                raise InvestigationStateError(
                    f"Invalid investigation transition: {investigation.status} -> {status}"
                )
            investigation.status = status
            now = datetime.now(timezone.utc)
            if status in {"CLOSED", "FALSE_POSITIVE"}:
                investigation.closed_at = investigation.closed_at or now
            elif status in {"IN_PROGRESS", "CONTAINED"}:
                investigation.started_at = investigation.started_at or now

        if priority is not None:
            if priority not in INVESTIGATION_PRIORITIES:
                raise InvestigationStateError("Invalid investigation priority")
            investigation.priority = priority
        if assigned_to is not None:
            investigation.assigned_to = assigned_to.strip() or None
        if description is not None:
            investigation.description = description.strip() or None

        self.db.commit()
        return self.get(investigation.id)

    def add_note(self, *, investigation_id: UUID, author: str, content: str) -> InvestigationNoteModel:
        self.get(investigation_id)
        if not author.strip() or not content.strip():
            raise InvestigationStateError("Note author and content are required")
        note = InvestigationNoteModel(
            id=uuid4(),
            investigation_id=investigation_id,
            author=author.strip(),
            content=content.strip(),
        )
        self.repository.add_note(note)
        self.db.commit()
        self.db.refresh(note)
        return note

    def list_notes(self, investigation_id: UUID) -> list[InvestigationNoteModel]:
        self.get(investigation_id)
        return self.repository.list_notes(investigation_id)

    def add_finding(
        self,
        *,
        investigation_id: UUID,
        finding_type: str,
        title: str,
        content: str,
        author: str,
    ) -> InvestigationFindingModel:
        self.get(investigation_id)
        if finding_type not in FINDING_TYPES:
            raise InvestigationStateError("Invalid finding type")
        if not title.strip() or not content.strip() or not author.strip():
            raise InvestigationStateError("Finding type, title, content and author are required")
        finding = InvestigationFindingModel(
            id=uuid4(),
            investigation_id=investigation_id,
            finding_type=finding_type,
            title=title.strip(),
            content=content.strip(),
            author=author.strip(),
        )
        self.repository.add_finding(finding)
        self.db.commit()
        self.db.refresh(finding)
        return finding

    def list_findings(self, investigation_id: UUID) -> list[InvestigationFindingModel]:
        self.get(investigation_id)
        return self.repository.list_findings(investigation_id)

    def link_alert(self, *, investigation_id: UUID, alert_id: UUID) -> InvestigationAlertModel:
        self.get(investigation_id)
        return self._link_alert(investigation_id, alert_id, auto_link_events=False, commit=True)

    def link_event(self, *, investigation_id: UUID, security_event_id: UUID) -> InvestigationEventModel:
        self.get(investigation_id)
        if self.db.get(SecurityEventModel, security_event_id) is None:
            raise InvestigationStateError("Security event not found")
        if self.repository.has_event(investigation_id, security_event_id):
            return self.repository.get_event_link(investigation_id, security_event_id)
        link = InvestigationEventModel(
            id=uuid4(),
            investigation_id=investigation_id,
            security_event_id=security_event_id,
            relationship_type="INVESTIGATIVE",
        )
        self.repository.add_event(link)
        self.db.commit()
        self.db.refresh(link)
        return link

    def list_alerts(self, investigation_id: UUID) -> list[InvestigationAlertModel]:
        self.get(investigation_id)
        return self.repository.list_alerts(investigation_id)

    def list_events(self, investigation_id: UUID) -> list[InvestigationEventModel]:
        self.get(investigation_id)
        return self.repository.list_events(investigation_id)

    def _link_alert(
        self,
        investigation_id: UUID,
        alert_id: UUID,
        *,
        auto_link_events: bool,
        commit: bool = False,
    ) -> InvestigationAlertModel:
        alert = self.db.get(AlertModel, alert_id)
        if alert is None:
            raise InvestigationStateError("Alert not found")
        existing = self.repository.get_alert_link(investigation_id, alert_id)
        if existing is not None:
            link = existing
        else:
            link = InvestigationAlertModel(
                id=uuid4(),
                investigation_id=investigation_id,
                alert_id=alert_id,
                relationship_type="PRIMARY" if auto_link_events else "RELATED",
            )
            self.repository.add_alert(link)
            self.db.flush()

        if auto_link_events:
            alert_events = self.db.query(AlertEventModel).filter(AlertEventModel.alert_id == alert_id).all()
            for alert_event in alert_events:
                if not self.repository.has_event(investigation_id, alert_event.security_event_id):
                    self.repository.add_event(
                        InvestigationEventModel(
                            id=uuid4(),
                            investigation_id=investigation_id,
                            security_event_id=alert_event.security_event_id,
                            relationship_type="ALERT_TRIGGERING",
                        )
                    )

        if commit:
            self.db.commit()
            self.db.refresh(link)
        return link
