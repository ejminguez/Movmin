import random
import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.models.routes import Route
from app.models.incidents import Incident
from app.services.weather import get_weather_for_route, WEATHER_INCIDENT_TYPES, SEVERE_WEATHER_THRESHOLD, CONDITION_PRIORITY

logger = logging.getLogger(__name__)

INCIDENT_TYPES = ["Flood Warning", "Landslide", "Road Closure", "Weather Advisory"]
SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

# Weather conditions that permit each weather-related incident type
# Key: incident type, Value: set of weather keys that justify it
WEATHER_REQUIREMENTS = {
    "Flood Warning": {"light_rain", "heavy_rain", "storm"},
    "Weather Advisory": {"fog", "storm", "heavy_rain"},
}

INCIDENT_TEMPLATES = {
    "Flood Warning": {
        "title": "Severe Localized Flooding",
        "descriptions": [
            "Heavy rains have caused street flooding, slowing transit operations.",
            "Water accumulation on highway segments. Drivers advised to proceed with caution.",
            "River swelling has flooded nearby roadways, leading to major delays."
        ]
    },
    "Landslide": {
        "title": "Debris and Landslide Alert",
        "descriptions": [
            "Minor rockfall detected on mountain pass. Clean-up crews en route.",
            "Soil instability and mudslide blocking partial lanes.",
            "Slope failure has deposited rocks and mud across key road sectors."
        ]
    },
    "Road Closure": {
        "title": "Emergency Road Closure",
        "descriptions": [
            "A vehicular collision has blocked all inbound lanes. Emergency services on scene.",
            "Maintenance work and road repairs requiring temporary closure of lanes.",
            "Infrastructure damage has prompted immediate safety closures."
        ]
    },
    "Weather Advisory": {
        "title": "Severe Weather Advisory",
        "descriptions": [
            "Heavy thunderstorms and zero visibility reported along the corridor.",
            "Gale force winds and torrential rain affecting bus control and traction.",
            "Dense fog advisory. Speed limits reduced for all transit routes."
        ]
    }
}

WEATHER_ALWAYS_TYPES = {"Landslide", "Road Closure"}


def _get_route_weather_key(route_id: int) -> str:
    return get_weather_for_route(route_id, ignore_overrides=True).get("_key", "clear")


def _get_allowed_incident_types(weather_key: str) -> list[str]:
    allowed = list(WEATHER_ALWAYS_TYPES)
    for inc_type, required_weather in WEATHER_REQUIREMENTS.items():
        if weather_key in required_weather:
            allowed.append(inc_type)
    return allowed


def update_incidents_simulation(db: Session):
    now = datetime.now(timezone.utc)

    # 1. Expire old incidents & weather-inconsistent incidents
    active_incidents = db.query(Incident).filter(Incident.status == "active").all()
    expired_count = 0
    for inc in active_incidents:
        expires_at = inc.expires_at
        if expires_at:
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)

            if expires_at < now:
                inc.status = "expired"
                expired_count += 1
                logger.info(f"Incident {inc.id} ({inc.incident_type}) has expired.")
                continue

        # Expire weather incidents that no longer match current weather
        # (Skip manual incidents — user explicitly chose them)
        if (
            inc.incident_type in WEATHER_INCIDENT_TYPES
            and inc.affected_route_id
            and not (inc.title and inc.title.startswith("[Manual]"))
        ):
            weather_key = _get_route_weather_key(inc.affected_route_id)
            allowed = _get_allowed_incident_types(weather_key)
            if inc.incident_type not in allowed:
                inc.status = "expired"
                expired_count += 1
                logger.info(
                    f"Incident {inc.id} ({inc.incident_type}) expired because "
                    f"weather changed to '{weather_key}' on route {inc.affected_route_id}"
                )

    if expired_count > 0:
        db.commit()

    # Re-evaluate count of active incidents after expiration
    active_incidents = db.query(Incident).filter(Incident.status == "active").all()

    # 2. Check if we should generate a new incident
    if len(active_incidents) < 3:
        probability = 0.20 if len(active_incidents) == 0 else 0.05
        if random.random() < probability:
            spawn_random_incident(db)


def spawn_random_incident(db: Session):
    routes = db.query(Route).all()
    if not routes:
        logger.warning("No routes found, cannot spawn incident.")
        return

    route = random.choice(routes)
    weather_key = _get_route_weather_key(route.id)
    allowed_types = _get_allowed_incident_types(weather_key)
    incident_type = random.choice(allowed_types)
    severity = random.choice(SEVERITIES)

    if severity == "LOW":
        delay = random.randint(2, 5)
    elif severity == "MEDIUM":
        delay = random.randint(5, 15)
    elif severity == "HIGH":
        delay = random.randint(15, 30)
    else:
        delay = random.randint(30, 60)

    expiry_seconds = random.randint(300, 900)

    lat, lng = 7.0736, 125.6131
    if route.waypoints and len(route.waypoints) > 0:
        wp = random.choice(route.waypoints)
        lat = wp[0] + random.uniform(-0.002, 0.002)
        lng = wp[1] + random.uniform(-0.002, 0.002)

    template = INCIDENT_TEMPLATES[incident_type]
    title = f"{severity} {incident_type}: {template['title']}"
    description = random.choice(template["descriptions"])

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=expiry_seconds)

    incident = Incident(
        incident_type=incident_type,
        severity=severity.lower(),
        title=title,
        description=description,
        lat=lat,
        lng=lng,
        affected_route_id=route.id,
        estimated_delay_min=delay,
        status="active",
        created_at=now,
        expires_at=expires_at
    )

    db.add(incident)
    db.commit()
    logger.info(
        f"Spawned new incident: '{title}' on route '{route.name}' "
        f"(weather: {weather_key}, expires in {expiry_seconds}s)"
    )
