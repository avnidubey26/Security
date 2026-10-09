from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID


class ScenarioRunStatus(StrEnum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


@dataclass(frozen=True)
class ScenarioDefinition:
    id: UUID
    name: str
    slug: str
    description: str
    is_active: bool
    execution_mode: str
    runner_key: str
    parameter_schema: dict[str, Any]
    allowed_platforms: list[str]


@dataclass(frozen=True)
class GeneratedTelemetry:
    event_type: str
    payload: dict[str, Any]
    occurred_at: datetime
