from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from app.core.database import get_db
from app.schemas.scenarios import (
    ScenarioPreset,
    ScenarioSimulateRequest,
    ScenarioResult,
    ScenarioApplyRequest,
    ScenarioApplyResponse,
    ScenarioResetResponse,
)
from app.services.scenario import scenario_engine, scenario_manager

router = APIRouter(prefix="/scenarios", tags=["Scenarios"])

PRESETS = [
    {
        "id": "marilog_landslide",
        "name": "Marilog Landslide Closure",
        "description": "Simulate a landslide closing the Davao–Bukidnon/Kidapawan corridor",
        "type": "combined",
        "parameters": {
            "preset_id": "marilog_landslide"
        }
    },
    {
        "id": "kadayawan_surge",
        "name": "Kadayawan Festival Demand Surge",
        "description": "+50% passenger demand across all Davao routes",
        "type": "combined",
        "parameters": {
            "preset_id": "kadayawan_surge",
            "demand_increase_pct": 50.0
        }
    },
    {
        "id": "typhoon",
        "name": "Typhoon Mindanao",
        "description": "Severe storm region-wide + Davao–Mati road closure",
        "type": "combined",
        "parameters": {
            "preset_id": "typhoon",
            "weather_condition": "storm"
        }
    }
]

@router.get("/presets", response_model=Dict[str, List[ScenarioPreset]])
def get_presets():
    return {"presets": PRESETS}

@router.post("/simulate", response_model=ScenarioResult)
async def simulate_scenario(req: ScenarioSimulateRequest, db: Session = Depends(get_db)):
    try:
        params = req.parameters.dict() if req.parameters else {}
        result = await scenario_engine.simulate(
            scenario_type=req.type,
            route_id=req.route_id,
            parameters=params,
            db=db
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation failed: {str(e)}")

@router.post("/apply", response_model=ScenarioApplyResponse)
def apply_scenario(req: ScenarioApplyRequest):
    simulated = scenario_manager.simulated_scenarios.get(req.scenario_id)
    if not simulated:
        raise HTTPException(
            status_code=404,
            detail="Simulated scenario not found. Please simulate the scenario before applying it."
        )
    
    scenario_manager.apply_scenario(simulated, req.duration_seconds)
    
    expires_at_str = scenario_manager.expires_at.isoformat() if scenario_manager.expires_at else ""
    return ScenarioApplyResponse(applied=True, expires_at=expires_at_str)

@router.post("/reset", response_model=ScenarioResetResponse)
def reset_scenario():
    scenario_manager.reset()
    return ScenarioResetResponse(status="ok")
