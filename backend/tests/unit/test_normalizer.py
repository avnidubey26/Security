from datetime import datetime, timezone
import pytest
from app.application.telemetry.normalizer import TelemetryNormalizationError, normalize_telemetry

def test_normalizer_creates_canonical_event():
    event = normalize_telemetry(event_type="authentication", source="security-lab", payload={"timestamp":"2026-09-24T12:00:00Z","user":"analyst","source_ip":"10.10.10.50","destination_ip":"10.10.10.10","destination_port":22,"action":"login","status":"failed","metadata":{"attempt":1}})
    assert event.timestamp == datetime(2026,9,24,12,0,tzinfo=timezone.utc)
    assert event.source_user == "analyst"
    assert event.destination_port == 22
    assert event.status == "failed"

def test_normalizer_rejects_invalid_ip():
    with pytest.raises(TelemetryNormalizationError):
        normalize_telemetry(event_type="authentication", source="security-lab", payload={"timestamp":"2026-09-24T12:00:00Z","source_ip":"not-an-ip"})

def test_normalizer_rejects_invalid_port():
    with pytest.raises(TelemetryNormalizationError):
        normalize_telemetry(event_type="network", source="security-lab", payload={"timestamp":"2026-09-24T12:00:00Z","destination_port":70000})
