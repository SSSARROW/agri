"""plot boundary_source (walked vs estimated_square)

Revision ID: f1c8b6a2d3e4
Revises: a3f7c2d9e4b1
Create Date: 2026-09-23 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = 'f1c8b6a2d3e4'
down_revision: Union[str, Sequence[str], None] = 'a3f7c2d9e4b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'plot',
        sa.Column('boundary_source', sa.String(), nullable=False, server_default='estimated_square'),
    )


def downgrade() -> None:
    op.drop_column('plot', 'boundary_source')
