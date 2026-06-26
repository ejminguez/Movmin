import logging
from typing import Optional
from sqlalchemy.orm import Session

from app.models.routes import Route
from app.models.terminals import Terminal
from app.models.buses import Bus
from app.models.incidents import Incident
from app.services.weather import get_weather_for_route, CONDITION_PRIORITY, WEATHER_CONDITIONS
from app.simulation.coordinates import haversine_distance
from app.services.scenario import scenario_manager

logger = logging.getLogger(__name__)


def _nearest_waypoint_index(waypoints: list, lat: float, lng: float) -> Optional[int]:
    min_dist = float("inf")
    min_idx = None
    for i, wp in enumerate(waypoints):
        d = haversine_distance((wp[0], wp[1]), (lat, lng))
        if d < min_dist:
            min_dist = d
            min_idx = i
    return min_idx


def _route_distance_between(
    waypoints: list,
    from_lat: float, from_lng: float,
    to_lat: float, to_lng: float,
) -> float:
    from_idx = _nearest_waypoint_index(waypoints, from_lat, from_lng)
    to_idx = _nearest_waypoint_index(waypoints, to_lat, to_lng)
    if from_idx is None or to_idx is None:
        return haversine_distance((from_lat, from_lng), (to_lat, to_lng))
    if from_idx > to_idx:
        from_idx, to_idx = to_idx, from_idx
    total = 0.0
    for i in range(from_idx, to_idx):
        total += haversine_distance(waypoints[i], waypoints[i + 1])
    return total if total > 0 else haversine_distance((from_lat, from_lng), (to_lat, to_lng))


def _get_avg_speed(route_id: int, db: Session) -> float:
    buses = db.query(Bus).filter(
        Bus.route_id == route_id,
        Bus.status.in_(["active", "delayed"]),
    ).all()
    if not buses:
        return 45.0
    return sum(b.speed for b in buses) / len(buses)


def _get_traffic_delay(route_id: int, db: Session) -> float:
    buses = db.query(Bus).filter(
        Bus.route_id == route_id,
        Bus.status.in_(["active", "delayed"]),
    ).all()
    if not buses:
        return 0.0
    avg_speed = sum(b.speed for b in buses) / len(buses)
    if avg_speed >= 45:
        return 0.0
    elif avg_speed >= 30:
        return 5.0
    else:
        return 12.0


def _get_incident_delay(route_id: int, db: Session) -> float:
    incidents = db.query(Incident).filter(
        Incident.affected_route_id == route_id,
        Incident.status == "active",
    ).all()
    return sum(float(inc.estimated_delay_min) for inc in incidents)


def _leg_time(
    route: Route,
    from_lat: float, from_lng: float,
    to_lat: float, to_lng: float,
    db: Session,
) -> dict:
    distance_km = _route_distance_between(
        route.waypoints, from_lat, from_lng, to_lat, to_lng
    ) if route.waypoints else haversine_distance((from_lat, from_lng), (to_lat, to_lng))

    avg_speed = _get_avg_speed(route.id, db)
    if avg_speed <= 0:
        avg_speed = 45.0

    base_time_min = (distance_km / avg_speed) * 60
    traffic_delay = _get_traffic_delay(route.id, db)
    weather = get_weather_for_route(route.id)
    weather_delay = weather["delay_min"]
    incident_delay = _get_incident_delay(route.id, db)

    # Apply active scenario overrides
    overrides = scenario_manager.get_overrides(route.id)
    if overrides:
        if overrides.get("status") == "CLOSED":
            avg_speed = 15.0  # slow detour speed
            base_time_min = (distance_km / avg_speed) * 60
            traffic_delay = 0.0
            weather_delay = 0.0
            incident_delay = overrides.get("delay_min_override", 15.0)
        else:
            if "speed_multiplier" in overrides:
                avg_speed = max(5.0, avg_speed * overrides["speed_multiplier"])
                base_time_min = (distance_km / avg_speed) * 60
            if "delay_min_override" in overrides:
                incident_delay = overrides["delay_min_override"]
            if "weather" in overrides:
                cond = overrides["weather"]
                weather_meta = WEATHER_CONDITIONS.get(cond, WEATHER_CONDITIONS["clear"])
                weather_delay = weather_meta["delay_min"]
                weather = {"label": weather_meta["label"], "_key": cond}

    return {
        "route_id": route.id,
        "route_name": route.name,
        "distance_km": round(distance_km, 1),
        "avg_speed": round(avg_speed, 1),
        "base_time_min": round(base_time_min, 1),
        "traffic_delay_min": round(traffic_delay, 1),
        "weather_delay_min": round(weather_delay, 1),
        "weather_condition": weather["label"],
        "incident_delay_min": round(incident_delay, 1),
        "total_time_min": round(base_time_min + traffic_delay + weather_delay + incident_delay, 1),
    }


