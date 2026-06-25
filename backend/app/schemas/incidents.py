from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

class IncidentBase(BaseModel):
    id: str
    type: str
    severity: str
    affected_routes: List[str]
    estimated_delay_minutes: int

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
