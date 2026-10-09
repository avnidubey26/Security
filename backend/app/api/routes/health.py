from fastapi import APIRouter, Request
from pydantic import BaseModel


router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    service: str
    request_id: str


@router.get("/health", response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="security-api",
        request_id=request.state.request_id,
    )
