from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.application.reports.service import ReportNotFoundError, ReportService
from app.infrastructure.database.session import SessionLocal

router = APIRouter(prefix="/reports", tags=["reports"])

def get_report_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/investigations/{investigation_id}")
def get_investigation_report(
    investigation_id: UUID,
    db: Session = Depends(get_report_db)
) -> dict:
    try:
        report = ReportService(db).generate(investigation_id)
    except ReportNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return {
        "data": {
            "investigation": report.investigation,
            "incident": report.incident,
            "alerts": report.alerts,
            "events": report.events,
            "timeline": report.timeline,
            "findings": report.findings,
            "notes": report.notes,
            "evidence": report.evidence,
            "mitre_techniques": report.mitre_techniques,
            "generated_at": report.generated_at,
        }
    }



