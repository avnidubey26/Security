from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.infrastructure.database.models import (
    DetectionResultModel,
    DetectionRuleModel,
    DetectionRuleVersionModel,
)


class DetectionRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_rules(self) -> list[DetectionRuleModel]:
        return list(self.db.scalars(select(DetectionRuleModel).order_by(DetectionRuleModel.created_at, DetectionRuleModel.id)))

    def get_rule(self, rule_id: UUID) -> DetectionRuleModel | None:
        return self.db.get(DetectionRuleModel, rule_id)

    def get_rule_by_slug(self, slug: str) -> DetectionRuleModel | None:
        return self.db.scalar(select(DetectionRuleModel).where(DetectionRuleModel.slug == slug))

    def add_rule(self, rule: DetectionRuleModel) -> None:
        self.db.add(rule)

    def next_version(self, rule_id: UUID) -> int:
        current = self.db.scalar(
            select(func.max(DetectionRuleVersionModel.version)).where(
                DetectionRuleVersionModel.detection_rule_id == rule_id
            )
        )
        return (current or 0) + 1

    def add_version(self, version: DetectionRuleVersionModel) -> None:
        self.db.add(version)

    def get_version(self, rule_id: UUID, version: int) -> DetectionRuleVersionModel | None:
        return self.db.scalar(
            select(DetectionRuleVersionModel).where(
                DetectionRuleVersionModel.detection_rule_id == rule_id,
                DetectionRuleVersionModel.version == version,
            )
        )

    def deactivate_versions(self, rule_id: UUID) -> None:
        versions = self.db.scalars(
            select(DetectionRuleVersionModel).where(
                DetectionRuleVersionModel.detection_rule_id == rule_id,
                DetectionRuleVersionModel.is_active.is_(True),
            )
        )
        for version in versions:
            version.is_active = False

    def list_versions(self, rule_id: UUID) -> list[DetectionRuleVersionModel]:
        return list(
            self.db.scalars(
                select(DetectionRuleVersionModel)
                .where(DetectionRuleVersionModel.detection_rule_id == rule_id)
                .order_by(DetectionRuleVersionModel.version.desc())
            )
        )

    def list_results(self, rule_id: UUID, *, limit: int = 100) -> list[DetectionResultModel]:
        statement = (
            select(DetectionResultModel)
            .join(
                DetectionRuleVersionModel,
                DetectionResultModel.detection_rule_version_id == DetectionRuleVersionModel.id,
            )
            .where(DetectionRuleVersionModel.detection_rule_id == rule_id)
            .order_by(DetectionResultModel.evaluated_at.desc(), DetectionResultModel.id.desc())
            .limit(limit)
        )
        return list(self.db.scalars(statement))
