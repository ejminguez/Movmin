from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional


class AnalyticSnapshotResponse(BaseModel):
    id: int
    route_id: int
    route_name: str
    color: str
    timestamp: datetime
    avg_travel_time_min: Optional[float] = None
    avg_delay_min: Optional[float] = None
    on_time_performance: Optional[float] = None
    utilization: Optional[float] = None
    active_bus_count: int

    class Config:
        from_attributes = True


class RouteAnalyticsSummary(BaseModel):
    route_id: int
    route_name: str
    color: str
    current_utilization: float
    avg_utilization: float
    current_delay_min: float
    avg_delay_min: float
    current_otp: float
    avg_otp: float
    snapshot_count: int


class RouteSnapshotResponse(BaseModel):
    route_id: int
    route_name: str
    color: str
    snapshots: List[AnalyticSnapshotResponse]
