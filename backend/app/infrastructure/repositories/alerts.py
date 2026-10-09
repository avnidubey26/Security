from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.infrastructure.database.models import AlertEventModel, AlertModel


class AlertRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def add(self, alert: AlertModel) -> None:
        self.db.add(alert)

    def add_event(self, event: AlertEventModel) -> None:
        self.db.add(event)

    def get(self, alert_id: UUID) -> AlertModel | None:
        return self.db.scalar(
            select(AlertModel)
            .options(selectinload(AlertModel.events))
            .where(AlertModel.id == alert_id)
        )

    def get_by_detection_result(self, detection_result_id: UUID) -> AlertModel | None:
        return self.db.scalar(
            select(AlertModel).where(AlertModel.detection_result_id == detection_result_id)
        )

    def list(self, *, status: str | None = None, limit: int = 100) -> list[AlertModel]:
        statement = select(AlertModel).order_by(AlertModel.created_at.desc(), AlertModel.id.desc()).limit(limit)
        if status is not None:
            statement = statement.where(AlertModel.status == status)
        return list(self.db.scalars(statement))
