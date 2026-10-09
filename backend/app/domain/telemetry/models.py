from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID


@dataclass(frozen=True)
class NormalizedSecurityEvent:
    event_id: UUID
    timestamp: datetime
    event_type: str
    source: str
    source_user: str | None = None
    source_ip: str | None = None
    destination_ip: str | None = None
    destination_port: int | None = None
    process: str | None = None
    parent_process: str | None = None
    action: str | None = None
    status: str | None = None
    hostname: str | None = None
    resource: str | None = None
    metadata: dict[str, Any] | None = None
