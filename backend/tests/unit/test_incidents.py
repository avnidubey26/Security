from app.domain.incidents.models import INCIDENT_TRANSITIONS, IncidentSeverity, IncidentStatus


def test_incident_status_values_are_stable():
    assert {item.value for item in IncidentStatus} == {
        "OPEN", "CONTAINED", "RESOLVED", "CLOSED", "FALSE_POSITIVE"
    }


def test_incident_severity_values_are_stable():
    assert {item.value for item in IncidentSeverity} == {"LOW", "MEDIUM", "HIGH", "CRITICAL"}


def test_incident_transitions_are_monotonic_for_normal_flow():
    assert "CONTAINED" in INCIDENT_TRANSITIONS["OPEN"]
    assert "RESOLVED" in INCIDENT_TRANSITIONS["CONTAINED"]
    assert "CLOSED" in INCIDENT_TRANSITIONS["RESOLVED"]
    assert "OPEN" not in INCIDENT_TRANSITIONS["RESOLVED"]
    assert "OPEN" not in INCIDENT_TRANSITIONS["CLOSED"]
