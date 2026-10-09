"""Expand the controlled security lab scenario catalog."""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0007_lab_expansion"
down_revision = "0006_mitre_attack"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCENARIOS = [
    {
        "id": "8b3a8a45-0e75-4e3a-a6c2-4d4f0d4d1e01",
        "name": "Authentication Brute Force to Command Execution",
        "slug": "auth-bruteforce-command-execution",
        "description": "Controlled defensive scenario generating repeated failed authentication, a successful login, and subsequent process execution.",
        "runner_key": "auth_bruteforce_command",
        "parameter_schema": {
            "type": "object",
            "properties": {
                "username": {"type": "string", "minLength": 1, "maxLength": 150},
                "source_ip": {"type": "string", "format": "ipv4_or_ipv6"},
            },
            "additionalProperties": False,
        },
        "allowed_platforms": ["Linux"],
    },
    {
        "id": "1a9d1db3-6b4b-4e76-9a5d-7b1e4e8d1c20",
        "name": "Suspicious Process Chain Simulation",
        "slug": "suspicious-process-chain",
        "description": "Synthetic telemetry representing a shell launching a network utility and a file operation. No commands are executed on the host.",
        "runner_key": "suspicious_process_chain",
        "parameter_schema": {
            "type": "object",
            "properties": {
                "username": {"type": "string", "minLength": 1, "maxLength": 150},
                "source_ip": {"type": "string", "format": "ipv4_or_ipv6"},
                "hostname": {"type": "string", "minLength": 1, "maxLength": 255},
            },
            "additionalProperties": False,
        },
        "allowed_platforms": ["Linux"],
    },
    {
        "id": "2f6b6d5c-1a53-47c5-bd93-4e6e8a7d2f31",
        "name": "Network Port Sweep Simulation",
        "slug": "network-port-sweep",
        "description": "Synthetic network telemetry representing a bounded port sweep against a lab destination. No network packets are sent.",
        "runner_key": "network_port_sweep",
        "parameter_schema": {
            "type": "object",
            "properties": {
                "source_ip": {"type": "string", "format": "ipv4_or_ipv6"},
                "destination_ip": {"type": "string", "format": "ipv4_or_ipv6"},
                "ports": {"type": "array", "items": {"type": "integer", "minimum": 1, "maximum": 65535}, "minItems": 1, "maxItems": 10},
            },
            "required": ["ports"],
            "additionalProperties": False,
        },
        "allowed_platforms": ["Linux"],
    },
]


def upgrade() -> None:
    op.add_column("scenarios", sa.Column("execution_mode", sa.String(20), nullable=False, server_default="SYNTHETIC"))
    op.add_column("scenarios", sa.Column("runner_key", sa.String(100), nullable=False, server_default="auth_bruteforce_command"))
    op.add_column("scenarios", sa.Column("parameter_schema", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")))
    op.add_column("scenarios", sa.Column("allowed_platforms", postgresql.JSONB(), nullable=False, server_default=sa.text("'[\"Linux\"]'::jsonb")))
    op.create_index("ix_scenarios_runner_key", "scenarios", ["runner_key"])

    for scenario in SCENARIOS:
        op.execute(
            sa.text(
                """
                INSERT INTO scenarios
                    (id, name, slug, description, is_active, execution_mode, runner_key, parameter_schema, allowed_platforms)
                VALUES
                    (CAST(:id AS UUID), :name, :slug, :description, true, 'SYNTHETIC', :runner_key,
                     CAST(:parameter_schema AS JSONB), CAST(:allowed_platforms AS JSONB))
                ON CONFLICT (slug) DO UPDATE SET
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    runner_key = EXCLUDED.runner_key,
                    parameter_schema = EXCLUDED.parameter_schema,
                    allowed_platforms = EXCLUDED.allowed_platforms,
                    execution_mode = EXCLUDED.execution_mode
                """
            ).bindparams(
                id=scenario["id"],
                name=scenario["name"],
                slug=scenario["slug"],
                description=scenario["description"],
                runner_key=scenario["runner_key"],
                parameter_schema=__import__("json").dumps(scenario["parameter_schema"]),
                allowed_platforms=__import__("json").dumps(scenario["allowed_platforms"]),
            )
        )


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM scenarios WHERE slug IN ('suspicious-process-chain', 'network-port-sweep')"))
    op.drop_index("ix_scenarios_runner_key", table_name="scenarios")
    op.drop_column("scenarios", "allowed_platforms")
    op.drop_column("scenarios", "parameter_schema")
    op.drop_column("scenarios", "runner_key")
    op.drop_column("scenarios", "execution_mode")
