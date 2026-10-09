from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.infrastructure.database.models.timeline import TimelineEntryModel


class TimelineRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def add(self, entry: TimelineEntryModel) -> None:
        self.db.add(entry)

    def get(self, entry_id: UUID) -> TimelineEntryModel | None:
        return self.db.get(TimelineEntryModel, entry_id)

    def get_for_event(self, investigation_id: UUID, security_event_id: UUID) -> TimelineEntryModel | None:
        return self.db.scalar(
            select(TimelineEntryModel).where(
                TimelineEntryModel.investigation_id == investigation_id,
                TimelineEntryModel.security_event_id == security_event_id,
            )
        )

    def list(self, investigation_id: UUID) -> list[TimelineEntryModel]:
        statement = (
            select(TimelineEntryModel)
            .where(TimelineEntryModel.investigation_id == investigation_id)
            .order_by(
                TimelineEntryModel.occurred_at.asc(),
                TimelineEntryModel.sequence_number.asc(),
                TimelineEntryModel.id.asc(),
            )
        )
        return list(self.db.scalars(statement))

    def next_sequence(self, investigation_id: UUID) -> int:
        current = self.db.scalar(
            select(func.max(TimelineEntryModel.sequence_number)).where(
                TimelineEntryModel.investigation_id == investigation_id
            )
        )
        return (current or 0) + 1
