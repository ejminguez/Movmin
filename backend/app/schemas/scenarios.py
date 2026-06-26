from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class ScenarioSimulateParameters(BaseModel):
    duration_minutes: Optional[int] = None
    demand_increase_pct: Optional[float] = None
    weather_condition: Optional[str] = None
    route_ids: Optional[List[int]] = None
    preset_id: Optional[str] = None

class ScenarioSimulateRequest(BaseModel):
    type: str = Field(..., description="One of: route_closure, demand_surge, severe_weather, combined")
    route_id: Optional[int] = None
    parameters: Optional[ScenarioSimulateParameters] = None

class ScenarioImpact(BaseModel):
    travel_time_delta_min: float
    travel_time_delta_pct: float
    congestion_delta_pct: float
    occupancy_delta_pct: float
    affected_buses: int
    affected_passengers: int
    alternative_route: Optional[str] = None

class ScenarioInsight(BaseModel):
    text: str
    type: str = Field("recommendation", description="recommendation, alert, info")
    confidence: str = Field("medium", description="high, medium, low")
    suggested_actions: List[str] = Field(default_factory=list)

class ScenarioResult(BaseModel):
    scenario_id: str
    type: str
    timestamp: str
    impact: ScenarioImpact
    before_snapshot: Dict[str, Any]
    after_snapshot: Dict[str, Any]
    insight: ScenarioInsight

class ScenarioPreset(BaseModel):
    id: str
    name: str
    description: str
    type: str
    parameters: Dict[str, Any]

class ScenarioApplyRequest(BaseModel):
    scenario_id: str
    duration_seconds: int = 120

class ScenarioApplyResponse(BaseModel):
    applied: bool
    expires_at: str

class ScenarioResetResponse(BaseModel):
    status: str
