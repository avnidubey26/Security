from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.application.detections.engine import evaluate_detection
from app.domain.detections.models import DetectionEvent


def test_threshold_matches_events_within_window():
    base = datetime(2026, 9, 24, 15, 46, tzinfo=timezone.utc)
    events = [
        DetectionEvent(
            id=uuid4(),
            timestamp=base + timedelta(seconds=offset),
            fields={
                "event_type": "authentication",
                "source_ip": "10.10.10.50",
                "status": "failed",
            },
        )
        for offset in (0, 1, 2, 3, 4)
    ]

    result = evaluate_detection(
        events=events,
        definition={
            "type": "threshold",
            "window_seconds": 10,
            "count": 5,
            "group_by": ["source_ip"],
            "event_type": "authentication",
            "conditions": [
                {"field": "status", "operator": "equals", "value": "failed"},
            ],
        },
    )

    assert result.matched is True
    assert len(result.matched_event_ids) == 5
