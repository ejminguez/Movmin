import random
import time
from typing import Dict, Tuple, List

WEATHER_CONDITIONS = {
    "clear": {"label": "Clear", "speed_multiplier": 1.0, "delay_min": 0},
    "cloudy": {"label": "Cloudy", "speed_multiplier": 0.95, "delay_min": 2},
    "light_rain": {"label": "Light Rain", "speed_multiplier": 0.85, "delay_min": 5},
    "heavy_rain": {"label": "Heavy Rain", "speed_multiplier": 0.7, "delay_min": 12},
    "fog": {"label": "Fog", "speed_multiplier": 0.6, "delay_min": 15},
    "storm": {"label": "Storm", "speed_multiplier": 0.5, "delay_min": 25},
}

CONDITION_PRIORITY = ["clear", "cloudy", "light_rain", "heavy_rain", "fog", "storm"]

_weather_cache: Dict[int, Tuple[str, float]] = {}
_last_update: float = 0


def get_weather_for_route(route_id: int, ignore_overrides: bool = False) -> dict:
    if not ignore_overrides:
        from app.services.scenario import scenario_manager
        overrides = scenario_manager.get_overrides(route_id)
        if overrides and "weather" in overrides:
            cond = overrides["weather"]
            result = dict(WEATHER_CONDITIONS.get(cond, WEATHER_CONDITIONS["clear"]))
            result["_key"] = cond
            return result

    global _last_update
    now = time.time()
    if now - _last_update > 30:
        _weather_cache.clear()
        _last_update = now
    if route_id not in _weather_cache:
        cond = random.choices(
            list(WEATHER_CONDITIONS.keys()),
            weights=[40, 25, 18, 10, 5, 2],
            k=1
        )[0]
        _weather_cache[route_id] = (cond, now)
    condition = _weather_cache[route_id][0]
    result = dict(WEATHER_CONDITIONS[condition])
    result["_key"] = condition
    return result


def get_worst_weather(conditions: List[dict]) -> dict:
    best = max(conditions, key=lambda c: CONDITION_PRIORITY.index(c.get("_key", "clear")))
    return best


def get_all_weather() -> Dict[int, dict]:
    return {rid: dict(WEATHER_CONDITIONS[cond]) for rid, (cond, _) in _weather_cache.items()}

# Weather-related incident types that should only appear during adverse weather
WEATHER_INCIDENT_TYPES = {"Flood Warning", "Weather Advisory"}
SEVERE_WEATHER_THRESHOLD = "light_rain"  # minimum condition for weather incidents
