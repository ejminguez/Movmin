import logging
import math
from typing import Dict, List, Tuple, Optional
from sqlalchemy.orm import Session

from app.models.routes import Route
from app.models.buses import Bus
from app.models.terminals import Terminal
from app.models.incidents import Incident
from app.simulation.coordinates import haversine_distance

logger = logging.getLogger(__name__)

# Municipality definitions: name, center coordinates, population estimate, which routes pass through
MUNICIPALITIES: List[Dict] = [
    {"name": "Davao City", "lat": 7.0736, "lng": 125.6131, "population": 1630000,
     "routes": ["Davao → Tagum", "Davao → Panabo", "Davao → Digos", "Davao → Mati", "Davao → Kidapawan"]},
    {"name": "Lanang", "lat": 7.1125, "lng": 125.6433, "population": 85000,
     "routes": ["Davao → Tagum", "Davao → Panabo", "Davao → Mati"]},
    {"name": "Panacan", "lat": 7.1492, "lng": 125.6558, "population": 62000,
     "routes": ["Davao → Tagum", "Davao → Panabo", "Davao → Mati"]},
    {"name": "Lasang", "lat": 7.2347, "lng": 125.6702, "population": 48000,
     "routes": ["Davao → Tagum", "Davao → Panabo", "Davao → Mati"]},
    {"name": "Panabo", "lat": 7.3078, "lng": 125.6833, "population": 184000,
     "routes": ["Davao → Tagum", "Davao → Panabo", "Davao → Mati"]},
    {"name": "Carmen", "lat": 7.3611, "lng": 125.7028, "population": 72000,
     "routes": ["Davao → Tagum", "Davao → Mati"]},
    {"name": "Tagum", "lat": 7.4478, "lng": 125.8078, "population": 259000,
     "routes": ["Davao → Tagum", "Davao → Mati"]},
    {"name": "Matina", "lat": 7.0494, "lng": 125.5786, "population": 95000,
     "routes": ["Davao → Digos", "Davao → Kidapawan"]},
    {"name": "Talomo", "lat": 7.0192, "lng": 125.5511, "population": 78000,
     "routes": ["Davao → Digos", "Davao → Kidapawan"]},
    {"name": "Toril", "lat": 6.9694, "lng": 125.4983, "population": 148000,
     "routes": ["Davao → Digos", "Davao → Kidapawan"]},
    {"name": "Santa Cruz", "lat": 6.8372, "lng": 125.4086, "population": 101000,
     "routes": ["Davao → Digos", "Davao → Kidapawan"]},
    {"name": "Digos", "lat": 6.7578, "lng": 125.3556, "population": 169000,
     "routes": ["Davao → Digos"]},
    {"name": "Maco", "lat": 7.3622, "lng": 125.8528, "population": 81000,
     "routes": ["Davao → Mati"]},
    {"name": "Mabini", "lat": 7.2894, "lng": 125.8589, "population": 43000,
     "routes": ["Davao → Mati"]},
    {"name": "Pantukan", "lat": 7.1353, "lng": 125.8944, "population": 85000,
     "routes": ["Davao → Mati"]},
    {"name": "Banaybanay", "lat": 6.9744, "lng": 125.9619, "population": 41000,
     "routes": ["Davao → Mati"]},
    {"name": "Lupon", "lat": 6.8994, "lng": 126.0125, "population": 65000,
     "routes": ["Davao → Mati"]},
    {"name": "San Isidro", "lat": 6.8306, "lng": 126.0911, "population": 33000,
     "routes": ["Davao → Mati"]},
    {"name": "Mati", "lat": 6.9531, "lng": 126.2161, "population": 141000,
     "routes": ["Davao → Mati"]},
    {"name": "Bansalan", "lat": 6.7869, "lng": 125.2156, "population": 56000,
     "routes": ["Davao → Kidapawan"]},
    {"name": "Makilala", "lat": 6.9658, "lng": 125.0928, "population": 83000,
     "routes": ["Davao → Kidapawan"]},
    {"name": "Kidapawan", "lat": 7.0083, "lng": 125.0894, "population": 140000,
     "routes": ["Davao → Kidapawan"]},
]

DEMAND_THRESHOLDS = {
    "VERY_LOW": (0, 20),
    "LOW": (21, 40),
    "MODERATE": (41, 60),
    "HIGH": (61, 80),
    "CRITICAL": (81, 100),
}


def classify_demand(score: float) -> str:
    for level, (lo, hi) in DEMAND_THRESHOLDS.items():
        if lo <= score <= hi:
            return level
    return "MODERATE"


