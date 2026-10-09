from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.application.investigations.service import (
    InvestigationNotFoundError,
    InvestigationService,
    InvestigationStateError,
)
from app.application.timeline.service import TimelineNotFoundError, TimelineService, TimelineStateError

router = APIRouter(prefix="/investigations", tags=["investigations"])


class CreateInvestigationRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=10000)
    priority: str = Field(default="MEDIUM", pattern="^(LOW|MEDIUM|HIGH|CRITICAL)$")
    assigned_to: str | None = Field(default=None, max_length=150)
    alert_id: UUID | None = None


class UpdateInvestigationRequest(BaseModel):
    status: str | None = Field(default=None, pattern="^(OPEN|IN_PROGRESS|CONTAINED|CLOSED|FALSE_POSITIVE)$")
    priority: str | None = Field(default=None, pattern="^(LOW|MEDIUM|HIGH|CRITICAL)$")
    assigned_to: str | None = Field(default=None, max_length=150)
    description: str | None = Field(default=None, max_length=10000)


class NoteCreateRequest(BaseModel):
    author: str = Field(min_length=1, max_length=150)
    content: str = Field(min_length=1, max_length=20000)


class FindingCreateRequest(BaseModel):
    finding_type: str = Field(pattern="^(OBSERVATION|ROOT_CAUSE|IMPACT|RECOMMENDATION)$")
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1, max_length=20000)
    author: str = Field(min_length=1, max_length=150)


class LinkAlertRequest(BaseModel):
    alert_id: UUID


class LinkEventRequest(BaseModel):
    security_event_id: UUID


class TimelineEntryCreateRequest(BaseModel):
    security_event_id: UUID
    entry_type: str | None = Field(default=None, pattern="^(AUTHENTICATION_FAILED|AUTHENTICATION_SUCCESS|PROCESS_EXECUTION|NETWORK_ACTIVITY|FILE_ACTIVITY|PRIVILEGE_ACTIVITY|WEB_ACTIVITY|OTHER)$")
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=20000)


class TimelineEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    investigation_id: UUID
    security_event_id: UUID | None
    entry_type: str
    title: str
    description: str | None
    occurred_at: datetime
    sequence_number: int
    source: str | None
    context: dict | None
    created_at: datetime


class InvestigationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str | None
    status: str
    priority: str
    assigned_to: str | None
    started_at: datetime | None
    closed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class InvestigationAlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    alert_id: UUID
    relationship_type: str
    created_at: datetime


class InvestigationEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    security_event_id: UUID
    relationship_type: str
    created_at: datetime


class NoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    investigation_id: UUID
    author: str
    content: str
    created_at: datetime
    updated_at: datetime


class FindingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    investigation_id: UUID
    finding_type: str
    title: str
    content: str
    author: str
    created_at: datetime
    updated_at: datetime


class InvestigationDetailResponse(InvestigationResponse):
    alerts: list[InvestigationAlertResponse] = Field(default_factory=list)
    events: list[InvestigationEventResponse] = Field(default_factory=list)
    notes: list[NoteResponse] = Field(default_factory=list)
    findings: list[FindingResponse] = Field(default_factory=list)
    timeline: list[TimelineEntryResponse] = Field(default_factory=list)


def _detail(investigation) -> InvestigationDetailResponse:
    return InvestigationDetailResponse(
        **InvestigationResponse.model_validate(investigation).model_dump(),
        alerts=[InvestigationAlertResponse.model_validate(item) for item in investigation.alerts],
        events=[InvestigationEventResponse.model_validate(item) for item in investigation.events],
        notes=[NoteResponse.model_validate(item) for item in investigation.notes],
        findings=[FindingResponse.model_validate(item) for item in investigation.findings],
        timeline=[TimelineEntryResponse.model_validate(item) for item in getattr(investigation, "timeline_entries", [])],
    )


@router.post("", response_model=dict, status_code=201)
def create_investigation(request: CreateInvestigationRequest, db: Session = Depends(get_db)):
    try:
        investigation = InvestigationService(db).create(
            title=request.title,
            description=request.description,
            priority=request.priority,
            assigned_to=request.assigned_to,
            alert_id=request.alert_id,
        )
    except InvestigationStateError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"data": InvestigationResponse.model_validate(investigation)}


@router.get("", response_model=dict)
def list_investigations(
    investigation_status: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=100, ge=1, le=100),
    db: Session = Depends(get_db),
):
    try:
        investigations = InvestigationService(db).list(status=investigation_status, limit=limit)
    except InvestigationStateError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"data": [InvestigationResponse.model_validate(item) for item in investigations]}


@router.get("/{investigation_id}", response_model=dict)
def get_investigation(investigation_id: UUID, db: Session = Depends(get_db)):
    try:
        investigation = InvestigationService(db).get(investigation_id)
    except InvestigationNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"data": _detail(investigation)}


