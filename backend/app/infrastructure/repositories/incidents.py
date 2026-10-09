from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.infrastructure.database.models.incidents import IncidentAlertModel, IncidentEvidenceModel, IncidentModel


class IncidentRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def add(self, incident: IncidentModel) -> None:
        self.db.add(incident)

    def get(self, incident_id: UUID) -> IncidentModel | None:
        return self.db.get(IncidentModel, incident_id)

    def get_by_investigation(self, investigation_id: UUID) -> IncidentModel | None:
        return self.db.scalar(select(IncidentModel).where(IncidentModel.investigation_id == investigation_id))

    def list(self, *, status: str | None = None, limit: int = 100) -> list[IncidentModel]:
        query = select(IncidentModel).order_by(IncidentModel.created_at.desc()).limit(limit)
        if status is not None:
            query = query.where(IncidentModel.status == status)
        return list(self.db.scalars(query))

    def add_alert(self, link: IncidentAlertModel) -> None:
        self.db.add(link)

    def has_alert(self, incident_id: UUID, alert_id: UUID) -> bool:
        return self.db.scalar(
            select(IncidentAlertModel.id).where(
                IncidentAlertModel.incident_id == incident_id,
                IncidentAlertModel.alert_id == alert_id,
            )
        ) is not None

    def add_evidence(self, link: IncidentEvidenceModel) -> None:
        self.db.add(link)

    def has_evidence(self, incident_id: UUID, evidence_id: UUID) -> bool:
        return self.db.scalar(
            select(IncidentEvidenceModel.id).where(
                IncidentEvidenceModel.incident_id == incident_id,
                IncidentEvidenceModel.evidence_id == evidence_id,
            )
        ) is not None
