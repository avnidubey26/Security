"""add MITRE ATT&CK catalog and mappings

Revision ID: 0006_mitre_attack
Revises: 0005_attack_timeline
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0006_mitre_attack"
down_revision = "0005_attack_timeline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "mitre_tactics",
        sa.Column("id", sa.String(20), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "mitre_techniques",
        sa.Column("id", sa.String(20), nullable=False),
        sa.Column("tactic_id", sa.String(20), nullable=False),
        sa.Column("parent_technique_id", sa.String(20)),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("domain", sa.String(50), nullable=False),
        sa.Column("platforms", postgresql.JSONB()),
        sa.Column("version", sa.String(30)),
        sa.Column("last_modified", sa.String(30)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["tactic_id"], ["mitre_tactics.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["parent_technique_id"], ["mitre_techniques.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "detection_rule_mitre_mappings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("detection_rule_version_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("technique_id", sa.String(20), nullable=False),
        sa.Column("rationale", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["detection_rule_version_id"], ["detection_rule_versions.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["technique_id"], ["mitre_techniques.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("detection_rule_version_id", "technique_id", name="uq_detection_rule_mitre_mapping"),
    )
    op.create_table(
        "investigation_mitre_mappings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("investigation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("technique_id", sa.String(20), nullable=False),
        sa.Column("rationale", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["investigation_id"], ["investigations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["technique_id"], ["mitre_techniques.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("investigation_id", "technique_id", name="uq_investigation_mitre_mapping"),
    )
    op.create_table(
        "timeline_mitre_mappings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("timeline_entry_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("technique_id", sa.String(20), nullable=False),
        sa.Column("rationale", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["timeline_entry_id"], ["timeline_entries.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["technique_id"], ["mitre_techniques.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("timeline_entry_id", "technique_id", name="uq_timeline_mitre_mapping"),
    )
    for name, table, cols in [
        ("ix_detection_rule_mitre_mapping_version", "detection_rule_mitre_mappings", ["detection_rule_version_id"]),
        ("ix_detection_rule_mitre_mapping_technique", "detection_rule_mitre_mappings", ["technique_id"]),
        ("ix_investigation_mitre_mapping_investigation", "investigation_mitre_mappings", ["investigation_id"]),
        ("ix_investigation_mitre_mapping_technique", "investigation_mitre_mappings", ["technique_id"]),
        ("ix_timeline_mitre_mapping_entry", "timeline_mitre_mappings", ["timeline_entry_id"]),
        ("ix_timeline_mitre_mapping_technique", "timeline_mitre_mappings", ["technique_id"]),
    ]:
        op.create_index(name, table, cols)

    op.bulk_insert(sa.table("mitre_tactics", sa.column("id", sa.String), sa.column("name", sa.String), sa.column("description", sa.Text())), [
        {"id": "TA0006", "name": "Credential Access", "description": "The adversary is trying to steal account names and passwords."},
        {"id": "TA0007", "name": "Discovery", "description": "The adversary is trying to figure out your environment."},
    ])
    op.bulk_insert(
        sa.table("mitre_techniques", sa.column("id", sa.String), sa.column("tactic_id", sa.String), sa.column("parent_technique_id", sa.String), sa.column("name", sa.String), sa.column("description", sa.Text()), sa.column("domain", sa.String), sa.column("platforms", postgresql.JSONB()), sa.column("version", sa.String), sa.column("last_modified", sa.String)),
        [
            {"id": "T1110", "tactic_id": "TA0006", "parent_technique_id": None, "name": "Brute Force", "description": "Adversaries may use brute force techniques to gain access to accounts.", "domain": "enterprise", "platforms": ["Linux", "Windows", "macOS", "Network Devices", "SaaS"], "version": "2.8", "last_modified": "2026-05-12"},
            {"id": "T1110.001", "tactic_id": "TA0006", "parent_technique_id": "T1110", "name": "Password Guessing", "description": "Adversaries may guess passwords to attempt access to accounts.", "domain": "enterprise", "platforms": ["Linux", "Windows", "macOS", "Network Devices", "SaaS"], "version": "1.7", "last_modified": "2026-05-12"},
            {"id": "T1087", "tactic_id": "TA0007", "parent_technique_id": None, "name": "Account Discovery", "description": "Adversaries may attempt to get a listing of valid accounts, usernames, or email addresses.", "domain": "enterprise", "platforms": ["Linux", "Windows", "macOS", "ESXi", "IaaS", "SaaS"], "version": "2.6", "last_modified": "2026-05-12"},
            {"id": "T1087.001", "tactic_id": "TA0007", "parent_technique_id": "T1087", "name": "Local Account", "description": "Adversaries may attempt to get a listing of local system accounts.", "domain": "enterprise", "platforms": ["Linux", "Windows", "macOS", "ESXi"], "version": "1.5", "last_modified": "2026-05-12"},
        ],
    )


def downgrade() -> None:
    for name, table in [
        ("ix_timeline_mitre_mapping_technique", "timeline_mitre_mappings"),
        ("ix_timeline_mitre_mapping_entry", "timeline_mitre_mappings"),
        ("ix_investigation_mitre_mapping_technique", "investigation_mitre_mappings"),
        ("ix_investigation_mitre_mapping_investigation", "investigation_mitre_mappings"),
        ("ix_detection_rule_mitre_mapping_technique", "detection_rule_mitre_mappings"),
        ("ix_detection_rule_mitre_mapping_version", "detection_rule_mitre_mappings"),
    ]:
        op.drop_index(name, table_name=table)
    op.drop_table("timeline_mitre_mappings")
    op.drop_table("investigation_mitre_mappings")
    op.drop_table("detection_rule_mitre_mappings")
    op.drop_table("mitre_techniques")
    op.drop_table("mitre_tactics")
