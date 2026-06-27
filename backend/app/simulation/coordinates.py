import math
from typing import List, Tuple, Dict

# Route waypoints (lat, lng) mapping
ROUTE_WAYPOINTS: Dict[str, List[Tuple[float, float]]] = {
    "Davao → Tagum": [
        (7.0736, 125.6131),  # Davao Terminal
        (7.1125, 125.6433),  # Lanang
        (7.1492, 125.6558),  # Panacan
        (7.2347, 125.6702),  # Lasang
        (7.3078, 125.6833),  # Panabo Terminal
        (7.3611, 125.7028),  # Carmen
        (7.4478, 125.8078)   # Tagum Terminal
    ],
    "Davao → Panabo": [
        (7.0736, 125.6131),  # Davao Terminal
        (7.1125, 125.6433),  # Lanang
        (7.1492, 125.6558),  # Panacan
        (7.2347, 125.6702),  # Lasang
        (7.3078, 125.6833)   # Panabo Terminal
    ],
    "Davao → Digos": [
        (7.0736, 125.6131),  # Davao Terminal
        (7.0494, 125.5786),  # Matina
        (7.0192, 125.5511),  # Talomo
        (6.9694, 125.4983),  # Toril
        (6.8372, 125.4086),  # Santa Cruz
        (6.7578, 125.3556)   # Digos Terminal
    ],
    "Davao → Mati": [
        (7.0736, 125.6131),  # Davao Terminal
        (7.1125, 125.6433),  # Lanang
        (7.1492, 125.6558),  # Panacan
        (7.2347, 125.6702),  # Lasang
        (7.3078, 125.6833),  # Panabo Terminal
        (7.3611, 125.7028),  # Carmen
        (7.4478, 125.8078),  # Tagum Terminal
        (7.3622, 125.8528),  # Maco
        (7.2894, 125.8589),  # Mabini
        (7.1353, 125.8944),  # Pantukan
        (6.9744, 125.9619),  # Banaybanay
        (6.8994, 126.0125),  # Lupon
        (6.8306, 126.0911),  # San Isidro
        (6.9531, 126.2161)   # Mati Terminal
    ],
    "Davao → Kidapawan": [
        (7.0736, 125.6131),  # Davao Terminal
        (7.0494, 125.5786),  # Matina
        (7.0192, 125.5511),  # Talomo
        (6.9694, 125.4983),  # Toril
        (6.8372, 125.4086),  # Santa Cruz
        (6.7578, 125.3556),  # Digos Terminal
        (6.7869, 125.2156),  # Bansalan
        (6.9658, 125.0928),  # Makilala
        (7.0083, 125.0894)   # Kidapawan Terminal
    ]
}


def haversine_distance(coord1: Tuple[float, float], coord2: Tuple[float, float]) -> float:
    """Calculate the great-circle distance between two points in kilometers."""
    R = 6371.0  # Earth radius in kilometers
    lat1, lon1 = math.radians(coord1[0]), math.radians(coord1[1])
    lat2, lon2 = math.radians(coord2[0]), math.radians(coord2[1])

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def calculate_bearing(coord1: Tuple[float, float], coord2: Tuple[float, float]) -> float:
    """Calculate the bearing between two points in degrees (0 to 360)."""
    lat1, lon1 = math.radians(coord1[0]), math.radians(coord1[1])
    lat2, lon2 = math.radians(coord2[0]), math.radians(coord2[1])

    dlon = lon2 - lon1

    y = math.sin(dlon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)

    bearing = math.atan2(y, x)
    bearing_deg = math.degrees(bearing)
    return (bearing_deg + 360) % 360


def get_route_segments(waypoints: List[Tuple[float, float]]) -> List[float]:
    """Calculate distances of individual segments between consecutive waypoints."""
    distances = []
    for i in range(len(waypoints) - 1):
        distances.append(haversine_distance(waypoints[i], waypoints[i + 1]))
    return distances


def get_position_along_route(
    waypoints: List[Tuple[float, float]],
    distance_km: float
) -> Tuple[Tuple[float, float], float]:
    """
    Find the coordinate and bearing corresponding to a specific distance along the route.
    If distance_km exceeds the total route distance, returns the last coordinate with 0 bearing.
    """
    if not waypoints:
        return (0.0, 0.0), 0.0

    if distance_km <= 0:
        if len(waypoints) > 1:
            bearing = calculate_bearing(waypoints[0], waypoints[1])
        else:
            bearing = 0.0
        return waypoints[0], bearing

    segments = get_route_segments(waypoints)
    accumulated_distance = 0.0

    for i, seg_dist in enumerate(segments):
        if accumulated_distance + seg_dist >= distance_km:
            # The target distance lies within this segment
            overshoot = distance_km - accumulated_distance
            ratio = overshoot / seg_dist if seg_dist > 0 else 0.0
            
            p1 = waypoints[i]
            p2 = waypoints[i + 1]
            
            # Linearly interpolate lat and lng
            lat = p1[0] + ratio * (p2[0] - p1[0])
            lng = p1[1] + ratio * (p2[1] - p1[1])
            
            bearing = calculate_bearing(p1, p2)
            return (lat, lng), bearing
        accumulated_distance += seg_dist

    # If we overshoot the entire route, return the last waypoint
    if len(waypoints) > 1:
        bearing = calculate_bearing(waypoints[-2], waypoints[-1])
    else:
        bearing = 0.0
    return waypoints[-1], bearing


def compute_route_overlaps(
    routes: Dict[int, List[List[float]]]
) -> Dict[int, Dict[int, float]]:
    """
    Precompute shared-route distances for all route pairs.

    Returns {route_id: {other_route_id: shared_distance_km, ...}, ...}
    where shared_distance_km is the distance along route_id's waypoints
    before it diverges from other_route_id.
    """
    overlaps: Dict[int, Dict[int, float]] = {}
    route_ids = list(routes.keys())

    for rid_a in route_ids:
        overlaps[rid_a] = {}
        wps_a = routes[rid_a]
        for rid_b in route_ids:
            if rid_a == rid_b:
                continue
            wps_b = routes[rid_b]

            # Find last waypoint index where routes are still together
            shared_count = 0
            for k in range(min(len(wps_a), len(wps_b))):
                if haversine_distance(
                    (float(wps_a[k][0]), float(wps_a[k][1])),
                    (float(wps_b[k][0]), float(wps_b[k][1])),
                ) < 0.05:  # 50m threshold
                    shared_count = k + 1
                else:
                    break

            if shared_count >= 2:
                segs_a = get_route_segments(
                    [(float(w[0]), float(w[1])) for w in wps_a[:shared_count]]
                )
                overlaps[rid_a][rid_b] = sum(segs_a)

    return overlaps


def project_incident_on_route(
    waypoints: List[List[float]],
    incident_lat: float,
    incident_lng: float,
) -> float:
    """Find the distance along the route (in km) to the waypoint nearest the incident."""
    if not waypoints:
        return 0.0

    min_dist = float("inf")
    nearest_idx = 0
    for i, wp in enumerate(waypoints):
        d = haversine_distance(
            (incident_lat, incident_lng),
            (float(wp[0]), float(wp[1])),
        )
        if d < min_dist:
            min_dist = d
            nearest_idx = i

    acc = 0.0
    for i in range(nearest_idx):
        acc += haversine_distance(
            (float(waypoints[i][0]), float(waypoints[i][1])),
            (float(waypoints[i + 1][0]), float(waypoints[i + 1][1])),
        )
    return acc
