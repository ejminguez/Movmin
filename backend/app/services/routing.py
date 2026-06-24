import logging
import httpx
from typing import List, Tuple

logger = logging.getLogger(__name__)

OSRM_BASE_URL = "http://localhost:5005"

async def get_route(
    origin: Tuple[float, float],
    destination: Tuple[float, float],
) -> dict | None:
    lat1, lon1 = origin
    lat2, lon2 = destination
    url = f"{OSRM_BASE_URL}/route/v1/driving/{lon1},{lat1};{lon2},{lat2}"
    params = {
        "overview": "full",
        "geometries": "geojson",
        "steps": "false",
        "alternatives": "false",
    }
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, params=params, timeout=10.0)
            if resp.status_code != 200:
                logger.error(f"OSRM returned status {resp.status_code} for {origin} -> {destination}")
                return None
            data = resp.json()
            if data.get("code") != "Ok" or not data.get("routes"):
                logger.error(f"OSRM returned invalid route structure: {data}")
                return None
            route = data["routes"][0]
            return {
                "distance_km": round(route["distance"] / 1000, 2),
                "duration_min": round(route["duration"] / 60, 1),
                "geometry": route["geometry"],  # GeoJSON LineString coords
                "waypoints": [
                    (coord[1], coord[0])  # [lng, lat] -> (lat, lng)
                    for coord in route["geometry"]["coordinates"]
                ],
            }
    except httpx.RequestError as e:
        logger.warning(f"OSRM is unavailable (using fallback waypoints): {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error when calling OSRM: {e}", exc_info=True)
        return None
