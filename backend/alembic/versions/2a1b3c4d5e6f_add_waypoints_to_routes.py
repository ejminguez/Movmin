"""add waypoints to routes

Revision ID: 2a1b3c4d5e6f
Revises: 1359ae70e81d
Create Date: 2026-06-25 02:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2a1b3c4d5e6f'
down_revision: Union[str, Sequence[str], None] = '1359ae70e81d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("routes", sa.Column("waypoints", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("routes", "waypoints")
