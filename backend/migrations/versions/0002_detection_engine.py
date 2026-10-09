"""Add detection engineering entities and seed the initial detection."""

from collections.abc import Sequence
import json
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0002_detection_engine"
down_revision = "0001_security_lab_telemetry"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

RULE_ID = uuid.UUID("2c6d8f52-0c7d-4a4e-b9f1-0d4d0d8b6c11")
VERSION_ID = uuid.UUID("5f9d8d8a-4f3c-4e2e-9b8e-3c5a7f2d1b44")

INITIAL_DEFINITION = {
    "schema_version": "1.0",
    "type": "sequence",
    "window_seconds": 60,
    "group_by": ["source_ip", "source_user"],
    "steps": [
        {
            "name": "failed_authentication",
            "event_type": "authentication",
            "min_count": 5,
            "conditions": [
                {"field": "action", "operator": "equals", "value": "login"},
                {"field": "status", "operator": "equals", "value": "failed"},
            ],
        },
        {
            "name": "successful_authentication",
            "event_type": "authentication",
            "min_count": 1,
            "conditions": [
                {"field": "action", "operator": "equals", "value": "login"},
                {"field": "status", "operator": "equals", "value": "success"},
            ],
        },
        {
            "name": "identity_discovery_process",
            "event_type": "process_execution",
            "min_count": 1,
            "conditions": [
                {"field": "action", "operator": "equals", "value": "execute"},
                {"field": "metadata.command_family", "operator": "equals", "value": "identity_discovery"},
            ],
        },
    ],
}


def upgrade() -> None:
    op.create_table(
        "detection_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("slug", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )

    op.create_table(
        "detection_rule_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("detection_rule_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("format", sa.String(50), nullable=False),
        sa.Column("definition", postgresql.JSONB(), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False),
        sa.Column("confidence", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("activated_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("confidence >= 0 AND confidence <= 100", name="ck_detection_rule_versions_confidence"),
        sa.ForeignKeyConstraint(["detection_rule_id"], ["detection_rules.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("detection_rule_id", "version", name="uq_detection_rule_version"),
    )
    op.create_index(
        "ix_detection_rule_versions_rule_active",
        "detection_rule_versions",
        ["detection_rule_id", "is_active"],
    )

    op.create_table(
        "detection_tests",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("detection_rule_version_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("events", postgresql.JSONB(), nullable=False),
        sa.Column("expected_match", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(
            ["detection_rule_version_id"],
            ["detection_rule_versions.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "detection_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("detection_rule_version_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("evaluation_type", sa.String(30), nullable=False),
        sa.Column("matched", sa.Boolean(), nullable=False),
        sa.Column("evaluated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("explanation", postgresql.JSONB(), nullable=False),
        sa.Column("matched_event_ids", postgresql.JSONB(), nullable=False),
        sa.Column("context", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(
            ["detection_rule_version_id"],
            ["detection_rule_versions.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_detection_results_rule_evaluated",
        "detection_results",
        ["detection_rule_version_id", "evaluated_at"],
    )
    op.create_index(
        "ix_detection_results_matched",
        "detection_results",
        ["matched", "evaluated_at"],
    )

    op.execute(
        sa.text(
            """
            INSERT INTO detection_rules (
                id, name, slug, description, status
            )
            VALUES (
                CAST(:id AS UUID), :name, :slug, :description, :status
            )
            """
        ).bindparams(
            id=str(RULE_ID),
            name="Brute Force Followed by Successful Login and Identity Discovery",
            slug="auth-bruteforce-success-process",
            description=(
                "Detects five or more failed SSH authentication attempts followed by a "
                "successful login and an identity-discovery process execution within 60 seconds."
            ),
            status="ACTIVE",
        )
    )

    op.execute(
        sa.text(
            """
            INSERT INTO detection_rule_versions (
                id,
                detection_rule_id,
                version,
                format,
                definition,
                severity,
                confidence,
                is_active,
                activated_at
            )
            VALUES (
                CAST(:id AS UUID),
                CAST(:rule_id AS UUID),
                1,
                :format,
                CAST(:definition AS JSONB),
                :severity,
                :confidence,
                true,
                NOW()
            )
            """
        ).bindparams(
            id=str(VERSION_ID),
            rule_id=str(RULE_ID),
            format="sigma-inspired",
            definition=json.dumps(INITIAL_DEFINITION),
            severity="HIGH",
            confidence=95,
        )
    )


def downgrade() -> None:
    op.drop_index("ix_detection_results_matched", table_name="detection_results")
    op.drop_index("ix_detection_results_rule_evaluated", table_name="detection_results")
    op.drop_table("detection_results")
    op.drop_table("detection_tests")
    op.drop_index("ix_detection_rule_versions_rule_active", table_name="detection_rule_versions")
    op.drop_table("detection_rule_versions")
    op.drop_table("detection_rules")
