from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.application.detections.engine import DetectionDefinitionError, evaluate_detection
from app.domain.detections.models import DetectionEvent


def make_event(timestamp, event_type, **fields):
    return DetectionEvent(
        id=uuid4(),
        timestamp=timestamp,
        fields={"event_type": event_type, **fields},
    )


def brute_force_events():
    base = datetime(2026, 9, 24, 15, 46, tzinfo=timezone.utc)
    events = [
        make_event(
            base + timedelta(seconds=index * 2),
            "authentication",
            source_ip="10.10.10.50",
            source_user="analyst",
            action="login",
            status="failed",
        )
        for index in range(5)
    ]
    events.append(
        make_event(
            base + timedelta(seconds=12),
            "authentication",
            source_ip="10.10.10.50",
            source_user="analyst",
            action="login",
            status="success",
        )
    )
    events.append(
        make_event(
            base + timedelta(seconds=15),
            "process_execution",
            source_ip="10.10.10.50",
            source_user="analyst",
            action="execute",
            process="/bin/bash",
            metadata={"command_family": "identity_discovery"},
        )
    )
    return events


DEFINITION = {
    "schema_version": "1.0",
    "type": "sequence",
    "window_seconds": 60,
    "group_by": ["source_ip", "source_user"],
    "steps": [
        {
            "name": "failed_authentication",
            "event_type": "authentication",
            "min_count": 5,
            "conditions": [
                {"field": "action", "operator": "equals", "value": "login"},
                {"field": "status", "operator": "equals", "value": "failed"},
            ],
        },
        {
            "name": "successful_authentication",
            "event_type": "authentication",
            "conditions": [
                {"field": "action", "operator": "equals", "value": "login"},
                {"field": "status", "operator": "equals", "value": "success"},
            ],
        },
        {
            "name": "identity_discovery_process",
            "event_type": "process_execution",
            "conditions": [
                {"field": "action", "operator": "equals", "value": "execute"},
                {"field": "metadata.command_family", "operator": "equals", "value": "identity_discovery"},
            ],
        },
    ],
}


def test_sequence_matches_controlled_brute_force_scenario():
    result = evaluate_detection(events=brute_force_events(), definition=DEFINITION)

    assert result.matched is True
    assert len(result.matched_event_ids) == 7
    assert result.explanation["type"] == "sequence"
    assert len(result.explanation["steps"]) == 3


def test_sequence_does_not_match_when_only_four_failed_logins_exist():
    events = brute_force_events()[:4] + brute_force_events()[5:]

    result = evaluate_detection(events=events, definition=DEFINITION)

    assert result.matched is False
    assert result.matched_event_ids == ()


def test_sequence_does_not_cross_source_ip_group_boundary():
    events = brute_force_events()
    events[4] = DetectionEvent(
        id=events[4].id,
        timestamp=events[4].timestamp,
        fields={**events[4].fields, "source_ip": "10.10.10.51"},
    )

    result = evaluate_detection(events=events, definition=DEFINITION)

    assert result.matched is False


def test_invalid_detection_type_is_rejected():
    with pytest.raises(DetectionDefinitionError):
        evaluate_detection(events=[], definition={"type": "regex_magic"})
