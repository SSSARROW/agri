"""plot plot_type (open_field/greenhouse/shade_house/hydroponic)

Revision ID: a7e2c9f4b8d1
Revises: f1c8b6a2d3e4
Create Date: 2026-09-23 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = 'a7e2c9f4b8d1'
down_revision: Union[str, Sequence[str], None] = 'f1c8b6a2d3e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'plot',
        sa.Column('plot_type', sa.String(), nullable=False, server_default='open_field'),
    )


def downgrade() -> None:
    op.drop_column('plot', 'plot_type')
