from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

class IncidentBase(BaseModel):
    id: str
    type: str
    severity: str
    affected_routes: List[str]
    estimated_delay_minutes: int
    source: str = "simulation"

class IncidentListResponse(IncidentBase):
    pass

class IncidentDetailResponse(IncidentBase):
    title: str
    description: Optional[str] = None
    latitude: float
    longitude: float
    status: str
    created_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None

class IncidentCreateRequest(BaseModel):
    incident_type: str
    severity: str = "MEDIUM"
    title: Optional[str] = None
    description: Optional[str] = None
    lat: float
    lng: float
    affected_route_id: int
    estimated_delay_min: int = 10
    duration_minutes: Optional[int] = None
    source: str = "manual"
