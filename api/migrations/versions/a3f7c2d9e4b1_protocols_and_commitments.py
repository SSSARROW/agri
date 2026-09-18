"""protocols (B-30) and buyer commitments (B-50)

Revision ID: a3f7c2d9e4b1
Revises: 88b32a1e5167
Create Date: 2026-09-18 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = 'a3f7c2d9e4b1'
down_revision: Union[str, Sequence[str], None] = '88b32a1e5167'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'protocol',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('crop', sa.String(), nullable=False),
        sa.Column('tier', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('source', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'protocol_stage',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('protocol_id', sa.UUID(), nullable=False),
        sa.Column('sequence', sa.Integer(), nullable=False),
        sa.Column('day_offset', sa.Integer(), nullable=True),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('instructions', sa.String(), nullable=False),
        sa.Column('required_event_types', postgresql.ARRAY(sa.String()), nullable=True),
        sa.ForeignKeyConstraint(['protocol_id'], ['protocol.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'commitment',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('buyer_user_id', sa.UUID(), nullable=False),
        sa.Column('crop', sa.String(), nullable=False),
        sa.Column('protocol_id', sa.UUID(), nullable=True),
        sa.Column('volume_kg', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('remaining_kg', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('delivery_window_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('delivery_window_end', sa.DateTime(timezone=True), nullable=False),
        sa.Column('indicative_price_lkr_per_kg', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['buyer_user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['protocol_id'], ['protocol.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.add_column('batch', sa.Column('protocol_id', sa.UUID(), nullable=True))
    op.add_column('batch', sa.Column('commitment_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_batch_protocol_id', 'batch', 'protocol', ['protocol_id'], ['id'])
    op.create_foreign_key('fk_batch_commitment_id', 'batch', 'commitment', ['commitment_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_batch_commitment_id', 'batch', type_='foreignkey')
    op.drop_constraint('fk_batch_protocol_id', 'batch', type_='foreignkey')
    op.drop_column('batch', 'commitment_id')
    op.drop_column('batch', 'protocol_id')
    op.drop_table('commitment')
    op.drop_table('protocol_stage')
    op.drop_table('protocol')
