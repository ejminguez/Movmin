from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.routes import Route
from app.models.buses import Bus
from app.models.incidents import Incident
from app.schemas.corridors import CorridorStatusResponse

router = APIRouter(prefix="/corridors", tags=["Corridors"])


@router.get("/status", response_model=List[CorridorStatusResponse])
def get_corridors_status(db: Session = Depends(get_db)):
    routes = db.query(Route).all()
    status_list = []

    for route in routes:
        buses = db.query(Bus).filter(Bus.route_id == route.id).all()
        active_buses = [b for b in buses if b.status in ("active", "delayed")]

        active_bus_count = len(active_buses)
        
        # Calculate averages
        if active_bus_count > 0:
            avg_speed = sum(b.speed for b in active_buses) / active_bus_count
            total_occupancy = sum(b.occupancy for b in active_buses)
            total_capacity = sum(b.capacity for b in active_buses)
            capacity_utilization = (total_occupancy / total_capacity * 100) if total_capacity > 0 else 0.0
        else:
            avg_speed = 0.0
            capacity_utilization = 0.0

        # Calculate delay from active incidents affecting this route
        active_incidents = db.query(Incident).filter(
            Incident.affected_route_id == route.id,
            Incident.status == "active"
        ).all()
        avg_delay_min = sum(inc.estimated_delay_min for inc in active_incidents)

        # Determine congestion level based on average speed
        if active_bus_count == 0:
            congestion_level = "Low Traffic"
        elif avg_speed >= 45:
            congestion_level = "Low Traffic"
        elif avg_speed >= 30:
            congestion_level = "Moderate Traffic"
        else:
            congestion_level = "Heavy Traffic"

        status_list.append(
            CorridorStatusResponse(
                route_id=route.id,
                route_name=route.name,
                color=route.color,
                active_bus_count=active_bus_count,
                avg_speed=round(avg_speed, 1),
                avg_delay_min=float(avg_delay_min),
                capacity_utilization=round(capacity_utilization, 1),
                congestion_level=congestion_level
            )
        )

    return status_list
