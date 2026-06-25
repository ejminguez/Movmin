from pydantic import BaseModel
from typing import Optional, List


class AffectedIncident(BaseModel):
    incident_type: str
    severity: str
    title: str
    estimated_delay_min: int


class CorridorStatusResponse(BaseModel):
    route_id: int
    route_name: str
    color: str
    active_bus_count: int
    avg_speed: float
    avg_delay_min: float
    capacity_utilization: float
    congestion_level: str
    status: str = "ON TIME"
    eta_min: Optional[float] = None
    base_time_min: Optional[float] = None
    incident_delay_min: Optional[float] = None
    traffic_delay_min: Optional[float] = None
    weather_delay_min: Optional[float] = None
    weather_condition: Optional[str] = None
    affected_incidents: List[AffectedIncident] = []
