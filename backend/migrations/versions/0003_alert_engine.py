"""Add alert entities and detection-result traceability."""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003_alert_engine"
down_revision = "0002_detection_engine"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("detection_result_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("detection_rule_version_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False),
        sa.Column("confidence", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("explanation", postgresql.JSONB(), nullable=False),
        sa.Column("context", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True)),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("confidence >= 0 AND confidence <= 100", name="ck_alerts_confidence"),
        sa.CheckConstraint(
            "status IN ('NEW', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED')",
            name="ck_alerts_status",
        ),
        sa.ForeignKeyConstraint(
            ["detection_result_id"],
            ["detection_results.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["detection_rule_version_id"],
            ["detection_rule_versions.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("detection_result_id", name="uq_alert_detection_result"),
    )
    op.create_index("ix_alerts_status_created", "alerts", ["status", "created_at"])
    op.create_index("ix_alerts_severity_created", "alerts", ["severity", "created_at"])
    op.create_index(
        "ix_alerts_rule_version_created",
        "alerts",
        ["detection_rule_version_id", "created_at"],
    )

    op.create_table(
        "alert_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("alert_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("security_event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("relationship_type", sa.String(30), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["alert_id"], ["alerts.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["security_event_id"], ["security_events.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("alert_id", "security_event_id", name="uq_alert_event"),
    )
    op.create_index("ix_alert_events_alert", "alert_events", ["alert_id"])
    op.create_index("ix_alert_events_security_event", "alert_events", ["security_event_id"])


def downgrade() -> None:
    op.drop_index("ix_alert_events_security_event", table_name="alert_events")
    op.drop_index("ix_alert_events_alert", table_name="alert_events")
    op.drop_table("alert_events")
    op.drop_index("ix_alerts_rule_version_created", table_name="alerts")
    op.drop_index("ix_alerts_severity_created", table_name="alerts")
    op.drop_index("ix_alerts_status_created", table_name="alerts")
    op.drop_table("alerts")
