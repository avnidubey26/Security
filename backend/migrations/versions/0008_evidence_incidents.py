"""add evidence and incident management

Revision ID: 0008_evidence_incidents
Revises: 0007_lab_expansion
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0008_evidence_incidents"
down_revision = "0007_lab_expansion"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "evidence",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("investigation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("evidence_type", sa.String(40), nullable=False),
        sa.Column("source_type", sa.String(40), nullable=False),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("snapshot", postgresql.JSONB(), nullable=False),
        sa.Column("provenance", postgresql.JSONB(), nullable=False),
        sa.Column("integrity_hash", sa.String(64), nullable=False),
        sa.Column("collected_by", sa.String(150), nullable=False),
        sa.Column("collected_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["investigation_id"], ["investigations.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("investigation_id", "source_type", "source_id", name="uq_evidence_investigation_source"),
        sa.CheckConstraint(
            "source_type IN ('ALERT','DETECTION_RESULT','SECURITY_EVENT','TIMELINE_ENTRY','INVESTIGATION_NOTE','INVESTIGATION_FINDING')",
            name="ck_evidence_source_type",
        ),
        sa.CheckConstraint(
            "evidence_type IN ('ALERT','DETECTION_RESULT','SECURITY_EVENT','TIMELINE_ENTRY','ANALYST_NOTE','INVESTIGATION_FINDING')",
            name="ck_evidence_type",
        ),
    )
    op.create_index("ix_evidence_investigation_created", "evidence", ["investigation_id", "created_at"])
    op.create_index("ix_evidence_source", "evidence", ["source_type", "source_id"])
    op.create_index("ix_evidence_integrity_hash", "evidence", ["integrity_hash"])

    op.execute(sa.text("CREATE SEQUENCE incident_number_seq START WITH 1 INCREMENT BY 1"))
    op.create_table(
        "incidents",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("incident_number", sa.String(30), nullable=False),
        sa.Column("investigation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("severity", sa.String(20), nullable=False, server_default="MEDIUM"),
        sa.Column("status", sa.String(30), nullable=False, server_default="OPEN"),
        sa.Column("assigned_to", sa.String(150), nullable=True),
        sa.Column("detected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("contained_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["investigation_id"], ["investigations.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("incident_number"),
        sa.UniqueConstraint("investigation_id"),
        sa.CheckConstraint("severity IN ('LOW','MEDIUM','HIGH','CRITICAL')", name="ck_incident_severity"),
        sa.CheckConstraint("status IN ('OPEN','CONTAINED','RESOLVED','CLOSED','FALSE_POSITIVE')", name="ck_incident_status"),
    )
    op.create_index("ix_incidents_status_created", "incidents", ["status", "created_at"])
    op.create_index("ix_incidents_severity_created", "incidents", ["severity", "created_at"])

    op.create_table(
        "incident_alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("incident_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("alert_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("relationship_type", sa.String(30), nullable=False, server_default="RELATED"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["incident_id"], ["incidents.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["alert_id"], ["alerts.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("incident_id", "alert_id", name="uq_incident_alert"),
    )
    op.create_index("ix_incident_alerts_incident", "incident_alerts", ["incident_id"])
    op.create_index("ix_incident_alerts_alert", "incident_alerts", ["alert_id"])

    op.create_table(
        "incident_evidence",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("incident_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("evidence_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["incident_id"], ["incidents.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["evidence_id"], ["evidence.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("incident_id", "evidence_id", name="uq_incident_evidence"),
    )
    op.create_index("ix_incident_evidence_incident", "incident_evidence", ["incident_id"])
    op.create_index("ix_incident_evidence_evidence", "incident_evidence", ["evidence_id"])


def downgrade() -> None:
    op.drop_index("ix_incident_evidence_evidence", table_name="incident_evidence")
    op.drop_index("ix_incident_evidence_incident", table_name="incident_evidence")
    op.drop_table("incident_evidence")
    op.drop_index("ix_incident_alerts_alert", table_name="incident_alerts")
    op.drop_index("ix_incident_alerts_incident", table_name="incident_alerts")
    op.drop_table("incident_alerts")
    op.drop_index("ix_incidents_severity_created", table_name="incidents")
    op.drop_index("ix_incidents_status_created", table_name="incidents")
    op.drop_table("incidents")
    op.execute(sa.text("DROP SEQUENCE IF EXISTS incident_number_seq"))
    op.drop_index("ix_evidence_integrity_hash", table_name="evidence")
    op.drop_index("ix_evidence_source", table_name="evidence")
    op.drop_index("ix_evidence_investigation_created", table_name="evidence")
    op.drop_table("evidence")
