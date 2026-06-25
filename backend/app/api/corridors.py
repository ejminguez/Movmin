from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.routes import Route
from app.models.buses import Bus
from app.models.incidents import Incident
from app.schemas.corridors import CorridorStatusResponse, AffectedIncident
from app.services.eta import get_route_eta

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

        # Determine congestion level based on average speed
        if active_bus_count == 0:
            congestion_level = "Low Traffic"
        elif avg_speed >= 45:
            congestion_level = "Low Traffic"
        elif avg_speed >= 30:
            congestion_level = "Moderate Traffic"
        else:
            congestion_level = "Heavy Traffic"

        # Use centralized incident-aware ETA service — single source of truth
        eta_data = get_route_eta(route.id, db)

        status_list.append(
            CorridorStatusResponse(
                route_id=route.id,
                route_name=route.name,
                color=route.color,
                active_bus_count=active_bus_count,
                avg_speed=round(avg_speed, 1),
                avg_delay_min=float(eta_data["total_time_min"] - eta_data["base_time_min"]) if eta_data else 0.0,
                capacity_utilization=round(capacity_utilization, 1),
                congestion_level=congestion_level,
                status=eta_data["status"] if eta_data else "ON TIME",
                eta_min=eta_data["total_time_min"] if eta_data else None,
                base_time_min=eta_data["base_time_min"] if eta_data else None,
                incident_delay_min=eta_data["incident_delay_min"] if eta_data else None,
                traffic_delay_min=eta_data["traffic_delay_min"] if eta_data else None,
                weather_delay_min=eta_data["weather_delay_min"] if eta_data else None,
                weather_condition=eta_data["weather_condition"] if eta_data else None,
                affected_incidents=[
                    AffectedIncident(**inc) for inc in (eta_data.get("affected_incidents") or [])
                ] if eta_data else [],
            )
        )

    return status_list
