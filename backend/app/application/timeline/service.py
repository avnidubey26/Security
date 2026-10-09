from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.timeline.models import TIMELINE_ENTRY_TYPES
from app.infrastructure.database.models import InvestigationEventModel, InvestigationModel, SecurityEventModel
from app.infrastructure.database.models.timeline import TimelineEntryModel
from app.infrastructure.repositories.timeline import TimelineRepository


class TimelineNotFoundError(LookupError):
    pass


class TimelineStateError(ValueError):
    pass


class TimelineService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = TimelineRepository(db)

    def list(self, investigation_id: UUID) -> list[TimelineEntryModel]:
        self._require_investigation(investigation_id)
        return self.repository.list(investigation_id)

    def get(self, entry_id: UUID) -> TimelineEntryModel:
        entry = self.repository.get(entry_id)
        if entry is None:
            raise TimelineNotFoundError("Timeline entry not found")
        return entry

    def create_from_event(
        self,
        *,
        investigation_id: UUID,
        security_event_id: UUID,
        entry_type: str | None = None,
        title: str | None = None,
        description: str | None = None,
        sequence_number: int | None = None,
    ) -> TimelineEntryModel:
        self._require_investigation(investigation_id)
        event = self.db.get(SecurityEventModel, security_event_id)
        if event is None:
            raise TimelineStateError("Security event not found")
        self._require_event_in_investigation(investigation_id, security_event_id)

        existing = self.repository.get_for_event(investigation_id, security_event_id)
        if existing is not None:
            return existing

        normalized_type = entry_type or self._derive_entry_type(event)
        if normalized_type not in TIMELINE_ENTRY_TYPES:
            raise TimelineStateError("Invalid timeline entry type")

        entry = self._build_entry(
            investigation_id=investigation_id,
            event=event,
            entry_type=normalized_type,
            title=title,
            description=description,
        )
        self.repository.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def rebuild(self, investigation_id: UUID) -> list[TimelineEntryModel]:
        self._require_investigation(investigation_id)
        links = self.db.scalars(
            select(InvestigationEventModel)
            .where(InvestigationEventModel.investigation_id == investigation_id)
            .order_by(InvestigationEventModel.created_at.asc(), InvestigationEventModel.id.asc())
        ).all()
        event_ids = [link.security_event_id for link in links]
        events = list(
            self.db.scalars(
                select(SecurityEventModel)
                .where(SecurityEventModel.id.in_(event_ids))
                .order_by(SecurityEventModel.timestamp.asc(), SecurityEventModel.id.asc())
            )
        ) if event_ids else []
        existing = {entry.security_event_id: entry for entry in self.repository.list(investigation_id) if entry.security_event_id}

        changed = False
        next_sequence = max((entry.sequence_number for entry in existing.values()), default=0) + 1
        for event in events:
            derived_type = self._derive_entry_type(event)
            derived_title = self._derive_title(event)
            derived_description = self._derive_description(event)
            derived_context = self._build_context(event)
            existing_entry = existing.get(event.id)

            if existing_entry is not None:
                # Rebuild is authoritative: refresh derived timeline metadata while
                # preserving the timeline entry identity and event provenance.
                if (
                    existing_entry.entry_type != derived_type
                    or existing_entry.title != derived_title
                    or existing_entry.description != derived_description
                    or existing_entry.occurred_at != event.timestamp
                    or existing_entry.source != event.source
                    or existing_entry.context != derived_context
                ):
                    existing_entry.entry_type = derived_type
                    existing_entry.title = derived_title
                    existing_entry.description = derived_description
                    existing_entry.occurred_at = event.timestamp
                    existing_entry.source = event.source
                    existing_entry.context = derived_context
                    changed = True
                continue

            self.repository.add(
                self._build_entry(
                    investigation_id=investigation_id,
                    event=event,
                    entry_type=derived_type,
                    title=derived_title,
                    description=derived_description,
                    sequence_number=next_sequence,
                )
            )
            next_sequence += 1
            changed = True

        if changed:
            self.db.commit()
        return self.repository.list(investigation_id)

    def _build_entry(
        self,
        *,
        investigation_id: UUID,
        event: SecurityEventModel,
        entry_type: str,
        title: str | None = None,
        description: str | None = None,
        sequence_number: int | None = None,
    ) -> TimelineEntryModel:
        return TimelineEntryModel(
            id=uuid4(),
            investigation_id=investigation_id,
            security_event_id=event.id,
            entry_type=entry_type,
            title=(title.strip() if title else self._derive_title(event)),
            description=(description.strip() if description else self._derive_description(event)),
            occurred_at=event.timestamp,
            sequence_number=sequence_number or self.repository.next_sequence(investigation_id),
            source=event.source,
            context=self._build_context(event),
        )

    def _require_investigation(self, investigation_id: UUID) -> InvestigationModel:
        investigation = self.db.get(InvestigationModel, investigation_id)
        if investigation is None:
            raise TimelineNotFoundError("Investigation not found")
        return investigation

    def _require_event_in_investigation(self, investigation_id: UUID, security_event_id: UUID) -> None:
        linked = self.db.scalar(
            select(InvestigationEventModel.id).where(
                InvestigationEventModel.investigation_id == investigation_id,
                InvestigationEventModel.security_event_id == security_event_id,
            )
        )
        if linked is None:
            raise TimelineStateError("Security event is not linked to the investigation")

    @staticmethod
    def _derive_entry_type(event: SecurityEventModel) -> str:
        event_type = event.event_type.lower()
        status = (event.status or "").lower()
        if "auth" in event_type:
            if status == "failed" or "failed" in event_type:
                return "AUTHENTICATION_FAILED"
            if status in {"success", "successful"} or "success" in event_type:
                return "AUTHENTICATION_SUCCESS"
        if "process" in event_type:
            return "PROCESS_EXECUTION"
        if "network" in event_type:
            return "NETWORK_ACTIVITY"
        if "file" in event_type:
            return "FILE_ACTIVITY"
        if "privilege" in event_type:
            return "PRIVILEGE_ACTIVITY"
        if "web" in event_type:
            return "WEB_ACTIVITY"
        return "OTHER"

    @staticmethod
    def _derive_title(event: SecurityEventModel) -> str:
        event_type = event.event_type.lower()
        status = (event.status or "").lower()
        if "auth" in event_type:
            if status == "failed" or "failed" in event_type:
                return "Failed authentication"
            if status in {"success", "successful"} or "success" in event_type:
                return "Successful authentication"
        labels = {
            "process_execution": "Process execution",
        }
        return labels.get(event_type, event.event_type.replace("_", " ").title())

    @staticmethod
    def _derive_description(event: SecurityEventModel) -> str:
        details: list[str] = []
        if event.source_user:
            details.append(f"user={event.source_user}")
        if event.source_ip:
            details.append(f"source_ip={event.source_ip}")
        if event.process:
            details.append(f"process={event.process}")
        if event.parent_process:
            details.append(f"parent_process={event.parent_process}")
        if event.resource:
            details.append(f"resource={event.resource}")
        if event.action:
            details.append(f"action={event.action}")
        return "; ".join(details) if details else f"Security event: {event.event_type}"

    @staticmethod
    def _build_context(event: SecurityEventModel) -> dict[str, object]:
        context: dict[str, object] = {}
        if event.status:
            context["status"] = event.status
        if event.hostname:
            context["hostname"] = event.hostname
        if event.destination_ip:
            context["destination_ip"] = event.destination_ip
        if event.destination_port is not None:
            context["destination_port"] = event.destination_port
        if event.metadata_json:
            context["metadata"] = event.metadata_json
        return context
