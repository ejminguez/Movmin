from datetime import datetime
from pydantic import BaseModel


class DemandForecastHour(BaseModel):
    hour: int
    predicted_demand: int
    confidence: float
    weather_impact: str | None = None


class DemandForecastResponse(BaseModel):
    route_id: int
    route_name: str
    color: str
    forecast_date: str
    generated_at: datetime
    forecasts: list[DemandForecastHour]


class DemandForecastAllResponse(BaseModel):
    routes: list[DemandForecastResponse]


class DemandPeak(BaseModel):
    hour: int
    demand: int
    label: str


class DemandInsightResponse(BaseModel):
    route_id: int
    route_name: str
    color: str
    daily_total: int
    peak_hours: list[DemandPeak]
    summary: str
    recommendation: str
    source: str