def get_route_eta(route_id: int, db: Session) -> Optional[dict]:
    """
    Centralized ETA for a corridor route.
    Single source of truth — all ETA displays should call this.
    Returns full breakdown including affected incidents.
    """
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        return None

    hub = db.query(Terminal).filter(
        Terminal.terminal_type == "terminal",
        Terminal.route_id.is_(None),
    ).first()
    route_terminal = db.query(Terminal).filter(
        Terminal.route_id == route_id,
    ).first()
    if not hub or not route_terminal:
        return None

    result = _leg_time(
        route,
        hub.lat, hub.lng,
        route_terminal.lat, route_terminal.lng,
        db,
    )

    incidents = db.query(Incident).filter(
        Incident.affected_route_id == route_id,
        Incident.status == "active",
    ).all()

    result["affected_incidents"] = [
        {
            "incident_type": inc.incident_type,
            "severity": inc.severity,
            "title": inc.title or "",
            "estimated_delay_min": inc.estimated_delay_min,
        }
        for inc in incidents
    ]

    total_delay = result["traffic_delay_min"] + result["weather_delay_min"] + result["incident_delay_min"]
    result["status"] = _compute_status(total_delay, incidents)

    # Override status if active scenario
    overrides = scenario_manager.get_overrides(route_id)
    if overrides:
        if "status_override" in overrides:
            result["status"] = overrides["status_override"]
        elif overrides.get("status") == "CLOSED":
            result["status"] = "REROUTING"

    return result


def _compute_status(total_delay: float, incidents: list) -> str:
    has_road_closure = any(
        inc.incident_type == "Road Closure" for inc in incidents
    )
    if has_road_closure:
        return "REROUTING"

    if total_delay == 0:
        return "ON TIME"
    elif total_delay <= 5:
        return "MINOR DELAY"
    elif total_delay <= 15:
        return "DELAYED"
    else:
        return "SEVERELY DELAYED"


def get_bus_eta(bus_id: int, db: Session) -> Optional[dict]:
    """
    Calculate ETA from a bus's current position to the nearest terminal on its route.
    Uses centralized ETA engine — single source of truth.
    """
    bus = db.query(Bus).filter(Bus.id == bus_id).first()
    if not bus or bus.current_lat is None or bus.current_lng is None:
        return None

    route = db.query(Route).filter(Route.id == bus.route_id).first()
    if not route:
        return None

    # Find the nearest terminal on this route (or the hub terminal)
    route_terminals = db.query(Terminal).filter(
        Terminal.route_id == bus.route_id,
    ).all()
    hub = db.query(Terminal).filter(
        Terminal.terminal_type == "terminal",
        Terminal.route_id.is_(None),
    ).first()
    candidates = list(route_terminals)
    if hub:
        candidates.append(hub)

    nearest_term = None
    nearest_dist = float("inf")
    for t in candidates:
        d = haversine_distance((bus.current_lat, bus.current_lng), (t.lat, t.lng))
        if d < nearest_dist:
            nearest_dist = d
            nearest_term = t

    if not nearest_term:
        return None

    # Use the centralized leg time calculation
    leg = _leg_time(route, bus.current_lat, bus.current_lng, nearest_term.lat, nearest_term.lng, db)

    status = _compute_status(
        leg["traffic_delay_min"] + leg["weather_delay_min"] + leg["incident_delay_min"],
        db.query(Incident).filter(
            Incident.affected_route_id == route.id,
            Incident.status == "active",
        ).all(),
    )

    overrides = scenario_manager.get_overrides(route.id)
    if overrides:
        if "status_override" in overrides:
            status = overrides["status_override"]
        elif overrides.get("status") == "CLOSED":
            status = "REROUTING"

    return {
        "bus_id": bus.id,
        "bus_name": bus.name,
        "terminal_id": nearest_term.id,
        "terminal_name": nearest_term.name,
        "distance_km": leg["distance_km"],
        "base_time_min": leg["base_time_min"],
        "traffic_delay_min": leg["traffic_delay_min"],
        "weather_delay_min": leg["weather_delay_min"],
        "incident_delay_min": leg["incident_delay_min"],
        "total_time_min": leg["total_time_min"],
        "status": status,
    }


