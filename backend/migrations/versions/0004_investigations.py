"""Add investigation workspace entities."""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0004_investigations"
down_revision = "0003_alert_engine"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "investigations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="OPEN"),
        sa.Column("priority", sa.String(20), nullable=False, server_default="MEDIUM"),
        sa.Column("assigned_to", sa.String(150), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "status IN ('OPEN','IN_PROGRESS','CONTAINED','CLOSED','FALSE_POSITIVE')",
            name="ck_investigations_status",
        ),
        sa.CheckConstraint(
            "priority IN ('LOW','MEDIUM','HIGH','CRITICAL')",
            name="ck_investigations_priority",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_investigations_status_created", "investigations", ["status", "created_at"])
    op.create_index("ix_investigations_priority_created", "investigations", ["priority", "created_at"])
    op.create_index("ix_investigations_assigned_to", "investigations", ["assigned_to"])

    op.create_table(
        "investigation_alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("investigation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("alert_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("relationship_type", sa.String(30), nullable=False, server_default="RELATED"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["investigation_id"], ["investigations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["alert_id"], ["alerts.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("investigation_id", "alert_id", name="uq_investigation_alert"),
    )
    op.create_index("ix_investigation_alerts_investigation", "investigation_alerts", ["investigation_id"])
    op.create_index("ix_investigation_alerts_alert", "investigation_alerts", ["alert_id"])

    op.create_table(
        "investigation_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("investigation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("security_event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("relationship_type", sa.String(30), nullable=False, server_default="INVESTIGATIVE"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["investigation_id"], ["investigations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["security_event_id"], ["security_events.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("investigation_id", "security_event_id", name="uq_investigation_event"),
    )
    op.create_index("ix_investigation_events_investigation", "investigation_events", ["investigation_id"])
    op.create_index("ix_investigation_events_security_event", "investigation_events", ["security_event_id"])

    op.create_table(
        "investigation_notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("investigation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("author", sa.String(150), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["investigation_id"], ["investigations.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_investigation_notes_investigation_created", "investigation_notes", ["investigation_id", "created_at"])

    op.create_table(
        "investigation_findings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("investigation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("finding_type", sa.String(30), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("author", sa.String(150), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "finding_type IN ('OBSERVATION','ROOT_CAUSE','IMPACT','RECOMMENDATION')",
            name="ck_investigation_finding_type",
        ),
        sa.ForeignKeyConstraint(["investigation_id"], ["investigations.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_investigation_findings_investigation_created", "investigation_findings", ["investigation_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_investigation_findings_investigation_created", table_name="investigation_findings")
    op.drop_table("investigation_findings")
    op.drop_index("ix_investigation_notes_investigation_created", table_name="investigation_notes")
    op.drop_table("investigation_notes")
    op.drop_index("ix_investigation_events_security_event", table_name="investigation_events")
    op.drop_index("ix_investigation_events_investigation", table_name="investigation_events")
    op.drop_table("investigation_events")
    op.drop_index("ix_investigation_alerts_alert", table_name="investigation_alerts")
    op.drop_index("ix_investigation_alerts_investigation", table_name="investigation_alerts")
    op.drop_table("investigation_alerts")
    op.drop_index("ix_investigations_assigned_to", table_name="investigations")
    op.drop_index("ix_investigations_priority_created", table_name="investigations")
    op.drop_index("ix_investigations_status_created", table_name="investigations")
    op.drop_table("investigations")
