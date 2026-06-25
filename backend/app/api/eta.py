import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.eta import calculate_eta, get_bus_eta
from app.schemas.eta import ETAResponse, BusETAResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/eta", tags=["ETA"])


@router.get("", response_model=ETAResponse)
def get_eta(
    from_terminal_id: int = Query(..., description="Origin terminal ID"),
    to_terminal_id: int = Query(..., description="Destination terminal ID"),
    db: Session = Depends(get_db),
):
    result = calculate_eta(from_terminal_id, to_terminal_id, db)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Could not calculate ETA for the given terminals. Make sure both terminals exist and are connected.",
        )
    return result


@router.get("/bus/{bus_id}", response_model=BusETAResponse)
def get_bus_eta_endpoint(bus_id: int, db: Session = Depends(get_db)):
    """Centralized ETA from a bus's current position to its nearest terminal — single source of truth."""
    result = get_bus_eta(bus_id, db)
    if result is None:
        raise HTTPException(status_code=404, detail="Bus not found or ETA could not be calculated.")
    return result
