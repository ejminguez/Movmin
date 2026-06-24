from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.buses import Bus
from app.schemas.buses import BusResponse

router = APIRouter(prefix="/buses", tags=["Buses"])


@router.get("", response_model=List[BusResponse])
def get_buses(db: Session = Depends(get_db)):
    return db.query(Bus).all()


@router.get("/{bus_id}", response_model=BusResponse)
def get_bus(bus_id: int, db: Session = Depends(get_db)):
    bus = db.query(Bus).filter(Bus.id == bus_id).first()
    if not bus:
        raise HTTPException(status_code=404, detail="Bus not found")
    return bus
