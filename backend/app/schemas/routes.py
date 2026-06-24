from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Tuple


class RouteBase(BaseModel):
    name: str
    description: Optional[str] = None
    color: str
    distance_km: Optional[float] = None


class RouteCreate(RouteBase):
    pass


class RouteResponse(RouteBase):
    id: int
    waypoints: List[List[float]] = []

    model_config = ConfigDict(from_attributes=True)

