import math
import random
from datetime import datetime, date, timedelta
from typing import List

from app.services.weather import get_weather_for_route

BASE_DEMAND: dict[int, int] = {
    1: 1500,
    2: 800,
    3: 1000,
    4: 600,
    5: 700,
}

HOURLY_PROFILES: dict[int, list[float]] = {
    1: [0.15, 0.12, 0.10, 0.08, 0.10, 0.25,
        0.85, 0.95, 0.70, 0.55, 0.80, 0.90,
        0.85, 0.75, 0.60, 0.65, 0.85, 0.90,
        0.75, 0.50, 0.35, 0.25, 0.20, 0.18],
    3: [0.18, 0.15, 0.12, 0.10, 0.15, 0.30,
        0.75, 0.90, 0.80, 0.60, 0.75, 0.88,
        0.82, 0.72, 0.58, 0.62, 0.80, 0.88,
        0.78, 0.55, 0.38, 0.28, 0.22, 0.20],
    2: [0.20, 0.18, 0.15, 0.12, 0.18, 0.35,
        0.80, 0.92, 0.75, 0.58, 0.72, 0.85,
        0.80, 0.70, 0.55, 0.60, 0.78, 0.85,
        0.72, 0.52, 0.38, 0.30, 0.25, 0.22],
    4: [0.10, 0.08, 0.06, 0.05, 0.08, 0.20,
        0.65, 0.85, 0.75, 0.55, 0.65, 0.78,
        0.72, 0.62, 0.50, 0.55, 0.72, 0.80,
        0.68, 0.45, 0.30, 0.22, 0.18, 0.14],
    5: [0.12, 0.10, 0.08, 0.06, 0.10, 0.22,
        0.68, 0.88, 0.78, 0.58, 0.68, 0.80,
        0.75, 0.65, 0.52, 0.58, 0.75, 0.82,
        0.70, 0.48, 0.32, 0.24, 0.20, 0.16],
}

PH_HOLIDAYS_2025: list[tuple[int, int, float]] = [
    (1, 1, 0.6),
    (2, 25, 0.7),
    (4, 9, 0.7),
    (4, 17, 0.6),
    (4, 18, 0.6),
    (4, 19, 0.5),
    (4, 20, 0.5),
    (5, 1, 0.7),
    (6, 12, 0.7),
    (6, 30, 1.2),
    (8, 16, 1.5),
    (8, 17, 1.4),
    (8, 18, 1.3),
    (8, 19, 1.2),
    (8, 20, 1.1),
    (11, 1, 0.8),
    (11, 2, 0.8),
    (11, 3, 0.8),
    (12, 8, 0.9),
    (12, 24, 0.7),
    (12, 25, 0.5),
    (12, 26, 0.6),
    (12, 30, 0.9),
    (12, 31, 0.6),
]

PH_HOLIDAYS_2026: list[tuple[int, int, float]] = [
    (1, 1, 0.6),
    (2, 25, 0.7),
    (4, 6, 0.6),
    (4, 7, 0.6),
    (4, 8, 0.6),
    (4, 9, 0.7),
    (5, 1, 0.7),
    (6, 12, 0.7),
    (8, 16, 1.5),
    (8, 17, 1.4),
    (11, 1, 0.7),
    (12, 8, 0.9),
    (12, 24, 0.7),
    (12, 25, 0.5),
    (12, 30, 0.9),
    (12, 31, 0.6),
]

WEATHER_DEMAND_IMPACT = {
    "clear": 1.05,
    "cloudy": 1.0,
    "light_rain": 0.85,
    "heavy_rain": 0.65,
    "fog": 0.6,
    "storm": 0.4,
}

ROUTE_FESTIVALS: dict[int, list[tuple[str, float]]] = {
    1: [
        ("Paskuhan sa Tagum", 1.3),
        ("Tagum City Foundation Anniversary", 1.25),
    ],
    4: [
        ("Mati Sambolawan Festival", 1.3),
        ("Binuhat Festival", 1.2),
    ],
    3: [
        ("Digos City Padigosan Festival", 1.25),
    ],
    2: [
        ("Panabo Panabotech Festival", 1.2),
    ],
    5: [
        ("Kidapawan Timpuyog Festival", 1.25),
        ("Kidapawan Fruit Festival", 1.3),
    ],
}

