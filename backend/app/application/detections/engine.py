from __future__ import annotations

from collections import defaultdict
from datetime import timedelta
from typing import Any
from uuid import UUID

from app.domain.detections.models import DetectionEvaluation, DetectionEvent


class DetectionDefinitionError(ValueError):
    pass


SUPPORTED_OPERATORS = {
    "equals",
    "not_equals",
    "contains",
    "starts_with",
    "ends_with",
    "in",
    "exists",
}


def _field_value(event: DetectionEvent, field: str) -> Any:
    if field == "id":
        return event.id
    if field == "timestamp":
        return event.timestamp

    current: Any = event.fields
    for part in field.split("."):
        if isinstance(current, dict):
            current = current.get(part)
        else:
            return None
    return current


def _condition_matches(event: DetectionEvent, condition: dict[str, Any]) -> bool:
    field = condition.get("field")
    operator = condition.get("operator", "equals")

    if not isinstance(field, str) or not field:
        raise DetectionDefinitionError("condition.field must be a non-empty string")
    if operator not in SUPPORTED_OPERATORS:
        raise DetectionDefinitionError(f"Unsupported condition operator: {operator}")

    actual = _field_value(event, field)

    if operator == "exists":
        expected = condition.get("value", True)
        return (actual is not None) is bool(expected)

    if operator == "equals":
        return actual == condition.get("value")

    if operator == "not_equals":
        return actual != condition.get("value")

    if operator == "contains":
        expected = condition.get("value")
        return isinstance(actual, str) and isinstance(expected, str) and expected in actual

    if operator == "starts_with":
        expected = condition.get("value")
        return isinstance(actual, str) and isinstance(expected, str) and actual.startswith(expected)

    if operator == "ends_with":
        expected = condition.get("value")
        return isinstance(actual, str) and isinstance(expected, str) and actual.endswith(expected)

    expected = condition.get("value")
    if not isinstance(expected, list):
        raise DetectionDefinitionError("The 'in' operator requires a list value")
    return actual in expected


def _matches(event: DetectionEvent, step: dict[str, Any]) -> bool:
    event_type = step.get("event_type")
    if event_type is not None and event.fields.get("event_type") != event_type:
        return False

    conditions = step.get("conditions", [])
    if not isinstance(conditions, list):
        raise DetectionDefinitionError("step.conditions must be a list")

    return all(_condition_matches(event, condition) for condition in conditions)


def _validate_window(value: Any) -> int:
    if not isinstance(value, int) or value <= 0 or value > 86_400:
        raise DetectionDefinitionError("window_seconds must be an integer between 1 and 86400")
    return value


def _validate_group_by(value: Any) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list) or any(not isinstance(item, str) or not item for item in value):
        raise DetectionDefinitionError("group_by must be a list of non-empty strings")
    return value


def _group_events(events: list[DetectionEvent], group_by: list[str]) -> dict[tuple[Any, ...], list[DetectionEvent]]:
    if not group_by:
        return {(): sorted(events, key=lambda event: (event.timestamp, str(event.id)))}

    groups: dict[tuple[Any, ...], list[DetectionEvent]] = defaultdict(list)
    for event in events:
        key = tuple(_field_value(event, field) for field in group_by)
        groups[key].append(event)

    return {
        key: sorted(group, key=lambda event: (event.timestamp, str(event.id)))
        for key, group in groups.items()
    }


def _threshold(
    events: list[DetectionEvent],
    definition: dict[str, Any],
) -> DetectionEvaluation:
    window_seconds = _validate_window(definition.get("window_seconds", 300))
    count = definition.get("count")
    if not isinstance(count, int) or count <= 0:
        raise DetectionDefinitionError("threshold count must be a positive integer")

    group_by = _validate_group_by(definition.get("group_by"))
    step = {
        "event_type": definition.get("event_type"),
        "conditions": definition.get("conditions", []),
    }
    matching = [event for event in events if _matches(event, step)]
    groups = _group_events(matching, group_by)

    for key, group in groups.items():
        for index, event in enumerate(group):
            end = event.timestamp + timedelta(seconds=window_seconds)
            window_events = [candidate for candidate in group[index:] if candidate.timestamp <= end]
            if len(window_events) >= count:
                selected = window_events[:count]
                return DetectionEvaluation(
                    matched=True,
                    matched_event_ids=tuple(event.id for event in selected),
                    context={"group": list(key), "count": len(selected)},
                    explanation={
                        "type": "threshold",
                        "matched": True,
                        "message": f"Found at least {count} matching events within {window_seconds} seconds.",
                        "group_by": group_by,
                        "group": list(key),
                        "window_seconds": window_seconds,
                        "required_count": count,
                        "observed_count": len(selected),
                    },
                )

    return DetectionEvaluation(
        matched=False,
        matched_event_ids=(),
        context={},
        explanation={
            "type": "threshold",
            "matched": False,
            "message": f"No group contained {count} matching events within {window_seconds} seconds.",
            "group_by": group_by,
            "window_seconds": window_seconds,
            "required_count": count,
        },
    )


