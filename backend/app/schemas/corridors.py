from pydantic import BaseModel
from typing import Optional


class CorridorStatusResponse(BaseModel):
    route_id: int
    route_name: str
    color: str
    active_bus_count: int
    avg_speed: float
    avg_delay_min: float
    capacity_utilization: float
    congestion_level: str
