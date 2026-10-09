from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.application.alerts.service import AlertNotFoundError, AlertService, AlertStateError

router = APIRouter(prefix="/alerts", tags=["alerts"])


class AlertEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    security_event_id: UUID
    relationship_type: str


class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    detection_result_id: UUID
    detection_rule_version_id: UUID
    title: str
    severity: str
    confidence: int
    status: str
    explanation: dict
    context: dict
    created_at: datetime
    updated_at: datetime
    acknowledged_at: datetime | None
    resolved_at: datetime | None


class AlertDetailResponse(AlertResponse):
    events: list[AlertEventResponse] = Field(default_factory=list)


class UpdateAlertStatusRequest(BaseModel):
    status: str = Field(pattern="^(NEW|ACKNOWLEDGED|RESOLVED|DISMISSED)$")


def _detail(alert) -> AlertDetailResponse:
    return AlertDetailResponse(
        **AlertResponse.model_validate(alert).model_dump(),
        events=[AlertEventResponse.model_validate(event) for event in alert.events],
    )


@router.get("", response_model=dict)
def list_alerts(
    alert_status: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=100, ge=1, le=100),
    db: Session = Depends(get_db),
):
    try:
        alerts = AlertService(db).list(status=alert_status, limit=limit)
    except AlertStateError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"data": [AlertResponse.model_validate(alert) for alert in alerts]}


@router.get("/{alert_id}", response_model=dict)
def get_alert(alert_id: UUID, db: Session = Depends(get_db)):
    try:
        alert = AlertService(db).get(alert_id)
    except AlertNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"data": _detail(alert)}


@router.patch("/{alert_id}", response_model=dict)
def update_alert(
    alert_id: UUID,
    request: UpdateAlertStatusRequest,
    db: Session = Depends(get_db),
):
    try:
        alert = AlertService(db).update_status(alert_id=alert_id, status=request.status)
    except AlertNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except AlertStateError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"data": AlertResponse.model_validate(alert)}


@router.post("/{alert_id}/acknowledge", response_model=dict)
def acknowledge_alert(alert_id: UUID, db: Session = Depends(get_db)):
    try:
        alert = AlertService(db).update_status(alert_id=alert_id, status="ACKNOWLEDGED")
    except AlertNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except AlertStateError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"data": AlertResponse.model_validate(alert)}


@router.post("/{alert_id}/resolve", response_model=dict)
def resolve_alert(alert_id: UUID, db: Session = Depends(get_db)):
    try:
        alert = AlertService(db).update_status(alert_id=alert_id, status="RESOLVED")
    except AlertNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except AlertStateError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"data": AlertResponse.model_validate(alert)}


@router.post("/{alert_id}/dismiss", response_model=dict)
def dismiss_alert(alert_id: UUID, db: Session = Depends(get_db)):
    try:
        alert = AlertService(db).update_status(alert_id=alert_id, status="DISMISSED")
    except AlertNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except AlertStateError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"data": AlertResponse.model_validate(alert)}
