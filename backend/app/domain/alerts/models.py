from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


ALERT_STATUSES = {"NEW", "ACKNOWLEDGED", "RESOLVED", "DISMISSED"}


@dataclass(frozen=True)
class AlertSummary:
    id: UUID
    detection_result_id: UUID
    detection_rule_version_id: UUID
    severity: str
    confidence: int
    status: str
    created_at: datetime
