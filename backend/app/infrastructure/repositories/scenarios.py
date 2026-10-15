from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.infrastructure.database.models import ScenarioModel, ScenarioRunModel


class ScenarioRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_active(self) -> list[ScenarioModel]:
        return list(self.db.scalars(select(ScenarioModel).where(ScenarioModel.is_active.is_(True)).order_by(ScenarioModel.name)))

    def get(self, scenario_id: UUID) -> ScenarioModel | None:
        return self.db.get(ScenarioModel, scenario_id)

    def get_run(self, run_id: UUID) -> ScenarioRunModel | None:
        return self.db.get(ScenarioRunModel, run_id)

    
    def list_runs(self) -> list[ScenarioRunModel]:
        return list(
            self.db.scalars(
                select(ScenarioRunModel).order_by(
                    ScenarioRunModel.started_at.desc()
                )
            )
        )


    def add_run(self, run: ScenarioRunModel) -> ScenarioRunModel:
        self.db.add(run)
        return run
