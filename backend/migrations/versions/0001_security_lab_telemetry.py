"""Create scenario and telemetry foundations."""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0001_security_lab_telemetry"
down_revision = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCENARIO_ID = "8b3a8a45-0e75-4e3a-a6c2-4d4f0d4d1e01"


def upgrade() -> None:
    op.create_table(
        "scenarios",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "name",
            sa.String(150),
            nullable=False,
        ),
        sa.Column(
            "slug",
            sa.String(100),
            nullable=False,
        ),
        sa.Column(
            "description",
            sa.Text(),
            nullable=False,
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )

    op.create_table(
        "scenario_runs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "scenario_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
        ),
        sa.Column(
            "config",
            postgresql.JSONB(),
            nullable=False,
        ),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
        ),
        sa.Column(
            "completed_at",
            sa.DateTime(timezone=True),
        ),
        sa.Column(
            "error_message",
            sa.Text(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["scenario_id"],
            ["scenarios.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_scenario_runs_scenario_status",
        "scenario_runs",
        ["scenario_id", "status"],
    )

    op.create_index(
        "ix_scenario_runs_created_at",
        "scenario_runs",
        ["created_at"],
    )

    op.create_table(
        "raw_telemetry",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "scenario_run_id",
            postgresql.UUID(as_uuid=True),
        ),
        sa.Column(
            "source",
            sa.String(100),
            nullable=False,
        ),
        sa.Column(
            "event_type",
            sa.String(100),
            nullable=False,
        ),
        sa.Column(
            "received_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "payload",
            postgresql.JSONB(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["scenario_run_id"],
            ["scenario_runs.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_raw_telemetry_run_occurred",
        "raw_telemetry",
        ["scenario_run_id", "occurred_at"],
    )

    op.create_table(
        "security_events",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "raw_telemetry_id",
            postgresql.UUID(as_uuid=True),
        ),
        sa.Column(
            "timestamp",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "event_type",
            sa.String(100),
            nullable=False,
        ),
        sa.Column(
            "source",
            sa.String(100),
            nullable=False,
        ),
        sa.Column(
            "source_user",
            sa.String(150),
        ),
        sa.Column(
            "source_ip",
            sa.String(45),
        ),
        sa.Column(
            "destination_ip",
            sa.String(45),
        ),
        sa.Column(
            "destination_port",
            sa.Integer(),
        ),
        sa.Column(
            "process",
            sa.String(255),
        ),
        sa.Column(
            "parent_process",
            sa.String(255),
        ),
        sa.Column(
            "action",
            sa.String(100),
        ),
        sa.Column(
            "status",
            sa.String(50),
        ),
        sa.Column(
            "hostname",
            sa.String(255),
        ),
        sa.Column(
            "resource",
            sa.String(500),
        ),
        sa.Column(
            "metadata_json",
            postgresql.JSONB(),
        ),
        sa.ForeignKeyConstraint(
            ["raw_telemetry_id"],
            ["raw_telemetry.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    for name, columns in [
        (
            "ix_security_events_timestamp",
            ["timestamp"],
        ),
        (
            "ix_security_events_type_timestamp",
            ["event_type", "timestamp"],
        ),
        (
            "ix_security_events_source_ip",
            ["source_ip"],
        ),
        (
            "ix_security_events_source_user",
            ["source_user"],
        ),
    ]:
        op.create_index(
            name,
            "security_events",
            columns,
        )

    op.execute(
        sa.text(
            """
            INSERT INTO scenarios (
                id,
                name,
                slug,
                description,
                is_active
            )
            VALUES (
                CAST(:id AS UUID),
                :name,
                :slug,
                :description,
                true
            )
            """
        ).bindparams(
            id=SCENARIO_ID,
            name="Authentication Brute Force to Command Execution",
            slug="auth-bruteforce-command-execution",
            description=(
                "Controlled defensive scenario generating repeated failed "
                "authentication, a successful login, and subsequent process "
                "execution."
            ),
        )
    )


def downgrade() -> None:
    for name in [
        "ix_security_events_source_user",
        "ix_security_events_source_ip",
        "ix_security_events_type_timestamp",
        "ix_security_events_timestamp",
    ]:
        op.drop_index(
            name,
            table_name="security_events",
        )

    op.drop_table("security_events")

    op.drop_index(
        "ix_raw_telemetry_run_occurred",
        table_name="raw_telemetry",
    )

    op.drop_table("raw_telemetry")

    op.drop_index(
        "ix_scenario_runs_created_at",
        table_name="scenario_runs",
    )

    op.drop_index(
        "ix_scenario_runs_scenario_status",
        table_name="scenario_runs",
    )

    op.drop_table("scenario_runs")

    op.drop_table("scenarios")