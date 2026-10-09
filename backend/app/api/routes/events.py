from datetime import datetime
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from app.api.dependencies import get_db
from app.infrastructure.repositories.telemetry import TelemetryRepository

router = APIRouter(prefix="/events", tags=["events"])

class SecurityEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    raw_telemetry_id: UUID | None
    timestamp: datetime
    event_type: str
    source: str
    source_user: str | None
    source_ip: str | None
    destination_ip: str | None
    destination_port: int | None
    process: str | None
    parent_process: str | None
    action: str | None
    status: str | None
    hostname: str | None
    resource: str | None
    metadata_json: dict | None

@router.get("")
def list_events(scenario_run_id: UUID | None = Query(default=None), limit: int = Query(default=100, ge=1, le=100), db: Session = Depends(get_db)):
    events = TelemetryRepository(db).list_events(scenario_run_id=scenario_run_id, limit=limit)
    return {"data": [SecurityEventResponse.model_validate(event) for event in events]}
