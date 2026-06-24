from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.routes import Route
from app.schemas.routes import RouteResponse

router = APIRouter(prefix="/routes", tags=["Routes"])


@router.get("", response_model=List[RouteResponse])
def get_routes(db: Session = Depends(get_db)):
    return db.query(Route).all()


@router.get("/{route_id}", response_model=RouteResponse)
def get_route(route_id: int, db: Session = Depends(get_db)):
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    return route