def get_route_name_map(db: Session) -> Dict[int, str]:
    return {r.id: r.name for r in db.query(Route).all()}


def aggregate_municipality_demand(db: Session) -> List[Dict]:
    routes = db.query(Route).all()
    buses = db.query(Bus).all()
    terminals = db.query(Terminal).all()
    incidents = db.query(Incident).filter(Incident.status == "active").all()

    route_name_map = {r.id: r.name for r in routes}
    route_id_by_name = {r.name: r.id for r in routes}

    route_buses: Dict[int, List[Bus]] = {}
    for bus in buses:
        route_buses.setdefault(bus.route_id, []).append(bus)

    route_terminals: Dict[int, List[Terminal]] = {}
    for t in terminals:
        if t.route_id:
            route_terminals.setdefault(t.route_id, []).append(t)

    route_incidents: Dict[int, List[Incident]] = {}
    for inc in incidents:
        if inc.affected_route_id:
            route_incidents.setdefault(inc.affected_route_id, []).append(inc)

    results = []
    for mun in MUNICIPALITIES:
        total_passenger_demand = 0
        total_capacity = 0
        active_routes_set = set()
        total_incident_delay = 0
        bus_count = 0

        for route_name in mun["routes"]:
            rid = route_id_by_name.get(route_name)
            if rid is None:
                continue
            active_routes_set.add(route_name)
            route_bus_list = route_buses.get(rid, [])
            active = [b for b in route_bus_list if b.status in ("active", "delayed")]
            bus_count += len(active)
            for b in active:
                total_passenger_demand += b.occupancy or 0
                total_capacity += b.capacity or 50

            for inc in route_incidents.get(rid, []):
                total_incident_delay += inc.estimated_delay_min or 0

        total_possible_capacity = max(total_capacity, 1)
        demand_ratio = total_passenger_demand / total_possible_capacity
        density_score = min(100, round(demand_ratio * 100))

        population_factor = min(mun["population"] / 50000, 3.0)
        density_score = min(100, round(density_score * population_factor))

        route_count = len(active_routes_set)
        coverage_score = min(100, round((route_count / max(len(mun["routes"]), 1)) * 100))

        nearest_terminal_km = _nearest_terminal_distance(mun, terminals)

        avg_wait_time = _estimate_wait_time(bus_count, mun["population"])

        underserved = _is_underserved(density_score, coverage_score, mun["population"], nearest_terminal_km, avg_wait_time, route_count)
        underserved_reason = _underserved_reason(density_score, coverage_score, mun["population"], nearest_terminal_km, avg_wait_time, route_count) if underserved else None

        results.append({
            "municipality": mun["name"],
            "lat": mun["lat"],
            "lng": mun["lng"],
            "total_demand": total_passenger_demand,
            "active_routes": route_count,
            "bus_count": bus_count,
            "density_score": density_score,
            "coverage_score": coverage_score,
            "demand_level": classify_demand(density_score),
            "average_wait_time": avg_wait_time,
            "nearest_terminal_km": round(nearest_terminal_km, 1),
            "underserved": underserved,
            "underserved_reason": underserved_reason,
            "population": mun["population"],
            "incident_delay_min": total_incident_delay,
        })

    return results


def _nearest_terminal_distance(mun: Dict, terminals: List[Terminal]) -> float:
    if not terminals:
        return 99.0
    return min(
        haversine_distance((mun["lat"], mun["lng"]), (t.lat, t.lng))
        for t in terminals
    )


def _estimate_wait_time(bus_count: int, population: int) -> int:
    if bus_count == 0:
        return 30
    service_score = bus_count / max(population / 10000, 1)
    if service_score >= 3:
        return 5
    elif service_score >= 2:
        return 10
    elif service_score >= 1:
        return 15
    else:
        return 25


def _is_underserved(
    density_score: float,
    coverage_score: float,
    population: int,
    nearest_terminal_km: float,
    avg_wait_time: int,
    active_routes: int,
) -> bool:
    if density_score >= 60 and coverage_score < 50:
        return True
    if population > 80000 and active_routes <= 1:
        return True
    if avg_wait_time > 20:
        return True
    if nearest_terminal_km > 15 and density_score > 40:
        return True
    if density_score >= 70 and nearest_terminal_km > 8:
        return True
    return False


