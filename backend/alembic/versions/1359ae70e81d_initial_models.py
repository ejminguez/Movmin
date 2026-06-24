"""initial models

Revision ID: 1359ae70e81d
Revises:
Create Date: 2026-06-25 02:12:46.370697

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '1359ae70e81d'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "routes",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("color", sa.String(7), nullable=False),
        sa.Column("distance_km", sa.Float(), nullable=True),
    )
    op.create_table(
        "buses",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("route_id", sa.Integer(), sa.ForeignKey("routes.id"), nullable=False),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("license_plate", sa.String(20), nullable=True),
        sa.Column("capacity", sa.Integer(), nullable=False, server_default="50"),
        sa.Column("current_lat", sa.Float(), nullable=True),
        sa.Column("current_lng", sa.Float(), nullable=True),
        sa.Column("speed", sa.Float(), server_default="0"),
        sa.Column("occupancy", sa.Integer(), server_default="0"),
        sa.Column("status", sa.String(20), server_default="active"),
        sa.Column("last_updated", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "terminals",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("route_id", sa.Integer(), sa.ForeignKey("routes.id"), nullable=True),
        sa.Column("terminal_type", sa.String(20), server_default="terminal"),
    )
    op.create_table(
        "incidents",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("incident_type", sa.String(30), nullable=False),
        sa.Column("severity", sa.String(20), server_default="moderate"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("affected_route_id", sa.Integer(), sa.ForeignKey("routes.id"), nullable=True),
        sa.Column("estimated_delay_min", sa.Integer(), server_default="0"),
        sa.Column("status", sa.String(20), server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "analytics",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("route_id", sa.Integer(), sa.ForeignKey("routes.id"), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("avg_travel_time_min", sa.Float(), nullable=True),
        sa.Column("avg_delay_min", sa.Float(), nullable=True),
        sa.Column("on_time_performance", sa.Float(), nullable=True),
        sa.Column("utilization", sa.Float(), nullable=True),
        sa.Column("active_bus_count", sa.Integer(), server_default="0"),
    )
    op.create_table(
        "forecasts",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("route_id", sa.Integer(), sa.ForeignKey("routes.id"), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("forecast_hour", sa.DateTime(timezone=True), nullable=False),
        sa.Column("predicted_demand", sa.Integer(), server_default="0"),
        sa.Column("confidence", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("forecasts")
    op.drop_table("analytics")
    op.drop_table("incidents")
    op.drop_table("terminals")
    op.drop_table("buses")
    op.drop_table("routes")
