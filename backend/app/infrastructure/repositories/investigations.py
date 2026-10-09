from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.infrastructure.database.models.investigations import (
    InvestigationAlertModel,
    InvestigationEventModel,
    InvestigationFindingModel,
    InvestigationModel,
    InvestigationNoteModel,
)


class InvestigationRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def add(self, investigation: InvestigationModel) -> None:
        self.db.add(investigation)

    def get(self, investigation_id: UUID) -> InvestigationModel | None:
        return self.db.scalar(
            select(InvestigationModel)
            .options(
                selectinload(InvestigationModel.alerts),
                selectinload(InvestigationModel.events),
                selectinload(InvestigationModel.notes),
                selectinload(InvestigationModel.findings),
                selectinload(InvestigationModel.timeline_entries),
            )
            .where(InvestigationModel.id == investigation_id)
        )

    def list(self, *, status: str | None = None, limit: int = 100) -> list[InvestigationModel]:
        statement = (
            select(InvestigationModel)
            .order_by(InvestigationModel.created_at.desc(), InvestigationModel.id.desc())
            .limit(limit)
        )
        if status is not None:
            statement = statement.where(InvestigationModel.status == status)
        return list(self.db.scalars(statement))

    def add_note(self, note: InvestigationNoteModel) -> None:
        self.db.add(note)

    def list_notes(self, investigation_id: UUID) -> list[InvestigationNoteModel]:
        statement = (
            select(InvestigationNoteModel)
            .where(InvestigationNoteModel.investigation_id == investigation_id)
            .order_by(InvestigationNoteModel.created_at.asc(), InvestigationNoteModel.id.asc())
        )
        return list(self.db.scalars(statement))

    def add_finding(self, finding: InvestigationFindingModel) -> None:
        self.db.add(finding)

    def list_findings(self, investigation_id: UUID) -> list[InvestigationFindingModel]:
        statement = (
            select(InvestigationFindingModel)
            .where(InvestigationFindingModel.investigation_id == investigation_id)
            .order_by(InvestigationFindingModel.created_at.asc(), InvestigationFindingModel.id.asc())
        )
        return list(self.db.scalars(statement))

    def add_alert(self, link: InvestigationAlertModel) -> None:
        self.db.add(link)

    def get_alert_link(self, investigation_id: UUID, alert_id: UUID) -> InvestigationAlertModel | None:
        return self.db.scalar(
            select(InvestigationAlertModel).where(
                InvestigationAlertModel.investigation_id == investigation_id,
                InvestigationAlertModel.alert_id == alert_id,
            )
        )

    def list_alerts(self, investigation_id: UUID) -> list[InvestigationAlertModel]:
        statement = (
            select(InvestigationAlertModel)
            .where(InvestigationAlertModel.investigation_id == investigation_id)
            .order_by(InvestigationAlertModel.created_at.asc(), InvestigationAlertModel.id.asc())
        )
        return list(self.db.scalars(statement))

    def add_event(self, link: InvestigationEventModel) -> None:
        self.db.add(link)

    def has_event(self, investigation_id: UUID, security_event_id: UUID) -> bool:
        return self.get_event_link(investigation_id, security_event_id) is not None

    def get_event_link(self, investigation_id: UUID, security_event_id: UUID) -> InvestigationEventModel | None:
        return self.db.scalar(
            select(InvestigationEventModel).where(
                InvestigationEventModel.investigation_id == investigation_id,
                InvestigationEventModel.security_event_id == security_event_id,
            )
        )

    def list_events(self, investigation_id: UUID) -> list[InvestigationEventModel]:
        statement = (
            select(InvestigationEventModel)
            .where(InvestigationEventModel.investigation_id == investigation_id)
            .order_by(InvestigationEventModel.created_at.asc(), InvestigationEventModel.id.asc())
        )
        return list(self.db.scalars(statement))
