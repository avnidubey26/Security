from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.domain.alerts.models import ALERT_STATUSES
from app.infrastructure.database.models import (
    AlertEventModel,
    AlertModel,
    DetectionResultModel,
    DetectionRuleVersionModel,
    SecurityEventModel,
)
from app.infrastructure.repositories.alerts import AlertRepository


class AlertNotFoundError(LookupError):
    pass


class AlertStateError(ValueError):
    pass


class AlertService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.alerts = AlertRepository(db)

    def build_from_detection_result(self, result: DetectionResultModel) -> AlertModel | None:
        if not result.matched:
            return None

        existing = self.alerts.get_by_detection_result(result.id)
        if existing is not None:
            return existing

        rule_version = self.db.get(DetectionRuleVersionModel, result.detection_rule_version_id)
        if rule_version is None:
            raise AlertStateError("Detection rule version not found for detection result")

        title = "Security detection matched"
        if isinstance(result.explanation, dict):
            title = str(result.explanation.get("title") or title)

        alert = AlertModel(
            id=uuid4(),
            detection_result_id=result.id,
            detection_rule_version_id=result.detection_rule_version_id,
            title=title,
            severity=rule_version.severity,
            confidence=rule_version.confidence,
            status="NEW",
            explanation=result.explanation,
            context=result.context,
        )
        self.alerts.add(alert)

        for event_id in result.matched_event_ids:
            try:
                event_uuid = UUID(event_id)
            except ValueError as exc:
                raise AlertStateError("Detection result contains an invalid event ID") from exc
            if self.db.get(SecurityEventModel, event_uuid) is None:
                raise AlertStateError("Detection result references an unknown security event")
            self.alerts.add_event(
                AlertEventModel(
                    id=uuid4(),
                    alert_id=alert.id,
                    security_event_id=event_uuid,
                    relationship_type="TRIGGERING",
                )
            )
        return alert

    def get(self, alert_id: UUID) -> AlertModel:
        alert = self.alerts.get(alert_id)
        if alert is None:
            raise AlertNotFoundError("Alert not found")
        return alert

    def list(self, *, status: str | None = None, limit: int = 100) -> list[AlertModel]:
        if status is not None and status not in ALERT_STATUSES:
            raise AlertStateError("Invalid alert status")
        return self.alerts.list(status=status, limit=limit)

    def update_status(self, *, alert_id: UUID, status: str) -> AlertModel:
        if status not in ALERT_STATUSES:
            raise AlertStateError("Invalid alert status")
        alert = self.get(alert_id)
        now = datetime.now(timezone.utc)
        if alert.status in {"RESOLVED", "DISMISSED"} and status != alert.status:
            raise AlertStateError("A closed alert cannot transition to another status")
        alert.status = status
        if status == "ACKNOWLEDGED":
            alert.acknowledged_at = alert.acknowledged_at or now
        if status == "RESOLVED":
            alert.resolved_at = alert.resolved_at or now
        self.db.commit()
        self.db.refresh(alert)
        return alert
