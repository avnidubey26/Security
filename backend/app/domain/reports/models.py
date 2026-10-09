from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any


@dataclass(frozen=True)
class ReportDocument:
    investigation: dict[str, Any]
    incident: dict[str, Any] | None
    detections: list[dict[str, Any]]
    alerts: list[dict[str, Any]]
    events: list[dict[str, Any]]
    timeline: list[dict[str, Any]]
    findings: list[dict[str, Any]]
    notes: list[dict[str, Any]]
    evidence: list[dict[str, Any]]
    mitre_techniques: list[dict[str, Any]]
    generated_at: datetime