def calculate_eta(
    from_terminal_id: int,
    to_terminal_id: int,
    db: Session,
) -> Optional[dict]:
    from_terminal = db.query(Terminal).filter(Terminal.id == from_terminal_id).first()
    to_terminal = db.query(Terminal).filter(Terminal.id == to_terminal_id).first()
    if not from_terminal or not to_terminal:
        return None

    is_from_hub = from_terminal.route_id is None
    is_to_hub = to_terminal.route_id is None

    same_route = (
        from_terminal.route_id is not None
        and from_terminal.route_id == to_terminal.route_id
    )

    if same_route or is_from_hub or is_to_hub:
        route_id = from_terminal.route_id or to_terminal.route_id
        route = db.query(Route).filter(Route.id == route_id).first() if route_id else None
        if not route:
            return None
        leg = _leg_time(
            route,
            from_terminal.lat, from_terminal.lng,
            to_terminal.lat, to_terminal.lng,
            db,
        )
        return {
            "from_terminal": from_terminal.name,
            "to_terminal": to_terminal.name,
            **leg,
        }

    hub = db.query(Terminal).filter(
        Terminal.terminal_type == "terminal",
        Terminal.route_id.is_(None),
    ).first()
    if not hub:
        return None

    from_route = db.query(Route).filter(Route.id == from_terminal.route_id).first()
    to_route = db.query(Route).filter(Route.id == to_terminal.route_id).first()
    if not from_route or not to_route:
        return None

    leg1 = _leg_time(
        from_route,
        from_terminal.lat, from_terminal.lng,
        hub.lat, hub.lng,
        db,
    )
    leg2 = _leg_time(
        to_route,
        hub.lat, hub.lng,
        to_terminal.lat, to_terminal.lng,
        db,
    )

    leg1_w = get_weather_for_route(leg1["route_id"])
    leg2_w = get_weather_for_route(leg2["route_id"])
    worst_weather = max(
        [leg1_w, leg2_w],
        key=lambda w: CONDITION_PRIORITY.index(w.get("_key", "clear"))
    )["label"]

    return {
        "from_terminal": from_terminal.name,
        "to_terminal": to_terminal.name,
        "route_name": f"{leg1['route_name']} → {leg2['route_name']}",
        "distance_km": round(leg1["distance_km"] + leg2["distance_km"], 1),
        "avg_speed": round((leg1["avg_speed"] + leg2["avg_speed"]) / 2, 1),
        "base_time_min": round(leg1["base_time_min"] + leg2["base_time_min"], 1),
        "traffic_delay_min": round(leg1["traffic_delay_min"] + leg2["traffic_delay_min"], 1),
        "weather_delay_min": round(leg1["weather_delay_min"] + leg2["weather_delay_min"], 1),
        "weather_condition": worst_weather,
        "incident_delay_min": round(leg1["incident_delay_min"] + leg2["incident_delay_min"], 1),
        "total_time_min": round(leg1["total_time_min"] + leg2["total_time_min"], 1),
    }
