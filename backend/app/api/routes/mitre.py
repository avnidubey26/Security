from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.application.mitre.service import MitreNotFoundError, MitreService, MitreStateError

router = APIRouter(prefix="/mitre", tags=["mitre"])


class TechniqueResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    tactic_id: str
    parent_technique_id: str | None
    name: str
    description: str | None
    domain: str
    platforms: list | None
    version: str | None
    last_modified: str | None


class MappingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    technique_id: str
    rationale: str | None
    created_at: datetime


class MappingRequest(BaseModel):
    technique_id: str = Field(min_length=3, max_length=20)
    rationale: str | None = Field(default=None, max_length=5000)


@router.get("/techniques", response_model=dict)
def list_techniques(db: Session = Depends(get_db)):
    return {"data": [TechniqueResponse.model_validate(item) for item in MitreService(db).list_techniques()]}


@router.get("/investigations/{investigation_id}/mappings", response_model=dict)
def investigation_mappings(investigation_id: UUID, db: Session = Depends(get_db)):
    try:
        items = MitreService(db).list_investigation_mappings(investigation_id)
    except MitreNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"data": [MappingResponse.model_validate(item) for item in items]}


@router.post("/investigations/{investigation_id}/auto-map", response_model=dict)
def auto_map_investigation(investigation_id: UUID, db: Session = Depends(get_db)):
    try:
        items, mapped = MitreService(db).auto_map_investigation(investigation_id)
    except MitreNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"data": [MappingResponse.model_validate(item) for item in items], "mapped_techniques": sorted(mapped)}


@router.get("/timeline/{timeline_entry_id}/mappings", response_model=dict)
def timeline_mappings(timeline_entry_id: UUID, db: Session = Depends(get_db)):
    try:
        items = MitreService(db).list_timeline_mappings(timeline_entry_id)
    except MitreNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"data": [MappingResponse.model_validate(item) for item in items]}


@router.post("/timeline/{timeline_entry_id}/mappings", response_model=dict, status_code=201)
def map_timeline(timeline_entry_id: UUID, request: MappingRequest, db: Session = Depends(get_db)):
    try:
        item = MitreService(db).map_timeline_entry(timeline_entry_id, request.technique_id, request.rationale)
    except MitreNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except MitreStateError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"data": MappingResponse.model_validate(item)}


@router.get("/detection-rule-versions/{version_id}/mappings", response_model=dict)
def detection_mappings(version_id: UUID, db: Session = Depends(get_db)):
    try:
        items = MitreService(db).list_detection_mappings(version_id)
    except MitreNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"data": [MappingResponse.model_validate(item) for item in items]}


@router.post("/detection-rule-versions/{version_id}/auto-map", response_model=dict)
def auto_map_detection(version_id: UUID, db: Session = Depends(get_db)):
    try:
        items = MitreService(db).auto_map_detection_rule_version(version_id)
    except MitreNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"data": [MappingResponse.model_validate(item) for item in items]}


@router.post("/detection-rule-versions/{version_id}/mappings", response_model=dict, status_code=201)
def map_detection(version_id: UUID, request: MappingRequest, db: Session = Depends(get_db)):
    try:
        item = MitreService(db).map_detection_rule_version(version_id, request.technique_id, request.rationale)
    except MitreNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except MitreStateError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"data": MappingResponse.model_validate(item)}
