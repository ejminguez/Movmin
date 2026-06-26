import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.heatmap import (
    generate_heatmap_geojson,
    aggregate_municipality_demand,
    aggregate_corridor_density,
    detect_underserved_areas,
    recommend_terminals,
    get_hotspots,
    get_summary_stats,
)
from app.services.ai_insights import generate_planning_insights

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/heatmap", tags=["Heatmap"])


@router.get("")
def get_heatmap(db: Session = Depends(get_db)):
    return generate_heatmap_geojson(db)


@router.get("/municipalities")
def get_municipality_demand(db: Session = Depends(get_db)):
    return aggregate_municipality_demand(db)


@router.get("/corridors")
def get_corridor_density(db: Session = Depends(get_db)):
    return aggregate_corridor_density(db)


@router.get("/underserved")
def get_underserved_areas(db: Session = Depends(get_db)):
    return detect_underserved_areas(db)


@router.get("/terminals")
def get_terminal_recommendations(db: Session = Depends(get_db)):
    return recommend_terminals(db)


@router.get("/hotspots")
def get_demand_hotspots(db: Session = Depends(get_db)):
    return get_hotspots(db)


@router.get("/summary")
def get_demand_summary(db: Session = Depends(get_db)):
    return get_summary_stats(db)


@router.get("/insights")
def get_planning_insights(db: Session = Depends(get_db)):
    return generate_planning_insights(db)
