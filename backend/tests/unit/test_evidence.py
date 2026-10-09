import hashlib
import json

from app.domain.evidence.models import EvidenceSourceType, EvidenceType


def test_evidence_source_types_are_explicitly_allowlisted():
    assert {item.value for item in EvidenceSourceType} == {
        "ALERT",
        "DETECTION_RESULT",
        "SECURITY_EVENT",
        "TIMELINE_ENTRY",
        "INVESTIGATION_NOTE",
        "INVESTIGATION_FINDING",
    }


def test_evidence_types_are_explicitly_allowlisted():
    assert {item.value for item in EvidenceType} == {
        "ALERT",
        "DETECTION_RESULT",
        "SECURITY_EVENT",
        "TIMELINE_ENTRY",
        "ANALYST_NOTE",
        "INVESTIGATION_FINDING",
    }


def test_snapshot_hash_is_deterministic():
    snapshot = {"event_type": "authentication", "status": "failed", "source_ip": "10.10.10.50"}
    canonical = json.dumps(snapshot, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
    first = hashlib.sha256(canonical).hexdigest()
    second = hashlib.sha256(canonical).hexdigest()
    assert first == second
    assert len(first) == 64
