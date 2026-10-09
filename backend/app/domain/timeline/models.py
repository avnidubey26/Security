from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


TIMELINE_ENTRY_TYPES = {
    "AUTHENTICATION_FAILED",
    "AUTHENTICATION_SUCCESS",
    "PROCESS_EXECUTION",
    "NETWORK_ACTIVITY",
    "FILE_ACTIVITY",
    "PRIVILEGE_ACTIVITY",
    "WEB_ACTIVITY",
    "OTHER",
}


@dataclass(frozen=True)
class TimelineEntrySummary:
    id: UUID
    investigation_id: UUID
    security_event_id: UUID | None
    entry_type: str
    title: str
    occurred_at: datetime
    sequence_number: int
