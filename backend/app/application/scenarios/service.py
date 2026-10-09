from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.application.lab.parameter_validation import InvalidScenarioParameters, validate_parameters
from app.application.scenarios.generators import SCENARIO_GENERATORS
from app.application.telemetry.normalizer import normalize_telemetry
from app.infrastructure.database.models import RawTelemetryModel, ScenarioRunModel, SecurityEventModel
from app.infrastructure.repositories.scenarios import ScenarioRepository
from app.infrastructure.repositories.telemetry import TelemetryRepository


class ScenarioNotFoundError(LookupError):
    pass


class UnsupportedScenarioError(ValueError):
    pass


class ScenarioService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.scenarios = ScenarioRepository(db)
        self.telemetry = TelemetryRepository(db)

    def list_scenarios(self):
        return self.scenarios.list_active()

    def get_scenario(self, scenario_id: UUID):
        scenario = self.scenarios.get(scenario_id)
        if scenario is None or not scenario.is_active:
            raise ScenarioNotFoundError("Scenario not found")
        return scenario

    def run(self, scenario_id: UUID, config: dict) -> ScenarioRunModel:
        scenario = self.get_scenario(scenario_id)
        if scenario.execution_mode != "SYNTHETIC":
            raise UnsupportedScenarioError("Scenario execution mode is not supported")

        generator = SCENARIO_GENERATORS.get(scenario.runner_key)
        if generator is None:
            raise UnsupportedScenarioError("Scenario runner is not allowlisted")

        try:
            parameters = validate_parameters(scenario.runner_key, config)
        except InvalidScenarioParameters:
            raise

        if scenario.runner_key == "auth_bruteforce_command":
            parameters.setdefault("username", "analyst")
            parameters.setdefault("source_ip", "10.10.10.50")
        elif scenario.runner_key == "suspicious_process_chain":
            parameters.setdefault("username", "analyst")
            parameters.setdefault("source_ip", "10.10.10.50")
            parameters.setdefault("hostname", "lab-host")
        else:
            parameters.setdefault("source_ip", "10.10.10.50")
            parameters.setdefault("destination_ip", "10.10.10.10")

        run = ScenarioRunModel(
            id=uuid4(),
            scenario_id=scenario.id,
            status="RUNNING",
            config=parameters,
            started_at=datetime.now(timezone.utc),
        )
        self.scenarios.add_run(run)
        self.db.flush()

        try:
            with self.db.begin_nested():
                generated_events = generator.generate(**parameters)
                for generated in generated_events:
                    raw = RawTelemetryModel(
                        id=uuid4(),
                        scenario_run_id=run.id,
                        source="security-lab",
                        event_type=generated.event_type,
                        occurred_at=generated.occurred_at,
                        payload=generated.payload,
                    )
                    self.telemetry.add_raw(raw)
                    self.db.flush()
                    normalized = normalize_telemetry(
                        event_type=generated.event_type,
                        source="security-lab",
                        payload=generated.payload,
                    )
                    self.telemetry.add_event(
                        SecurityEventModel(
                            id=normalized.event_id,
                            raw_telemetry_id=raw.id,
                            timestamp=normalized.timestamp,
                            event_type=normalized.event_type,
                            source=normalized.source,
                            source_user=normalized.source_user,
                            source_ip=normalized.source_ip,
                            destination_ip=normalized.destination_ip,
                            destination_port=normalized.destination_port,
                            process=normalized.process,
                            parent_process=normalized.parent_process,
                            action=normalized.action,
                            status=normalized.status,
                            hostname=normalized.hostname,
                            resource=normalized.resource,
                            metadata_json=normalized.metadata,
                        )
                    )

            run.status = "COMPLETED"
            run.completed_at = datetime.now(timezone.utc)
            self.db.commit()
            self.db.refresh(run)
            return run
        except Exception as exc:
            self.db.rollback()
            raise exc
