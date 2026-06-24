import asyncio
import logging
from sqlalchemy.orm import Session

from app.models.routes import Route
from app.models.terminals import Terminal
from app.models.buses import Bus
from app.services.routing import get_route
from app.simulation.coordinates import ROUTE_WAYPOINTS, get_route_segments

logger = logging.getLogger(__name__)


# Fall back to hardcoded waypoints if OSRM is unavailable
def calculate_route_distance_legacy(route_name: str) -> float:
    waypoints = ROUTE_WAYPOINTS[route_name]
    segments = get_route_segments(waypoints)
    return round(sum(segments), 1)


def seed_database(db: Session):
    """Seed the database with initial routes and terminals if not already present."""
    # 1. Seed Routes
    existing_routes = db.query(Route).all()
    if not existing_routes:
        logger.info("Seeding routes...")
        routes_data = [
            {"name": "Davao → Tagum", "color": "#eab308", "description": "Davao City to Tagum City via Panabo Corridor",
             "origin": (7.0736, 125.6131), "dest": (7.4478, 125.8078)},
            {"name": "Davao → Panabo", "color": "#3b82f6", "description": "Davao City to Panabo City commuter route",
             "origin": (7.0736, 125.6131), "dest": (7.3078, 125.6833)},
            {"name": "Davao → Digos", "color": "#ef4444", "description": "Davao City to Digos City south corridor",
             "origin": (7.0736, 125.6131), "dest": (6.7578, 125.3556)},
            {"name": "Davao → Mati", "color": "#10b981", "description": "Davao City to Mati City east coast route",
             "origin": (7.0736, 125.6131), "dest": (6.9531, 126.2161)},
            {"name": "Davao → Kidapawan", "color": "#a855f7", "description": "Davao City to Kidapawan City upland route",
             "origin": (7.0736, 125.6131), "dest": (7.0083, 125.0894)},
        ]

        db_routes = []
        for rd in routes_data:
            try:
                result = asyncio.run(get_route(rd["origin"], rd["dest"]))
                waypoints = result["waypoints"]
                dist = result["distance_km"]
                logger.info(f"OSRM route for {rd['name']}: {dist} km, {len(waypoints)} points")
            except Exception:
                logger.warning(f"OSRM unavailable for {rd['name']}, using fallback waypoints")
                waypoints = ROUTE_WAYPOINTS.get(rd["name"], [])
                dist = calculate_route_distance_legacy(rd["name"])

            route = Route(
                name=rd["name"],
                color=rd["color"],
                description=rd["description"],
                distance_km=dist,
                waypoints=waypoints,
            )
            db.add(route)
            db_routes.append(route)

        db.commit()
        for r in db_routes:
            db.refresh(r)
        logger.info("Routes seeded successfully.")
    else:
        logger.info("Routes already exist, skipping seeding.")
        db_routes = existing_routes

    # Create mapping of route name to ID
    route_map = {r.name: r.id for r in db_routes}

    # 2. Seed Terminals
    existing_terminals = db.query(Terminal).all()
    if not existing_terminals:
        logger.info("Seeding terminals...")
        terminals_data = [
            {"name": "Davao Ecoland Terminal", "lat": 7.0736, "lng": 125.6131, "route_id": None, "type": "terminal"},
            {"name": "Tagum City Overland Terminal", "lat": 7.4478, "lng": 125.8078, "route_id": route_map.get("Davao → Tagum"), "type": "terminal"},
            {"name": "Panabo Multi-Purpose Terminal", "lat": 7.3078, "lng": 125.6833, "route_id": route_map.get("Davao → Panabo"), "type": "terminal"},
            {"name": "Digos City Overland Terminal", "lat": 6.7578, "lng": 125.3556, "route_id": route_map.get("Davao → Digos"), "type": "terminal"},
            {"name": "Mati City Bus Terminal", "lat": 6.9531, "lng": 126.2161, "route_id": route_map.get("Davao → Mati"), "type": "terminal"},
            {"name": "Kidapawan City Overland Terminal", "lat": 7.0083, "lng": 125.0894, "route_id": route_map.get("Davao → Kidapawan"), "type": "terminal"},
        ]

        for td in terminals_data:
            term = Terminal(
                name=td["name"],
                lat=td["lat"],
                lng=td["lng"],
                route_id=td["route_id"],
                terminal_type=td["type"]
            )
            db.add(term)
        
        db.commit()
        logger.info("Terminals seeded successfully.")
    else:
        logger.info("Terminals already exist, skipping seeding.")
