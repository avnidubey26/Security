from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID


@dataclass(frozen=True)
class DetectionEvent:
    id: UUID
    timestamp: datetime
    fields: dict[str, Any]


@dataclass(frozen=True)
class DetectionEvaluation:
    matched: bool
    explanation: dict[str, Any]
    matched_event_ids: tuple[UUID, ...]
    context: dict[str, Any]
