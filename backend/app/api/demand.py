import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.routes import Route
from app.schemas.demand import (
    DemandForecastHour,
    DemandForecastResponse,
    DemandForecastAllResponse,
    DemandInsightResponse,
    DemandPeak,
)
from app.simulation.demand import get_demand_forecast, get_total_daily_demand, get_peak_hours
from app.services.insights import get_insights

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/demand", tags=["Demand"])


@router.get("/forecast/{route_id}", response_model=DemandForecastResponse)
def get_route_forecast(route_id: int, hours: int = 24, db: Session = Depends(get_db)):
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    forecasts = get_demand_forecast(route_id, hours)

    return DemandForecastResponse(
        route_id=route.id,
        route_name=route.name,
        color=route.color,
        forecast_date=datetime.now().strftime("%Y-%m-%d"),
        generated_at=datetime.now(),
        forecasts=[DemandForecastHour(**f) for f in forecasts],
    )


@router.get("/forecast", response_model=DemandForecastAllResponse)
def get_all_route_forecasts(db: Session = Depends(get_db)):
    routes = db.query(Route).all()
    route_responses = []

    for route in routes:
        forecasts = get_demand_forecast(route.id, 24)
        route_responses.append(
            DemandForecastResponse(
                route_id=route.id,
                route_name=route.name,
                color=route.color,
                forecast_date=datetime.now().strftime("%Y-%m-%d"),
                generated_at=datetime.now(),
                forecasts=[DemandForecastHour(**f) for f in forecasts],
            )
        )

    return DemandForecastAllResponse(routes=route_responses)


@router.get("/insights/{route_id}", response_model=DemandInsightResponse)
def get_route_insights(route_id: int, db: Session = Depends(get_db)):
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    insights = get_insights(route_id)
    peaks = get_peak_hours(route_id)
    daily_total = get_total_daily_demand(route_id)

    return DemandInsightResponse(
        route_id=route.id,
        route_name=route.name,
        color=route.color,
        daily_total=daily_total,
        peak_hours=[DemandPeak(**p) for p in peaks],
        summary=insights["summary"],
        recommendation=insights["recommendation"],
        source=insights["source"],
    )
