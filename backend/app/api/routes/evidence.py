from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.application.evidence.service import EvidenceError, EvidenceNotFoundError, EvidenceService

router = APIRouter(prefix="/evidence", tags=["evidence"])


class EvidenceCollectRequest(BaseModel):
    investigation_id: UUID
    source_type: str = Field(pattern="^(ALERT|DETECTION_RESULT|SECURITY_EVENT|TIMELINE_ENTRY|INVESTIGATION_NOTE|INVESTIGATION_FINDING)$")
    source_id: UUID
    collected_by: str = Field(min_length=1, max_length=150)
    title: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=10000)


class EvidenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    investigation_id: UUID
    evidence_type: str
    source_type: str
    source_id: UUID
    title: str
    description: str | None
    snapshot: dict
    provenance: dict
    integrity_hash: str
    collected_by: str
    collected_at: datetime
    created_at: datetime


@router.post("", response_model=dict, status_code=201)
def collect_evidence(request: EvidenceCollectRequest, db: Session = Depends(get_db)):
    try:
        evidence = EvidenceService(db).collect(
            investigation_id=request.investigation_id,
            source_type=request.source_type,
            source_id=request.source_id,
            collected_by=request.collected_by,
            title=request.title,
            description=request.description,
        )
    except EvidenceError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"data": EvidenceResponse.model_validate(evidence)}


@router.get("/investigations/{investigation_id}", response_model=dict)
def list_investigation_evidence(investigation_id: UUID, db: Session = Depends(get_db)):
    try:
        records = EvidenceService(db).list_for_investigation(investigation_id)
    except EvidenceError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"data": [EvidenceResponse.model_validate(item) for item in records]}


@router.get("/{evidence_id}", response_model=dict)
def get_evidence(evidence_id: UUID, db: Session = Depends(get_db)):
    try:
        evidence = EvidenceService(db).get(evidence_id)
    except EvidenceNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"data": EvidenceResponse.model_validate(evidence)}


@router.post("/{evidence_id}/verify", response_model=dict)
def verify_evidence(evidence_id: UUID, db: Session = Depends(get_db)):
    try:
        verified = EvidenceService(db).verify_integrity(evidence_id)
    except EvidenceNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"data": {"evidence_id": evidence_id, "integrity_verified": verified}}