def _underserved_reason(
    density_score: float,
    coverage_score: float,
    population: int,
    nearest_terminal_km: float,
    avg_wait_time: int,
    active_routes: int,
) -> str:
    reasons = []
    if density_score >= 60 and coverage_score < 50:
        reasons.append("High demand with limited route coverage")
    if population > 80000 and active_routes <= 1:
        reasons.append("Large population underserved by transit routes")
    if avg_wait_time > 20:
        reasons.append("Long average wait time")
    if nearest_terminal_km > 15 and density_score > 40:
        reasons.append("Far from nearest terminal with moderate demand")
    if density_score >= 70 and nearest_terminal_km > 8:
        reasons.append("High demand area lacks nearby terminal")
    return "; ".join(reasons) if reasons else "Underserved area detected"


def detect_underserved_areas(db: Session) -> List[Dict]:
    municipalities = aggregate_municipality_demand(db)
    underserved = [m for m in municipalities if m["underserved"]]
    underserved.sort(key=lambda x: x["density_score"], reverse=True)

    return [
        {
            "municipality": m["municipality"],
            "density_score": m["density_score"],
            "coverage_score": m["coverage_score"],
            "reason": m["underserved_reason"],
            "severity": "CRITICAL" if m["density_score"] >= 80 else "HIGH" if m["density_score"] >= 60 else "MEDIUM",
            "average_wait_time": m["average_wait_time"],
            "active_routes": m["active_routes"],
            "population": m["population"],
        }
        for m in underserved
    ]


def recommend_terminals(db: Session) -> List[Dict]:
    municipalities = aggregate_municipality_demand(db)
    terminals = db.query(Terminal).all()

    candidates = []
    for m in municipalities:
        if m["nearest_terminal_km"] < 3:
            continue

        priority_score = 0
        reasons = []

        if m["density_score"] >= 70:
            priority_score += 40
            reasons.append("Critical demand density")
        elif m["density_score"] >= 50:
            priority_score += 25
            reasons.append("High demand density")

        if m["nearest_terminal_km"] > 15:
            priority_score += 30
            reasons.append(f"Far from nearest terminal ({m['nearest_terminal_km']} km)")
        elif m["nearest_terminal_km"] > 8:
            priority_score += 15
            reasons.append(f"Moderate distance to nearest terminal ({m['nearest_terminal_km']} km)")

        if m["active_routes"] >= 3:
            priority_score += 15
            reasons.append("Multiple routes intersect this area")

        if m["population"] > 100000:
            priority_score += 15
            reasons.append("Large population center")
        elif m["population"] > 50000:
            priority_score += 8
            reasons.append("Growing population center")

        if m["average_wait_time"] > 15:
            priority_score += 10
            reasons.append("Long wait times indicate insufficient service")

        if priority_score >= 30:
            priority = "HIGH" if priority_score >= 60 else "MEDIUM" if priority_score >= 40 else "LOW"
            candidates.append({
                "municipality": m["municipality"],
                "lat": m["lat"],
                "lng": m["lng"],
                "priority": priority,
                "priority_score": priority_score,
                "reason": "; ".join(reasons[:3]),
                "density_score": m["density_score"],
                "population": m["population"],
                "nearest_terminal_km": m["nearest_terminal_km"],
                "expected_impact": _estimate_terminal_impact(priority_score, m["population"]),
            })

    candidates.sort(key=lambda x: x["priority_score"], reverse=True)
    return candidates


def _estimate_terminal_impact(priority_score: int, population: int) -> str:
    if priority_score >= 60 and population > 100000:
        return "HIGH - Would serve major population center and reduce congestion significantly"
    elif priority_score >= 40:
        return "MEDIUM - Would improve transit access for growing municipality"
    else:
        return "LOW - Supplementary terminal for route coverage optimization"


def aggregate_corridor_density(db: Session) -> List[Dict]:
    routes = db.query(Route).all()
    buses = db.query(Bus).all()
    incidents = db.query(Incident).filter(Incident.status == "active").all()

    results = []
    for route in routes:
        route_buses = [b for b in buses if b.route_id == route.id]
        active_buses = [b for b in route_buses if b.status in ("active", "delayed")]

        total_demand = sum(b.occupancy or 0 for b in active_buses)
        total_capacity = sum(b.capacity or 50 for b in active_buses)
        density = min(100, round((total_demand / max(total_capacity, 1)) * 100)) if active_buses else 0

        route_incidents = [i for i in incidents if i.affected_route_id == route.id]
        total_delay = sum(i.estimated_delay_min or 0 for i in route_incidents)

        results.append({
            "route_name": route.name,
            "route_id": route.id,
            "color": route.color,
            "total_demand": total_demand,
            "available_capacity": total_capacity,
            "density_score": density,
            "demand_level": classify_demand(density),
            "active_bus_count": len(active_buses),
            "total_incident_delay": total_delay,
            "distance_km": route.distance_km,
        })

    results.sort(key=lambda x: x["density_score"], reverse=True)
    return results


