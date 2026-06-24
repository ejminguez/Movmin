from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class BusBase(BaseModel):
    route_id: int
    name: str
    license_plate: Optional[str] = None
    capacity: int = 50
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    speed: float = 0.0
    occupancy: int = 0
    status: str = "active"


class BusCreate(BusBase):
    pass


class BusResponse(BusBase):
    id: int
    last_updated: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
