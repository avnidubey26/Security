from datetime import datetime, timezone
from ipaddress import ip_address
from typing import Any
from uuid import UUID, uuid4
from app.domain.telemetry.models import NormalizedSecurityEvent


class TelemetryNormalizationError(ValueError):
    pass


def _optional_string(payload: dict[str, Any], key: str, max_length: int) -> str | None:
    value = payload.get(key)
    if value is None:
        return None
    if not isinstance(value, str):
        raise TelemetryNormalizationError(f"{key} must be a string")
    value = value.strip()
    if len(value) > max_length:
        raise TelemetryNormalizationError(f"{key} exceeds maximum length")
    return value or None


def _optional_ip(payload: dict[str, Any], key: str) -> str | None:
    value = _optional_string(payload, key, 45)
    if value is None:
        return None
    try:
        ip_address(value)
    except ValueError as exc:
        raise TelemetryNormalizationError(f"{key} is not a valid IP address") from exc
    return value


def _timestamp(payload: dict[str, Any]) -> datetime:
    value = payload.get("timestamp")
    if not isinstance(value, str):
        raise TelemetryNormalizationError("timestamp must be an ISO-8601 string")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise TelemetryNormalizationError("timestamp is invalid") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def normalize_telemetry(*, event_type: str, source: str, payload: dict[str, Any]) -> NormalizedSecurityEvent:
    if not event_type or len(event_type) > 100:
        raise TelemetryNormalizationError("event_type is invalid")
    if not source or len(source) > 100:
        raise TelemetryNormalizationError("source is invalid")
    destination_port = payload.get("destination_port")
    if destination_port is not None and (not isinstance(destination_port, int) or not 1 <= destination_port <= 65535):
        raise TelemetryNormalizationError("destination_port is invalid")
    metadata = payload.get("metadata", {})
    if not isinstance(metadata, dict):
        raise TelemetryNormalizationError("metadata must be an object")
    return NormalizedSecurityEvent(
        event_id=UUID(str(payload["event_id"])) if payload.get("event_id") else uuid4(),
        timestamp=_timestamp(payload),
        event_type=event_type,
        source=source,
        source_user=_optional_string(payload, "user", 150),
        source_ip=_optional_ip(payload, "source_ip"),
        destination_ip=_optional_ip(payload, "destination_ip"),
        destination_port=destination_port,
        process=_optional_string(payload, "process", 255),
        parent_process=_optional_string(payload, "parent_process", 255),
        action=_optional_string(payload, "action", 100),
        status=_optional_string(payload, "status", 50),
        hostname=_optional_string(payload, "hostname", 255),
        resource=_optional_string(payload, "resource", 500),
        metadata=metadata,
    )
