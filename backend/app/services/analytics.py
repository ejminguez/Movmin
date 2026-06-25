import asyncio
import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.routes import Route
from app.models.buses import Bus
from app.models.incidents import Incident
from app.models.analytics import Analytic
from app.schemas.analytics import RouteAnalyticsSummary

logger = logging.getLogger(__name__)


def take_snapshot(db: Session):
    """Compute per-route metrics and insert them into the analytics table."""
    try:
        routes = db.query(Route).all()
        if not routes:
            logger.warning("No routes found for analytics snapshot.")
            return

        for route in routes:
            # Query active buses on route
            active_buses = db.query(Bus).filter(
                Bus.route_id == route.id,
                Bus.status.in_(["active", "delayed"])
            ).all()

            active_bus_count = len(active_buses)

            # Calculate average speed and travel time
            if active_bus_count > 0:
                avg_speed = sum(b.speed for b in active_buses) / active_bus_count
                avg_travel_time_min = (route.distance_km / max(avg_speed, 1.0)) * 60 if route.distance_km else 0.0
                
                total_occupancy = sum(b.occupancy for b in active_buses)
                total_capacity = sum(b.capacity for b in active_buses)
                utilization = (total_occupancy / total_capacity * 100) if total_capacity > 0 else 0.0
            else:
                # Default values if no buses are running
                avg_travel_time_min = (route.distance_km / 45.0) * 60 if route.distance_km else 0.0
                utilization = 0.0

            # Calculate delay from active incidents affecting this route
            active_incidents = db.query(Incident).filter(
                Incident.affected_route_id == route.id,
                Incident.status == "active"
            ).all()
            avg_delay_min = sum(inc.estimated_delay_min for inc in active_incidents)

            # Calculate on-time performance based on average delay
            if avg_delay_min == 0:
                otp = 100.0
            elif avg_delay_min <= 5:
                otp = 90.0
            elif avg_delay_min <= 15:
                otp = 70.0
            else:
                otp = 40.0

            # Insert snapshot record
            snapshot = Analytic(
                route_id=route.id,
                avg_travel_time_min=round(avg_travel_time_min, 1) if avg_travel_time_min is not None else None,
                avg_delay_min=float(avg_delay_min),
                on_time_performance=otp,
                utilization=round(utilization, 1),
                active_bus_count=active_bus_count
            )
            db.add(snapshot)

        db.commit()
        logger.info(f"Analytics snapshot saved successfully for {len(routes)} routes.")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to save analytics snapshot: {e}", exc_info=True)


async def start_snapshot_scheduler():
    """Background task that takes a snapshot of routes every 30 seconds."""
    logger.info("Initializing analytics snapshot scheduler...")
    # Wait a few seconds on startup to allow database initialization and seeding
    await asyncio.sleep(5)
    while True:
        try:
            logger.info("Running scheduled analytics snapshot...")
            with SessionLocal() as db:
                take_snapshot(db)
        except Exception as e:
            logger.error(f"Error in analytics snapshot scheduler execution: {e}", exc_info=True)
        
        await asyncio.sleep(30)


def get_route_history(db: Session, route_id: int, minutes: int = 60):
    """Query snapshots for a specific route within the last N minutes."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    
    # Query database
    return db.query(Analytic).filter(
        Analytic.route_id == route_id,
        Analytic.timestamp >= cutoff
    ).order_by(Analytic.timestamp.asc()).all()


def get_route_summary(db: Session, route_id: int) -> RouteAnalyticsSummary:
    """Aggregate metrics over all history for a specific route."""
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        return None

    snapshots = db.query(Analytic).filter(
        Analytic.route_id == route_id
    ).order_by(Analytic.timestamp.desc()).all()

    if not snapshots:
        return RouteAnalyticsSummary(
            route_id=route.id,
            route_name=route.name,
            color=route.color,
            current_utilization=0.0,
            avg_utilization=0.0,
            current_delay_min=0.0,
            avg_delay_min=0.0,
            current_otp=100.0,
            avg_otp=100.0,
            snapshot_count=0
        )

    snapshot_count = len(snapshots)
    current = snapshots[0]

    current_utilization = current.utilization or 0.0
    current_delay_min = current.avg_delay_min or 0.0
    current_otp = current.on_time_performance or 100.0

    avg_utilization = sum(s.utilization or 0.0 for s in snapshots) / snapshot_count
    avg_delay_min = sum(s.avg_delay_min or 0.0 for s in snapshots) / snapshot_count
    avg_otp = sum(s.on_time_performance or 100.0 for s in snapshots) / snapshot_count

    return RouteAnalyticsSummary(
        route_id=route.id,
        route_name=route.name,
        color=route.color,
        current_utilization=round(current_utilization, 1),
        avg_utilization=round(avg_utilization, 1),
        current_delay_min=round(current_delay_min, 1),
        avg_delay_min=round(avg_delay_min, 1),
        current_otp=round(current_otp, 1),
        avg_otp=round(avg_otp, 1),
        snapshot_count=snapshot_count
    )
