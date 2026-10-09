from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.error_handlers import register_error_handlers
from app.api.routes.alerts import router as alerts_router
from app.api.routes.detections import router as detections_router
from app.api.routes.events import router as events_router
from app.api.routes.evidence import router as evidence_router
from app.api.routes.health import router as health_router
from app.api.routes.incidents import router as incidents_router
from app.api.routes.investigations import router as investigations_router
from app.api.routes.mitre import router as mitre_router
from app.api.routes.reports import router as reports_router
from app.api.routes.scenarios import router as scenarios_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.middleware import request_context_middleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.logger = configure_logging()
    app.state.logger.info("application_started")
    yield
    app.state.logger.info("application_stopped")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Security API",
        description="Local-first defensive security investigation platform.",
        version="0.1.0",
        docs_url="/docs" if settings.environment != "production" else None,
        redoc_url="/redoc" if settings.environment != "production" else None,
        lifespan=lifespan,
    )
    app.state.logger = configure_logging()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    )
    app.middleware("http")(request_context_middleware)
    app.include_router(health_router, prefix=settings.api_v1_prefix)
    app.include_router(scenarios_router, prefix=settings.api_v1_prefix)
    app.include_router(events_router, prefix=settings.api_v1_prefix)
    app.include_router(detections_router, prefix=settings.api_v1_prefix)
    app.include_router(alerts_router, prefix=settings.api_v1_prefix)
    app.include_router(investigations_router, prefix=settings.api_v1_prefix)
    app.include_router(evidence_router, prefix=settings.api_v1_prefix)
    app.include_router(incidents_router, prefix=settings.api_v1_prefix)
    app.include_router(mitre_router, prefix=settings.api_v1_prefix)
    app.include_router(reports_router, prefix=settings.api_v1_prefix)
    register_error_handlers(app)
    return app


app = create_app()
