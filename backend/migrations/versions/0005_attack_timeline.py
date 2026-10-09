"""add attack timeline

Revision ID: 0005_attack_timeline
Revises: 0004_investigations
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0005_attack_timeline"
down_revision = "0004_investigations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "timeline_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("investigation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("security_event_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("entry_type", sa.String(40), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sequence_number", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(100), nullable=True),
        sa.Column("context", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["investigation_id"], ["investigations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["security_event_id"], ["security_events.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("investigation_id", "security_event_id", name="uq_timeline_investigation_event"),
        sa.UniqueConstraint("investigation_id", "sequence_number", name="uq_timeline_investigation_sequence"),
        sa.CheckConstraint(
            "entry_type IN ('AUTHENTICATION_FAILED','AUTHENTICATION_SUCCESS','PROCESS_EXECUTION','NETWORK_ACTIVITY','FILE_ACTIVITY','PRIVILEGE_ACTIVITY','WEB_ACTIVITY','OTHER')",
            name="ck_timeline_entry_type",
        ),
    )
    op.create_index("ix_timeline_entries_investigation_occurred", "timeline_entries", ["investigation_id", "occurred_at"])
    op.create_index("ix_timeline_entries_investigation_sequence", "timeline_entries", ["investigation_id", "sequence_number"])
    op.create_index("ix_timeline_entries_security_event", "timeline_entries", ["security_event_id"])


def downgrade() -> None:
    op.drop_index("ix_timeline_entries_security_event", table_name="timeline_entries")
    op.drop_index("ix_timeline_entries_investigation_sequence", table_name="timeline_entries")
    op.drop_index("ix_timeline_entries_investigation_occurred", table_name="timeline_entries")
    op.drop_table("timeline_entries")
