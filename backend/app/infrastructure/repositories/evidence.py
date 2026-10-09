from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.infrastructure.database.models.evidence import EvidenceModel


class EvidenceRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def add(self, evidence: EvidenceModel) -> None:
        self.db.add(evidence)

    def get(self, evidence_id: UUID) -> EvidenceModel | None:
        return self.db.get(EvidenceModel, evidence_id)

    def get_by_source(self, investigation_id: UUID, source_type: str, source_id: UUID) -> EvidenceModel | None:
        return self.db.scalar(
            select(EvidenceModel).where(
                EvidenceModel.investigation_id == investigation_id,
                EvidenceModel.source_type == source_type,
                EvidenceModel.source_id == source_id,
            )
        )

    def list_for_investigation(self, investigation_id: UUID) -> list[EvidenceModel]:
        return list(
            self.db.scalars(
                select(EvidenceModel)
                .where(EvidenceModel.investigation_id == investigation_id)
                .order_by(EvidenceModel.created_at.asc())
            )
        )
