from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.infrastructure.database.models import RawTelemetryModel, SecurityEventModel


class TelemetryRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def add_raw(self, telemetry: RawTelemetryModel) -> RawTelemetryModel:
        self.db.add(telemetry)
        return telemetry

    def add_event(self, event: SecurityEventModel) -> SecurityEventModel:
        self.db.add(event)
        return event

    def list_events(self, *, scenario_run_id: UUID | None = None, limit: int = 100) -> list[SecurityEventModel]:
        statement = select(SecurityEventModel).join(RawTelemetryModel, SecurityEventModel.raw_telemetry_id == RawTelemetryModel.id).order_by(SecurityEventModel.timestamp, SecurityEventModel.id).limit(limit)
        if scenario_run_id is not None:
            statement = statement.where(RawTelemetryModel.scenario_run_id == scenario_run_id)
        return list(self.db.scalars(statement))
