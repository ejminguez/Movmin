import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.incidents import Incident
from app.models.routes import Route
from app.schemas.incidents import IncidentListResponse, IncidentDetailResponse, IncidentCreateRequest

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
        "source": inc.source or "simulation",
        "created_at": inc.created_at,
        "expires_at": inc.expires_at,
    }

@router.get("", response_model=List[IncidentListResponse])
def get_active_incidents(db: Session = Depends(get_db)):
    """Get all active incidents."""
    incidents = db.query(Incident).filter(Incident.status == "active").all()
    return [map_incident_to_schema(inc, db) for inc in incidents]

@router.post("", response_model=IncidentDetailResponse)
def create_incident(req: IncidentCreateRequest, db: Session = Depends(get_db)):
    """Create a custom incident."""
    route = db.query(Route).filter(Route.id == req.affected_route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    expires_at = None
    if req.duration_minutes:
        expires_at = datetime.now() + timedelta(minutes=req.duration_minutes)

    incident = Incident(
        incident_type=req.incident_type,
        severity=req.severity,
        title=req.title or f"{req.incident_type} on {route.name}",
        description=req.description,
        lat=req.lat,
        lng=req.lng,
        affected_route_id=req.affected_route_id,
        estimated_delay_min=req.estimated_delay_min,
        status="active",
        source=req.source,
        expires_at=expires_at,
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return map_incident_to_schema(incident, db)


@router.delete("/{incident_id}")
def delete_incident(incident_id: str, db: Session = Depends(get_db)):
    """Delete an incident."""
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

    db.delete(incident)
    db.commit()
    return {"status": "deleted", "id": incident_id}


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
