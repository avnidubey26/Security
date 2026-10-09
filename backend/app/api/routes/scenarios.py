from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.application.lab.parameter_validation import InvalidScenarioParameters
from app.application.scenarios.service import ScenarioNotFoundError, ScenarioService, UnsupportedScenarioError

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


class ScenarioResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    slug: str
    description: str
    is_active: bool
    execution_mode: str
    runner_key: str
    parameter_schema: dict[str, Any]
    allowed_platforms: list[str]


class RunScenarioRequest(BaseModel):
    username: str | None = Field(default=None, min_length=1, max_length=150)
    source_ip: str | None = Field(default=None, min_length=3, max_length=45)
    parameters: dict[str, Any] = Field(default_factory=dict)

    def merged_parameters(self) -> dict[str, Any]:
        merged = dict(self.parameters)
        if self.username is not None:
            merged["username"] = self.username
        if self.source_ip is not None:
            merged["source_ip"] = self.source_ip
        return merged


class ScenarioRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    scenario_id: UUID
    status: str
    config: dict
    started_at: datetime | None
    completed_at: datetime | None
    error_message: str | None


@router.get("")
def list_scenarios(db: Session = Depends(get_db)):
    return {"data": [ScenarioResponse.model_validate(item) for item in ScenarioService(db).list_scenarios()]}


@router.get("/{scenario_id}", response_model=dict)
def get_scenario(scenario_id: UUID, db: Session = Depends(get_db)):
    try:
        scenario = ScenarioService(db).get_scenario(scenario_id)
    except ScenarioNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"data": ScenarioResponse.model_validate(scenario)}


@router.post("/{scenario_id}/runs", response_model=dict, status_code=status.HTTP_201_CREATED)
def run_scenario(scenario_id: UUID, request: RunScenarioRequest, db: Session = Depends(get_db)):
    try:
        run = ScenarioService(db).run(scenario_id, request.merged_parameters())
    except ScenarioNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (UnsupportedScenarioError, InvalidScenarioParameters) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"data": ScenarioRunResponse.model_validate(run)}


@router.get("/{scenario_id}/runs/{run_id}", response_model=dict)
def get_scenario_run(scenario_id: UUID, run_id: UUID, db: Session = Depends(get_db)):
    run = ScenarioService(db).scenarios.get_run(run_id)
    if run is None or run.scenario_id != scenario_id:
        raise HTTPException(status_code=404, detail="Scenario run not found")
    return {"data": ScenarioRunResponse.model_validate(run)}
