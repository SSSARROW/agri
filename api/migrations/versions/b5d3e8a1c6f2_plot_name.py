"""plot name (optional, farmer-chosen label)

Revision ID: b5d3e8a1c6f2
Revises: a7e2c9f4b8d1
Create Date: 2026-09-27 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = 'b5d3e8a1c6f2'
down_revision: Union[str, Sequence[str], None] = 'a7e2c9f4b8d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('plot', sa.Column('name', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('plot', 'name')