SEASON_MULTIPLIERS = {
    "dry": 1.0,
    "wet": 0.9,
    "holiday": 1.15,
}


def _get_holiday_multiplier(target: date) -> float:
    year = target.year
    holidays = PH_HOLIDAYS_2026 if year >= 2026 else PH_HOLIDAYS_2025
    for month, day, mult in holidays:
        if target.month == month and target.day == day:
            return mult
    return 1.0


def _get_season(target: date) -> str:
    m = target.month
    if m in (11, 12, 1):
        return "holiday"
    if 6 <= m <= 10:
        return "wet"
    return "dry"


def _get_route_festival_multiplier(route_id: int, target: date) -> float:
    from app.simulation.seed import ROUTE_WAYPOINTS
    festivals = ROUTE_FESTIVALS.get(route_id, [])
    if not festivals:
        return 1.0
    random.seed(hash(f"{route_id}_{target.isoformat()}"))
    idx = random.randint(0, len(festivals) - 1)
    _, mult = festivals[idx]
    day_of_year = target.timetuple().tm_yday
    if 180 <= day_of_year <= 260:
        return mult
    return 1.0


def _get_weather_demand_multiplier(route_id: int) -> float:
    weather = get_weather_for_route(route_id)
    key = weather.get("_key", "clear")
    return WEATHER_DEMAND_IMPACT.get(key, 1.0)


def _is_weekend(target: date) -> bool:
    return target.weekday() >= 5


def get_demand_forecast(route_id: int, hours: int = 24) -> list[dict]:
    now = datetime.now()
    base = BASE_DEMAND.get(route_id, 800)
    profile = HOURLY_PROFILES.get(route_id, HOURLY_PROFILES[1])

    holiday_mult = _get_holiday_multiplier(now.date())
    season_mult = SEASON_MULTIPLIERS.get(_get_season(now.date()), 1.0)
    festival_mult = _get_route_festival_multiplier(route_id, now.date())
    weather_mult = _get_weather_demand_multiplier(route_id)
    weekend_mult = 0.75 if _is_weekend(now.date()) else 1.0

    forecasts = []
    for offset in range(hours):
        h = (now.hour + offset) % 24
        hour_factor = profile[h]

        # Confidence decreases with forecast distance
        confidence = max(0.3, 1.0 - (offset / hours) * 0.5)

        # Add noise
        noise = random.uniform(0.88, 1.12)

        total_mult = (
            hour_factor
            * holiday_mult
            * season_mult
            * festival_mult
            * weather_mult
            * weekend_mult
            * noise
        )

        demand = max(0, round(base * total_mult))

        weather = get_weather_for_route(route_id)
        weather_label = weather.get("label", "Clear")

        forecasts.append({
            "hour": (now.hour + offset) % 24,
            "predicted_demand": demand,
            "confidence": round(confidence, 2),
            "weather_impact": weather_label if weather_mult != 1.0 else None,
        })

    return forecasts


def get_total_daily_demand(route_id: int) -> int:
    forecasts = get_demand_forecast(route_id, 24)
    return sum(f["predicted_demand"] for f in forecasts)


def get_peak_hours(route_id: int) -> list[dict]:
    forecasts = get_demand_forecast(route_id, 24)
    sorted_fc = sorted(forecasts, key=lambda x: x["predicted_demand"], reverse=True)
    peaks = []
    for f in sorted_fc[:3]:
        h = f["hour"]
        if 5 <= h <= 9:
            label = "Morning Peak"
        elif 11 <= h <= 13:
            label = "Midday Peak"
        elif 16 <= h <= 19:
            label = "Evening Peak"
        else:
            label = "Off-Peak"
        peaks.append({"hour": h, "demand": f["predicted_demand"], "label": label})
    return peaks


def get_route_multipliers_summary(route_id: int) -> dict:
    now = datetime.now()
    holiday_mult = _get_holiday_multiplier(now.date())
    season_mult = SEASON_MULTIPLIERS.get(_get_season(now.date()), 1.0)
    festival_mult = _get_route_festival_multiplier(route_id, now.date())
    weather_mult = _get_weather_demand_multiplier(route_id)
    weekend_mult = 0.75 if _is_weekend(now.date()) else 1.0

    return {
        "holiday": round(holiday_mult, 2),
        "season": season_mult,
        "festival": round(festival_mult, 2),
        "weather": round(weather_mult, 2),
        "weekend": weekend_mult,
    }
