from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


INVESTIGATION_STATUSES = {
    "OPEN",
    "IN_PROGRESS",
    "CONTAINED",
    "CLOSED",
    "FALSE_POSITIVE",
}

INVESTIGATION_PRIORITIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
FINDING_TYPES = {"OBSERVATION", "ROOT_CAUSE", "IMPACT", "RECOMMENDATION"}


@dataclass(frozen=True)
class InvestigationSummary:
    id: UUID
    title: str
    status: str
    priority: str
    assigned_to: str | None
    created_at: datetime
