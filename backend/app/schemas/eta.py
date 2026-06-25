from pydantic import BaseModel
from typing import Optional


class ETARequest(BaseModel):
    from_terminal_id: int
    to_terminal_id: int


class ETAResponse(BaseModel):
    from_terminal: str
    to_terminal: str
    route_name: str
    distance_km: float
    avg_speed: float
    base_time_min: float
    traffic_delay_min: float
    weather_delay_min: float
    weather_condition: str
    incident_delay_min: float
    total_time_min: float


class BusETAResponse(BaseModel):
    bus_id: int
    bus_name: str
    terminal_id: int
    terminal_name: str
    distance_km: float
    base_time_min: float
    traffic_delay_min: float
    weather_delay_min: float
    incident_delay_min: float
    total_time_min: float
    status: str
