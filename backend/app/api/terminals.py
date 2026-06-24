from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.terminals import Terminal
from app.schemas.terminals import TerminalResponse

router = APIRouter(prefix="/terminals", tags=["Terminals"])


@router.get("", response_model=List[TerminalResponse])
def get_terminals(db: Session = Depends(get_db)):
    return db.query(Terminal).all()