@router.patch("/{investigation_id}", response_model=dict)
def update_investigation(
    investigation_id: UUID,
    request: UpdateInvestigationRequest,
    db: Session = Depends(get_db),
):
    try:
        investigation = InvestigationService(db).update(
            investigation_id=investigation_id,
            status=request.status,
            priority=request.priority,
            assigned_to=request.assigned_to,
            description=request.description,
        )
    except InvestigationNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except InvestigationStateError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"data": InvestigationResponse.model_validate(investigation)}


@router.post("/{investigation_id}/notes", response_model=dict, status_code=201)
def add_note(investigation_id: UUID, request: NoteCreateRequest, db: Session = Depends(get_db)):
    try:
        note = InvestigationService(db).add_note(
            investigation_id=investigation_id, author=request.author, content=request.content
        )
    except InvestigationNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except InvestigationStateError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"data": NoteResponse.model_validate(note)}


@router.get("/{investigation_id}/notes", response_model=dict)
def list_notes(investigation_id: UUID, db: Session = Depends(get_db)):
    try:
        notes = InvestigationService(db).list_notes(investigation_id)
    except InvestigationNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"data": [NoteResponse.model_validate(item) for item in notes]}


@router.post("/{investigation_id}/findings", response_model=dict, status_code=201)
def add_finding(investigation_id: UUID, request: FindingCreateRequest, db: Session = Depends(get_db)):
    try:
        finding = InvestigationService(db).add_finding(
            investigation_id=investigation_id,
            finding_type=request.finding_type,
            title=request.title,
            content=request.content,
            author=request.author,
        )
    except InvestigationNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except InvestigationStateError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"data": FindingResponse.model_validate(finding)}


@router.get("/{investigation_id}/findings", response_model=dict)
def list_findings(investigation_id: UUID, db: Session = Depends(get_db)):
    try:
        findings = InvestigationService(db).list_findings(investigation_id)
    except InvestigationNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"data": [FindingResponse.model_validate(item) for item in findings]}


@router.post("/{investigation_id}/alerts", response_model=dict, status_code=201)
def link_alert(investigation_id: UUID, request: LinkAlertRequest, db: Session = Depends(get_db)):
    try:
        link = InvestigationService(db).link_alert(
            investigation_id=investigation_id, alert_id=request.alert_id
        )
    except InvestigationNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except InvestigationStateError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"data": InvestigationAlertResponse.model_validate(link)}


@router.get("/{investigation_id}/alerts", response_model=dict)
def list_alerts(investigation_id: UUID, db: Session = Depends(get_db)):
    try:
        alerts = InvestigationService(db).list_alerts(investigation_id)
    except InvestigationNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"data": [InvestigationAlertResponse.model_validate(item) for item in alerts]}


@router.post("/{investigation_id}/events", response_model=dict, status_code=201)
def link_event(investigation_id: UUID, request: LinkEventRequest, db: Session = Depends(get_db)):
    try:
        link = InvestigationService(db).link_event(
            investigation_id=investigation_id, security_event_id=request.security_event_id
        )
    except InvestigationNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except InvestigationStateError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"data": InvestigationEventResponse.model_validate(link)}


@router.get("/{investigation_id}/events", response_model=dict)
def list_events(investigation_id: UUID, db: Session = Depends(get_db)):
    try:
        events = InvestigationService(db).list_events(investigation_id)
    except InvestigationNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"data": [InvestigationEventResponse.model_validate(item) for item in events]}


@router.post("/{investigation_id}/timeline", response_model=dict, status_code=201)
def create_timeline_entry(
    investigation_id: UUID, request: TimelineEntryCreateRequest, db: Session = Depends(get_db)
):
    try:
        entry = TimelineService(db).create_from_event(
            investigation_id=investigation_id,
            security_event_id=request.security_event_id,
            entry_type=request.entry_type,
            title=request.title,
            description=request.description,
        )
    except TimelineNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except TimelineStateError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"data": TimelineEntryResponse.model_validate(entry)}


@router.post("/{investigation_id}/timeline/rebuild", response_model=dict, status_code=200)
def rebuild_timeline(investigation_id: UUID, db: Session = Depends(get_db)):
    try:
        entries = TimelineService(db).rebuild(investigation_id)
    except TimelineNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"data": [TimelineEntryResponse.model_validate(item) for item in entries]}


@router.get("/{investigation_id}/timeline", response_model=dict)
def list_timeline(investigation_id: UUID, db: Session = Depends(get_db)):
    try:
        entries = TimelineService(db).list(investigation_id)
    except TimelineNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"data": [TimelineEntryResponse.model_validate(item) for item in entries]}


@router.get("/{investigation_id}/timeline/{timeline_entry_id}", response_model=dict)
def get_timeline_entry(
    investigation_id: UUID, timeline_entry_id: UUID, db: Session = Depends(get_db)
):
    try:
        entry = TimelineService(db).get(timeline_entry_id)
    except TimelineNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if entry.investigation_id != investigation_id:
        raise HTTPException(status_code=404, detail="Timeline entry not found")
    return {"data": TimelineEntryResponse.model_validate(entry)}
