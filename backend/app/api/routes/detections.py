from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.application.detections.engine import DetectionDefinitionError
from app.application.detections.service import (
    DetectionRuleConflictError,
    DetectionRuleNotFoundError,
    DetectionRuleVersionNotFoundError,
    DetectionService,
)

router = APIRouter(prefix="/detection-rules", tags=["detections"])


class DetectionRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    slug: str
    description: str
    status: str
    created_at: datetime
    updated_at: datetime


class CreateDetectionRuleRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=120, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    description: str = Field(min_length=1, max_length=2000)


class DetectionRuleVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    detection_rule_id: UUID
    version: int
    format: str
    definition: dict
    severity: str
    confidence: int
    is_active: bool
    created_at: datetime
    activated_at: datetime | None


class CreateDetectionRuleVersionRequest(BaseModel):
    definition: dict
    severity: str = Field(min_length=1, max_length=20)
    confidence: int = Field(ge=0, le=100)
    format: str = Field(default="sigma-inspired", min_length=1, max_length=50)


class EvaluateDetectionRequest(BaseModel):
    scenario_run_id: UUID | None = None


class DetectionResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    detection_rule_version_id: UUID
    evaluation_type: str
    matched: bool
    evaluated_at: datetime
    explanation: dict
    matched_event_ids: list[str]
    context: dict


@router.get("")
def list_detection_rules(db: Session = Depends(get_db)):
    return {"data": [DetectionRuleResponse.model_validate(rule) for rule in DetectionService(db).list_rules()]}


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_detection_rule(
    request: CreateDetectionRuleRequest,
    db: Session = Depends(get_db),
):
    try:
        rule = DetectionService(db).create_rule(
            name=request.name,
            slug=request.slug,
            description=request.description,
        )
    except DetectionRuleConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"data": DetectionRuleResponse.model_validate(rule)}


@router.get("/{rule_id}", response_model=dict)
def get_detection_rule(rule_id: UUID, db: Session = Depends(get_db)):
    service = DetectionService(db)
    rule = service.rules.get_rule(rule_id)
    if rule is None:
        raise HTTPException(status_code=404, detail="Detection rule not found")
    versions = service.rules.list_versions(rule_id)
    return {
        "data": {
            **DetectionRuleResponse.model_validate(rule).model_dump(mode="json"),
            "versions": [DetectionRuleVersionResponse.model_validate(item) for item in versions],
        }
    }


@router.post("/{rule_id}/versions", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_detection_rule_version(
    rule_id: UUID,
    request: CreateDetectionRuleVersionRequest,
    db: Session = Depends(get_db),
):
    try:
        version = DetectionService(db).create_version(
            rule_id=rule_id,
            definition=request.definition,
            severity=request.severity,
            confidence=request.confidence,
            format=request.format,
        )
    except DetectionRuleNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except DetectionDefinitionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"data": DetectionRuleVersionResponse.model_validate(version)}


@router.post("/{rule_id}/versions/{version}/activate", response_model=dict)
def activate_detection_rule_version(
    rule_id: UUID,
    version: int,
    db: Session = Depends(get_db),
):
    try:
        activated = DetectionService(db).activate_version(rule_id=rule_id, version=version)
    except DetectionRuleNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except DetectionRuleVersionNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"data": DetectionRuleVersionResponse.model_validate(activated)}


@router.post("/{rule_id}/versions/{version}/evaluate", response_model=dict)
def evaluate_detection_rule_version(
    rule_id: UUID,
    version: int,
    request: EvaluateDetectionRequest,
    db: Session = Depends(get_db),
):
    try:
        result = DetectionService(db).evaluate_version(
            rule_id=rule_id,
            version=version,
            scenario_run_id=request.scenario_run_id,
        )
    except DetectionRuleVersionNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except DetectionDefinitionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"data": DetectionResultResponse.model_validate(result)}


@router.get("/{rule_id}/results", response_model=dict)
def list_detection_results(
    rule_id: UUID,
    limit: int = Query(default=100, ge=1, le=100),
    db: Session = Depends(get_db),
):
    service = DetectionService(db)
    if service.rules.get_rule(rule_id) is None:
        raise HTTPException(status_code=404, detail="Detection rule not found")
    results = service.rules.list_results(rule_id, limit=limit)
    return {"data": [DetectionResultResponse.model_validate(result) for result in results]}