def generate_heatmap_geojson(db: Session) -> Dict:
    municipalities = aggregate_municipality_demand(db)

    features = []
    for m in municipalities:
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [m["lng"], m["lat"]],
            },
            "properties": {
                "municipality": m["municipality"],
                "density_score": m["density_score"],
                "demand_level": m["demand_level"],
                "underserved": m["underserved"],
                "coverage_score": m["coverage_score"],
                "active_routes": m["active_routes"],
                "bus_count": m["bus_count"],
                "total_demand": m["total_demand"],
                "average_wait_time": m["average_wait_time"],
                "nearest_terminal_km": m["nearest_terminal_km"],
                "population": m["population"],
            },
        }
        features.append(feature)

    corridor_density = aggregate_corridor_density(db)
    for cd in corridor_density:
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [0, 0],
            },
            "properties": {
                "municipality": cd["route_name"],
                "density_score": cd["density_score"],
                "demand_level": cd["demand_level"],
                "underserved": False,
                "coverage_score": 100,
                "active_routes": 1,
                "bus_count": cd["active_bus_count"],
                "total_demand": cd["total_demand"],
                "average_wait_time": 0,
                "nearest_terminal_km": 0,
                "population": 0,
                "is_corridor": True,
                "color": cd["color"],
            },
        }
        features.append(feature)

    return {
        "type": "FeatureCollection",
        "features": features,
    }


def get_heatmap_metrics_for_ai(db: Session) -> List[Dict]:
    municipalities = aggregate_municipality_demand(db)
    metrics = []
    for m in municipalities:
        if m["density_score"] >= 40 or m["underserved"]:
            metrics.append({
                "municipality": m["municipality"],
                "density_score": m["density_score"],
                "coverage_score": m["coverage_score"],
                "average_wait_time": m["average_wait_time"],
                "active_routes": m["active_routes"],
                "underserved": m["underserved"],
                "terminal_distance_km": m["nearest_terminal_km"],
                "population": m["population"],
            })
    metrics.sort(key=lambda x: x["density_score"], reverse=True)
    return metrics


def get_summary_stats(db: Session) -> Dict:
    municipalities = aggregate_municipality_demand(db)
    corridor_density = aggregate_corridor_density(db)

    if not municipalities:
        return {
            "highest_demand_municipality": "N/A",
            "highest_demand_score": 0,
            "average_density_score": 0,
            "most_utilized_corridor": "N/A",
            "most_utilized_corridor_score": 0,
            "fastest_growing_area": "N/A",
            "underserved_count": 0,
            "terminal_recommendations_count": 0,
            "total_municipalities": 0,
        }

    highest = max(municipalities, key=lambda x: x["density_score"])
    avg_density = round(sum(m["density_score"] for m in municipalities) / len(municipalities), 1)

    most_utilized = max(corridor_density, key=lambda x: x["density_score"]) if corridor_density else None

    underserved_count = sum(1 for m in municipalities if m["underserved"])
    terminal_recs = recommend_terminals(db)

    fastest = max(municipalities, key=lambda x: x["density_score"] * x["population"] / 100000)

    return {
        "highest_demand_municipality": highest["municipality"],
        "highest_demand_score": highest["density_score"],
        "average_density_score": avg_density,
        "most_utilized_corridor": most_utilized["route_name"] if most_utilized else "N/A",
        "most_utilized_corridor_score": most_utilized["density_score"] if most_utilized else 0,
        "fastest_growing_area": fastest["municipality"],
        "underserved_count": underserved_count,
        "terminal_recommendations_count": len(terminal_recs),
        "total_municipalities": len(municipalities),
    }


def get_hotspots(db: Session, top_n: int = 5) -> List[Dict]:
    municipalities = aggregate_municipality_demand(db)
    municipalities.sort(key=lambda x: x["density_score"], reverse=True)
    critical = [m for m in municipalities if m["demand_level"] == "CRITICAL"]

    hotspots = municipalities[:top_n]
    for c in critical:
        if c not in hotspots:
            hotspots.append(c)

    return [
        {
            "municipality": h["municipality"],
            "lat": h["lat"],
            "lng": h["lng"],
            "density_score": h["density_score"],
            "demand_level": h["demand_level"],
            "underserved": h["underserved"],
        }
        for h in hotspots[:top_n + len(critical)]
    ]
