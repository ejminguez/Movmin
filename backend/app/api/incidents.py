import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.incidents import Incident
from app.models.routes import Route
from app.schemas.incidents import IncidentListResponse, IncidentDetailResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/incidents", tags=["Incidents"])

def map_incident_to_schema(inc: Incident, db: Session) -> dict:
    route = db.query(Route).filter(Route.id == inc.affected_route_id).first()
    affected_routes = [route.name] if route else []
    return {
        "id": f"INC{inc.id:03d}",
        "type": inc.incident_type,
        "severity": inc.severity.upper() if inc.severity else "MEDIUM",
        "title": inc.title or f"{inc.incident_type} on Route",
        "description": inc.description,
        "latitude": inc.lat or 0.0,
        "longitude": inc.lng or 0.0,
        "affected_routes": affected_routes,
        "estimated_delay_minutes": inc.estimated_delay_min or 0,
        "status": inc.status or "active",
        "created_at": inc.created_at,
        "expires_at": inc.expires_at,
    }

@router.get("", response_model=List[IncidentListResponse])
def get_active_incidents(db: Session = Depends(get_db)):
    """Get all active incidents."""
    incidents = db.query(Incident).filter(Incident.status == "active").all()
    return [map_incident_to_schema(inc, db) for inc in incidents]

@router.get("/{incident_id}", response_model=IncidentDetailResponse)
def get_incident_by_id(incident_id: str, db: Session = Depends(get_db)):
    """Get detail of a specific incident."""
    try:
        if incident_id.startswith("INC"):
            db_id = int(incident_id[3:])
        else:
            db_id = int(incident_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid incident ID format")
        
    incident = db.query(Incident).filter(Incident.id == db_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    return map_incident_to_schema(incident, db)
