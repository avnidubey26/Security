from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.application.incidents.service import IncidentNotFoundError, IncidentService, IncidentStateError

router = APIRouter(prefix="/incidents", tags=["incidents"])


class CreateIncidentRequest(BaseModel):
    investigation_id: UUID
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=10000)
    severity: str = Field(default="MEDIUM", pattern="^(LOW|MEDIUM|HIGH|CRITICAL)$")
    assigned_to: str | None = Field(default=None, max_length=150)


class UpdateIncidentRequest(BaseModel):
    status: str | None = Field(default=None, pattern="^(OPEN|CONTAINED|RESOLVED|CLOSED|FALSE_POSITIVE)$")
    severity: str | None = Field(default=None, pattern="^(LOW|MEDIUM|HIGH|CRITICAL)$")
    assigned_to: str | None = Field(default=None, max_length=150)
    description: str | None = Field(default=None, max_length=10000)


class LinkEvidenceRequest(BaseModel):
    evidence_id: UUID


class IncidentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    incident_number: str
    investigation_id: UUID
    title: str
    description: str | None
    severity: str
    status: str
    assigned_to: str | None
    detected_at: datetime | None
    contained_at: datetime | None
    resolved_at: datetime | None
    closed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class IncidentAlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    alert_id: UUID
    relationship_type: str
    created_at: datetime


class IncidentEvidenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    evidence_id: UUID
    created_at: datetime


def _detail(incident) -> dict:
    return {
        **IncidentResponse.model_validate(incident).model_dump(),
        "alerts": [IncidentAlertResponse.model_validate(item) for item in incident.alerts],
        "evidence": [IncidentEvidenceResponse.model_validate(item) for item in incident.evidence],
    }


@router.post("", response_model=dict, status_code=201)
def create_incident(request: CreateIncidentRequest, db: Session = Depends(get_db)):
    try:
        incident = IncidentService(db).create(
            investigation_id=request.investigation_id,
            title=request.title,
            description=request.description,
            severity=request.severity,
            assigned_to=request.assigned_to,
        )
    except IncidentStateError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"data": IncidentResponse.model_validate(incident)}


@router.get("", response_model=dict)
def list_incidents(
    status: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=100),
    db: Session = Depends(get_db),
):
    try:
        incidents = IncidentService(db).list(status=status, limit=limit)
    except IncidentStateError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"data": [IncidentResponse.model_validate(item) for item in incidents]}


@router.get("/{incident_id}", response_model=dict)
def get_incident(incident_id: UUID, db: Session = Depends(get_db)):
    try:
        incident = IncidentService(db).get(incident_id)
    except IncidentNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"data": _detail(incident)}


@router.patch("/{incident_id}", response_model=dict)
def update_incident(incident_id: UUID, request: UpdateIncidentRequest, db: Session = Depends(get_db)):
    try:
        incident = IncidentService(db).update(
            incident_id=incident_id,
            status=request.status,
            severity=request.severity,
            assigned_to=request.assigned_to,
            description=request.description,
        )
    except IncidentNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except IncidentStateError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"data": IncidentResponse.model_validate(incident)}


@router.post("/{incident_id}/evidence", response_model=dict, status_code=201)
def link_evidence(incident_id: UUID, request: LinkEvidenceRequest, db: Session = Depends(get_db)):
    try:
        link = IncidentService(db).link_evidence(incident_id=incident_id, evidence_id=request.evidence_id)
    except IncidentNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except IncidentStateError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"data": IncidentEvidenceResponse.model_validate(link)}
