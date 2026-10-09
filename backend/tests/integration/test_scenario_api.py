
from collections.abc import Generator
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.api.dependencies import get_db
from app.infrastructure.database.models import (
    RawTelemetryModel,
    ScenarioModel,
    ScenarioRunModel,
    SecurityEventModel,
)
from app.main import app


TEST_DATABASE_URL = (
    "postgresql+psycopg://security:security@postgres:5432/security_test"
)

test_engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
TestSessionLocal = sessionmaker(
    bind=test_engine,
    autoflush=False,
    expire_on_commit=False,
)


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    previous_overrides = app.dependency_overrides.copy()

    def override_get_db() -> Generator[Session, None, None]:
        with TestSessionLocal() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous_overrides)


@pytest.fixture
def scenario_id() -> UUID:
    with TestSessionLocal() as db:
        scenario = db.scalar(
            select(ScenarioModel)
            .where(
                ScenarioModel.slug == "auth-bruteforce-command-execution",
                ScenarioModel.is_active.is_(True),
            )
        )
        assert scenario is not None, "Required active test scenario is missing"
        return scenario.id


def test_scenario_run_persists_raw_and_normalized_events(
    client: TestClient,
    scenario_id: UUID,
) -> None:
    response = client.post(
        f"/api/v1/scenarios/{scenario_id}/runs",
        json={
            "username": "integration-analyst",
            "source_ip": "192.0.2.25",
        },
    )

    assert response.status_code == 201, response.text
    run_data = response.json()["data"]
    run_id = UUID(run_data["id"])

    assert run_data["scenario_id"] == str(scenario_id)
    assert run_data["status"] == "COMPLETED"
    assert run_data["completed_at"] is not None

    with TestSessionLocal() as db:
        run = db.get(ScenarioRunModel, run_id)
        assert run is not None
        assert run.status == "COMPLETED"

        raw_records = list(
            db.scalars(
                select(RawTelemetryModel).where(
                    RawTelemetryModel.scenario_run_id == run_id
                )
            )
        )
        raw_ids = [record.id for record in raw_records]

        events = list(
            db.scalars(
                select(SecurityEventModel).where(
                    SecurityEventModel.raw_telemetry_id.in_(raw_ids)
                )
            )
        )

    assert len(raw_records) == 7
    assert len(events) == 7
    assert sum(event.status == "failed" for event in events) == 5
    assert sum(event.status == "success" for event in events) == 1
    assert sum(event.event_type == "process_execution" for event in events) == 1
    assert {event.source_ip for event in events} == {"192.0.2.25"}


def test_scenario_run_rejects_unsupported_parameters(
    client: TestClient,
    scenario_id: UUID,
) -> None:
    response = client.post(
        f"/api/v1/scenarios/{scenario_id}/runs",
        json={"parameters": {"command": "nmap"}},
    )

    assert response.status_code == 422
    assert "Unsupported scenario parameters" in response.json()["detail"]
