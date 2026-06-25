import random
import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.models.routes import Route
from app.models.incidents import Incident

logger = logging.getLogger(__name__)

INCIDENT_TYPES = ["Flood Warning", "Landslide", "Road Closure", "Weather Advisory"]
SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

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

def update_incidents_simulation(db: Session):
    """
    Called on every simulation tick.
    1. Expires old incidents.
    2. Spawns new incidents randomly.
    """
    now = datetime.now(timezone.utc)
    
    # 1. Expire incidents
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
                
    if expired_count > 0:
        db.commit()
        
    # Re-evaluate count of active incidents after expiration
    active_incidents = db.query(Incident).filter(Incident.status == "active").all()
    
    # 2. Check if we should generate a new incident
    # Cap active incidents at 3 for a balanced simulation
    if len(active_incidents) < 3:
        # 5% probability of spawning an incident on any given 2s tick (approx once every 40s)
        # If there are NO active incidents, boost to 20% to spawn the first one quickly for demonstration
        probability = 0.20 if len(active_incidents) == 0 else 0.05
        if random.random() < probability:
            spawn_random_incident(db)

def spawn_random_incident(db: Session):
    routes = db.query(Route).all()
    if not routes:
        logger.warning("No routes found, cannot spawn incident.")
        return
        
    route = random.choice(routes)
    incident_type = random.choice(INCIDENT_TYPES)
    severity = random.choice(SEVERITIES)
    
    # Estimated delay based on severity
    if severity == "LOW":
        delay = random.randint(2, 5)
    elif severity == "MEDIUM":
        delay = random.randint(5, 15)
    elif severity == "HIGH":
        delay = random.randint(15, 30)
    else:  # CRITICAL
        delay = random.randint(30, 60)
        
    # Expiry duration: 5 to 15 minutes (300 to 900 seconds) for longer map visibility
    expiry_seconds = random.randint(300, 900)
    
    # Get a random waypoint on the route to place the incident near
    lat, lng = 7.0736, 125.6131
    if route.waypoints and len(route.waypoints) > 0:
        wp = random.choice(route.waypoints)
        # Add small random offset (+/- 0.002 degrees, approx 200m)
        lat = wp[0] + random.uniform(-0.002, 0.002)
        lng = wp[1] + random.uniform(-0.002, 0.002)
        
    template = INCIDENT_TEMPLATES[incident_type]
    title = f"{severity} {incident_type}: {template['title']}"
    description = random.choice(template["descriptions"])
    
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=expiry_seconds)
    
    incident = Incident(
        incident_type=incident_type,
        severity=severity.lower(),  # DB stores lowercase
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
    logger.info(f"Spawned new incident: '{title}' on route '{route.name}' (expires in {expiry_seconds}s)")
