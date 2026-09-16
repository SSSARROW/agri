"""schema v1: actor, plot, batch, event, scan

Revision ID: 88b32a1e5167
Revises:
Create Date: 2026-09-16 15:35:10.475508

"""
from typing import Sequence, Union

import geoalchemy2
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '88b32a1e5167'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'actor',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column(
            'role',
            sa.Enum('farmer', 'collector', 'processor', 'exporter', 'auditor', 'admin', name='actor_role'),
            nullable=False,
        ),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('phone', sa.String(), nullable=True),
        sa.Column('nic_hash', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('phone'),
    )
    op.create_table(
        'plot',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('owner_actor_id', sa.UUID(), nullable=True),
        sa.Column(
            'geometry',
            geoalchemy2.types.Geometry(geometry_type='POLYGON', srid=4326, from_text='ST_GeomFromEWKT', name='geometry'),
            nullable=False,
        ),
        sa.Column('area_ha', sa.Numeric(precision=10, scale=4), nullable=True),
        sa.Column('district', sa.String(), nullable=True),
        sa.Column('dsd', sa.String(), nullable=True),
        sa.Column('gn_division', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['owner_actor_id'], ['actor.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    # GeoAlchemy2's Geometry type auto-creates a GIST spatial index via an
    # after_create DDL event — an explicit create_index here would collide.
    op.create_table(
        'batch',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('code', sa.String(), nullable=False),
        sa.Column('crop', sa.String(), nullable=False),
        sa.Column('plot_id', sa.UUID(), nullable=True),
        sa.Column('parent_batch_ids', postgresql.ARRAY(sa.UUID()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['plot_id'], ['plot.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code'),
    )
    op.create_table(
        'event',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('event_type', sa.String(), nullable=False),
        sa.Column('actor_id', sa.UUID(), nullable=True),
        sa.Column('batch_id', sa.UUID(), nullable=True),
        sa.Column('plot_id', sa.UUID(), nullable=True),
        sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('occurred_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('recorded_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['actor_id'], ['actor.id']),
        sa.ForeignKeyConstraint(['batch_id'], ['batch.id']),
        sa.ForeignKeyConstraint(['plot_id'], ['plot.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'scan',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('batch_id', sa.UUID(), nullable=True),
        sa.Column('scanned_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('hashed_ip', sa.String(), nullable=False),
        sa.Column('coarse_lat', sa.Float(), nullable=True),
        sa.Column('coarse_lon', sa.Float(), nullable=True),
        sa.Column('user_agent', sa.String(), nullable=True),
        sa.Column('flagged', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['batch_id'], ['batch.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    # Append-only enforcement (B-02): the audit trail is worthless if an event
    # row can be silently changed or removed after the fact.
    op.execute(
        """
        CREATE OR REPLACE FUNCTION forbid_event_mutation()
        RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'event rows are append-only: % is not permitted', TG_OP;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER event_no_update
        BEFORE UPDATE ON event
        FOR EACH ROW EXECUTE FUNCTION forbid_event_mutation();
        """
    )
    op.execute(
        """
        CREATE TRIGGER event_no_delete
        BEFORE DELETE ON event
        FOR EACH ROW EXECUTE FUNCTION forbid_event_mutation();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS event_no_delete ON event;")
    op.execute("DROP TRIGGER IF EXISTS event_no_update ON event;")
    op.execute("DROP FUNCTION IF EXISTS forbid_event_mutation();")
    op.drop_table('scan')
    op.drop_table('event')
    op.drop_table('batch')
    op.drop_table('plot')
    op.drop_table('actor')
    op.execute("DROP TYPE IF EXISTS actor_role;")
