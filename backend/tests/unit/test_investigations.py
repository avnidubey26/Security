from app.application.investigations.service import _ALLOWED_TRANSITIONS
from app.domain.investigations.models import FINDING_TYPES, INVESTIGATION_PRIORITIES, INVESTIGATION_STATUSES


def test_investigation_statuses_and_priorities_are_defined():
    assert "OPEN" in INVESTIGATION_STATUSES
    assert "IN_PROGRESS" in INVESTIGATION_STATUSES
    assert "CONTAINED" in INVESTIGATION_STATUSES
    assert "CLOSED" in INVESTIGATION_STATUSES
    assert "FALSE_POSITIVE" in INVESTIGATION_STATUSES
    assert INVESTIGATION_PRIORITIES == {"LOW", "MEDIUM", "HIGH", "CRITICAL"}


def test_investigation_transition_policy():
    assert "IN_PROGRESS" in _ALLOWED_TRANSITIONS["OPEN"]
    assert "CONTAINED" in _ALLOWED_TRANSITIONS["IN_PROGRESS"]
    assert "CLOSED" in _ALLOWED_TRANSITIONS["CONTAINED"]
    assert "OPEN" not in _ALLOWED_TRANSITIONS["CLOSED"]
    assert "CLOSED" not in _ALLOWED_TRANSITIONS["FALSE_POSITIVE"]


def test_finding_types_are_constrained():
    assert FINDING_TYPES == {"OBSERVATION", "ROOT_CAUSE", "IMPACT", "RECOMMENDATION"}
