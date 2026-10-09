from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.api.dependencies import get_db
from app.api.routes.reports import get_report_db


TEST_DATABASE_URL = "postgresql+psycopg://security:security@postgres:5432/security_test"
test_engine = create_engine(TEST_DATABASE_URL)
TestSessionLocal = sessionmaker(bind=test_engine, autoflush=False, autocommit=False)


def override_test_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client():
    original_overrides = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = override_test_db
    app.dependency_overrides[get_report_db] = override_test_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(original_overrides)


def payload(response, expected_status=200):
    assert response.status_code == expected_status, response.text
    body = response.json()
    return body.get("data", body)


def test_scenario_to_investigation_evidence_incident_report(client):
    # 1. Find the seeded brute-force scenario.
    scenarios = payload(client.get("/api/v1/scenarios"))
    scenario = next(
        item for item in scenarios
        if item["slug"] == "auth-bruteforce-command-execution"
    )

    # 2. Generate fresh telemetry in the test database.
    run = payload(client.post(
        f"/api/v1/scenarios/{scenario['id']}/runs",
        json={"username": "e2e-analyst", "source_ip": "192.0.2.77"},
    ), 201)
    run_id = run["id"]

    # 3. Create a detection rule and version.
    suffix = uuid4().hex[:12]
    rule = payload(client.post(
        "/api/v1/detection-rules",
        json={
            "name": f"E2E Brute Force {suffix}",
            "slug": f"e2e-brute-force-{suffix}",
            "description": "Integration test detection rule",
        },
    ), 201)

    definition = {
        "schema_version": "1.0",
        "type": "sequence",
        "window_seconds": 300,
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
                    {
                        "field": "metadata.command_family",
                        "operator": "equals",
                        "value": "identity_discovery",
                    },
                ],
            },
        ],
    }

    version = payload(client.post(
        f"/api/v1/detection-rules/{rule['id']}/versions",
        json={"definition": definition, "severity": "HIGH", "confidence": 95},
    ), 201)
    assert version["version"] == 1

    payload(client.post(
        f"/api/v1/detection-rules/{rule['id']}/versions/1/activate"
    ))

    # 4. Evaluate generated events; a match should create an alert.
    result = payload(client.post(
        f"/api/v1/detection-rules/{rule['id']}/versions/1/evaluate",
        json={"scenario_run_id": run_id},
    ))
    assert result["matched"] is True
    assert len(result["matched_event_ids"]) >= 1

    alerts = payload(client.get("/api/v1/alerts"))
    alert = next(
        item for item in alerts
        if item.get("detection_rule_version_id") == version["id"]
    )

    # 5. Open an investigation linked to the generated alert.
    investigation = payload(client.post(
        "/api/v1/investigations",
        json={
            "title": f"E2E Investigation {suffix}",
            "description": "Automated end-to-end pipeline test",
            "priority": "HIGH",
            "alert_id": alert["id"],
        },
    ), 201)
    investigation_id = investigation["id"]

    # 6. Add an investigation finding and rebuild its timeline.
    payload(client.post(
        f"/api/v1/investigations/{investigation_id}/findings",
        json={
            "finding_type": "OBSERVATION",
            "title": "E2E detection confirmed",
            "content": "Synthetic brute-force sequence matched the active rule.",
            "author": "e2e-test",
        },
    ), 201)

    timeline = payload(client.post(
        f"/api/v1/investigations/{investigation_id}/timeline/rebuild"
    ))
    assert timeline is not None

    # 7. Collect evidence from the linked alert and verify its integrity.
    evidence = payload(client.post(
        "/api/v1/evidence",
        json={
            "investigation_id": investigation_id,
            "source_type": "ALERT",
            "source_id": alert["id"],
            "collected_by": "e2e-test",
            "title": "E2E detection alert",
            "description": "Evidence collected from the matched alert.",
        },
    ), 201)

    verification = payload(client.post(
        f"/api/v1/evidence/{evidence['id']}/verify"
    ))
    assert verification["integrity_verified"] is True

    # 8. Create an incident and attach the evidence.
    incident = payload(client.post(
        "/api/v1/incidents",
        json={
            "investigation_id": investigation_id,
            "title": f"E2E Incident {suffix}",
            "description": "Incident created by pipeline integration test",
            "severity": "HIGH",
        },
    ), 201)

    payload(client.post(
        f"/api/v1/incidents/{incident['id']}/evidence",
        json={"evidence_id": evidence["id"]},
    ), 201)

    # 9. Generate the investigation report from the same test database.
    report = payload(client.get(
        f"/api/v1/reports/investigations/{investigation_id}"
    ))
    assert report["investigation"] is not None
    assert report["incident"] is not None
    assert report["evidence"]
    assert report["alerts"]


