import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.eta import calculate_eta
from app.schemas.eta import ETAResponse

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