def _sequence(
    events: list[DetectionEvent],
    definition: dict[str, Any],
) -> DetectionEvaluation:
    window_seconds = _validate_window(definition.get("window_seconds", 300))
    group_by = _validate_group_by(definition.get("group_by"))
    steps = definition.get("steps")
    if not isinstance(steps, list) or not steps:
        raise DetectionDefinitionError("sequence steps must be a non-empty list")

    groups = _group_events(events, group_by)

    for group_key, group in groups.items():
        for start_index, start_event in enumerate(group):
            matched_ids: list[UUID] = []
            step_details: list[dict[str, Any]] = []
            cursor = start_index
            sequence_start = start_event.timestamp
            previous_timestamp = sequence_start
            successful = True

            for step_index, step in enumerate(steps):
                if not isinstance(step, dict):
                    raise DetectionDefinitionError("Each sequence step must be an object")

                min_count = step.get("min_count", 1)
                if not isinstance(min_count, int) or min_count <= 0:
                    raise DetectionDefinitionError("step.min_count must be a positive integer")

                step_matches: list[DetectionEvent] = []
                while cursor < len(group):
                    candidate = group[cursor]
                    if candidate.timestamp < previous_timestamp:
                        cursor += 1
                        continue
                    if candidate.timestamp > sequence_start + timedelta(seconds=window_seconds):
                        break
                    if _matches(candidate, step):
                        step_matches.append(candidate)
                        cursor += 1
                        if len(step_matches) >= min_count:
                            break
                    else:
                        cursor += 1

                if len(step_matches) < min_count:
                    successful = False
                    break

                matched_ids.extend(event.id for event in step_matches)
                previous_timestamp = step_matches[-1].timestamp
                step_details.append(
                    {
                        "name": step.get("name", f"step_{step_index + 1}"),
                        "required_count": min_count,
                        "matched_count": len(step_matches),
                        "event_ids": [str(event.id) for event in step_matches],
                        "first_timestamp": step_matches[0].timestamp.isoformat(),
                        "last_timestamp": step_matches[-1].timestamp.isoformat(),
                    }
                )

            if successful and previous_timestamp <= sequence_start + timedelta(seconds=window_seconds):
                return DetectionEvaluation(
                    matched=True,
                    matched_event_ids=tuple(matched_ids),
                    context={"group": list(group_key), "step_count": len(steps)},
                    explanation={
                        "type": "sequence",
                        "matched": True,
                        "message": "All sequence steps matched in the required order within the detection window.",
                        "group_by": group_by,
                        "group": list(group_key),
                        "window_seconds": window_seconds,
                        "steps": step_details,
                    },
                )

    return DetectionEvaluation(
        matched=False,
        matched_event_ids=(),
        context={},
        explanation={
            "type": "sequence",
            "matched": False,
            "message": "The required event sequence was not observed within the detection window.",
            "group_by": group_by,
            "window_seconds": window_seconds,
            "step_count": len(steps),
        },
    )


def evaluate_detection(
    *,
    events: list[DetectionEvent],
    definition: dict[str, Any],
) -> DetectionEvaluation:
    if not isinstance(definition, dict):
        raise DetectionDefinitionError("Detection definition must be an object")

    detection_type = definition.get("type")
    ordered_events = sorted(events, key=lambda event: (event.timestamp, str(event.id)))

    if detection_type == "threshold":
        return _threshold(ordered_events, definition)
    if detection_type == "sequence":
        return _sequence(ordered_events, definition)
    if detection_type == "match":
        conditions = definition.get("conditions", [])
        if not isinstance(conditions, list):
            raise DetectionDefinitionError("match conditions must be a list")
        for event in ordered_events:
            if _matches(event, {"event_type": definition.get("event_type"), "conditions": conditions}):
                return DetectionEvaluation(
                    matched=True,
                    matched_event_ids=(event.id,),
                    context={},
                    explanation={
                        "type": "match",
                        "matched": True,
                        "message": "A matching event was found.",
                        "event_id": str(event.id),
                    },
                )
        return DetectionEvaluation(
            matched=False,
            matched_event_ids=(),
            context={},
            explanation={"type": "match", "matched": False, "message": "No matching event was found."},
        )

    raise DetectionDefinitionError("Detection type must be one of: match, threshold, sequence")
