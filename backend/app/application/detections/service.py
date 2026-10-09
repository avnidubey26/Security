from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.application.alerts.service import AlertService
from app.application.detections.engine import DetectionDefinitionError, evaluate_detection
from app.domain.detections.models import DetectionEvent
from app.infrastructure.database.models import (
    DetectionResultModel,
    DetectionRuleModel,
    DetectionRuleVersionModel,
    SecurityEventModel,
)
from app.infrastructure.repositories.detections import DetectionRepository
from app.infrastructure.repositories.telemetry import TelemetryRepository


class DetectionRuleNotFoundError(LookupError):
    pass


class DetectionRuleVersionNotFoundError(LookupError):
    pass


class DetectionRuleConflictError(ValueError):
    pass


class DetectionService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.rules = DetectionRepository(db)
        self.telemetry = TelemetryRepository(db)
        self.alerts = AlertService(db)

    def list_rules(self) -> list[DetectionRuleModel]:
        return self.rules.list_rules()

    def create_rule(self, *, name: str, slug: str, description: str) -> DetectionRuleModel:
        if self.rules.get_rule_by_slug(slug) is not None:
            raise DetectionRuleConflictError("A detection rule with this slug already exists")
        rule = DetectionRuleModel(
            id=uuid4(),
            name=name,
            slug=slug,
            description=description,
            status="DRAFT",
        )
        self.rules.add_rule(rule)
        self.db.commit()
        self.db.refresh(rule)
        return rule

    def create_version(
        self,
        *,
        rule_id: UUID,
        definition: dict,
        severity: str,
        confidence: int,
        format: str = "sigma-inspired",
    ) -> DetectionRuleVersionModel:
        rule = self.rules.get_rule(rule_id)
        if rule is None:
            raise DetectionRuleNotFoundError("Detection rule not found")
        if not 0 <= confidence <= 100:
            raise DetectionDefinitionError("confidence must be between 0 and 100")
        self._validate_definition(definition)
        version = self.rules.next_version(rule_id)
        model = DetectionRuleVersionModel(
            id=uuid4(),
            detection_rule_id=rule_id,
            version=version,
            format=format,
            definition=definition,
            severity=severity,
            confidence=confidence,
            is_active=False,
        )
        self.rules.add_version(model)
        self.db.commit()
        self.db.refresh(model)
        return model

    def activate_version(self, *, rule_id: UUID, version: int) -> DetectionRuleVersionModel:
        rule = self.rules.get_rule(rule_id)
        if rule is None:
            raise DetectionRuleNotFoundError("Detection rule not found")
        target = self.rules.get_version(rule_id, version)
        if target is None:
            raise DetectionRuleVersionNotFoundError("Detection rule version not found")
        self.rules.deactivate_versions(rule_id)
        target.is_active = True
        target.activated_at = datetime.now(timezone.utc)
        rule.status = "ACTIVE"
        self.db.commit()
        self.db.refresh(target)
        return target

    def evaluate_version(
        self,
        *,
        rule_id: UUID,
        version: int,
        scenario_run_id: UUID | None = None,
        events: list[SecurityEventModel] | None = None,
    ) -> DetectionResultModel:
        rule_version = self.rules.get_version(rule_id, version)
        if rule_version is None:
            raise DetectionRuleVersionNotFoundError("Detection rule version not found")

        if events is None:
            events = self.telemetry.list_events(scenario_run_id=scenario_run_id, limit=1000)

        detection_events = [self._to_detection_event(event) for event in events]
        evaluation = evaluate_detection(events=detection_events, definition=rule_version.definition)

        result = DetectionResultModel(
            id=uuid4(),
            detection_rule_version_id=rule_version.id,
            evaluation_type=rule_version.definition["type"],
            matched=evaluation.matched,
            evaluated_at=datetime.now(timezone.utc),
            explanation=evaluation.explanation,
            matched_event_ids=[str(event_id) for event_id in evaluation.matched_event_ids],
            context=evaluation.context,
        )
        self.db.add(result)
        self.db.flush()

        if result.matched:
            self.alerts.build_from_detection_result(result)

        self.db.commit()
        self.db.refresh(result)
        return result

    @staticmethod
    def _validate_definition(definition: dict) -> None:
        if not isinstance(definition, dict):
            raise DetectionDefinitionError("Detection definition must be an object")
        if definition.get("type") not in {"match", "threshold", "sequence"}:
            raise DetectionDefinitionError("Detection type must be one of: match, threshold, sequence")
        if definition.get("type") == "threshold":
            if not isinstance(definition.get("count"), int) or definition["count"] <= 0:
                raise DetectionDefinitionError("threshold count must be a positive integer")
        if definition.get("type") == "sequence":
            if not isinstance(definition.get("steps"), list) or not definition["steps"]:
                raise DetectionDefinitionError("sequence steps must be a non-empty list")
        if "window_seconds" in definition and (
            not isinstance(definition["window_seconds"], int) or definition["window_seconds"] <= 0
        ):
            raise DetectionDefinitionError("window_seconds must be a positive integer")

    @staticmethod
    def _to_detection_event(event: SecurityEventModel) -> DetectionEvent:
        fields = {
            "event_type": event.event_type,
            "source": event.source,
            "source_user": event.source_user,
            "source_ip": event.source_ip,
            "destination_ip": event.destination_ip,
            "destination_port": event.destination_port,
            "process": event.process,
            "parent_process": event.parent_process,
            "action": event.action,
            "status": event.status,
            "hostname": event.hostname,
            "resource": event.resource,
            "metadata": event.metadata_json or {},
        }
        return DetectionEvent(id=event.id, timestamp=event.timestamp, fields=fields)
