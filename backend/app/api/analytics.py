from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.routes import Route
from app.models.analytics import Analytic
from app.schemas.analytics import AnalyticSnapshotResponse, RouteAnalyticsSummary, RouteSnapshotResponse
from app.services.analytics import get_route_history, get_route_summary

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/routes", response_model=List[AnalyticSnapshotResponse])
def get_latest_analytics(db: Session = Depends(get_db)):
    """Fetch the latest snapshot for all routes."""
    routes = db.query(Route).all()
    results = []
    for route in routes:
        latest = db.query(Analytic).filter(
            Analytic.route_id == route.id
        ).order_by(Analytic.timestamp.desc()).first()
        
        if latest:
            results.append(
                AnalyticSnapshotResponse(
                    id=latest.id,
                    route_id=latest.route_id,
                    route_name=route.name,
                    color=route.color,
                    timestamp=latest.timestamp,
                    avg_travel_time_min=latest.avg_travel_time_min,
                    avg_delay_min=latest.avg_delay_min,
                    on_time_performance=latest.on_time_performance,
                    utilization=latest.utilization,
                    active_bus_count=latest.active_bus_count
                )
            )
    return results


@router.get("/routes/{route_id}", response_model=RouteSnapshotResponse)
def get_route_analytics_history(route_id: int, minutes: int = 60, db: Session = Depends(get_db)):
    """Fetch historical snapshots for a specific route within the last N minutes."""
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
        
    snapshots = get_route_history(db, route_id, minutes)
    
    mapped_snapshots = [
        AnalyticSnapshotResponse(
            id=s.id,
            route_id=s.route_id,
            route_name=route.name,
            color=route.color,
            timestamp=s.timestamp,
            avg_travel_time_min=s.avg_travel_time_min,
            avg_delay_min=s.avg_delay_min,
            on_time_performance=s.on_time_performance,
            utilization=s.utilization,
            active_bus_count=s.active_bus_count
        ) for s in snapshots
    ]
        
    return RouteSnapshotResponse(
        route_id=route.id,
        route_name=route.name,
        color=route.color,
        snapshots=mapped_snapshots
    )


@router.get("/routes/{route_id}/summary", response_model=RouteAnalyticsSummary)
def get_route_analytics_summary_api(route_id: int, db: Session = Depends(get_db)):
    """Fetch aggregated KPIs for a route."""
    summary = get_route_summary(db, route_id)
    if not summary:
        raise HTTPException(status_code=404, detail="Route not found")
    return summary
