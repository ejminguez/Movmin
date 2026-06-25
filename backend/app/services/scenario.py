import uuid
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.models.routes import Route
from app.models.buses import Bus
from app.models.incidents import Incident
from app.models.scenario_log import ScenarioLog
from app.services.insights import TemplateInsightProvider
from app.services.weather import WEATHER_CONDITIONS

logger = logging.getLogger(__name__)

# Alternative route lookup for closures
ALT_ROUTES = {
    "Davao → Tagum": "Davao → Panabo",
    "Davao → Panabo": "Davao → Tagum",
    "Davao → Digos": "Davao → Kidapawan",
    "Davao → Mati": "Davao → Tagum",
    "Davao → Kidapawan": "Davao → Digos",
}

class ScenarioManager:
    def __init__(self):
        self.active_scenario: Optional[Dict[str, Any]] = None
        self.expires_at: Optional[datetime] = None
        self.overrides: Dict[int, Dict[str, Any]] = {}  # route_id -> overrides dict
        self.simulated_scenarios: Dict[str, Dict[str, Any]] = {}

    def apply_scenario(self, scenario_data: Dict[str, Any], duration_seconds: int):
        self.active_scenario = scenario_data
        self.expires_at = datetime.now() + timedelta(seconds=duration_seconds)
        self.overrides = scenario_data.get("overrides", {})
        logger.info(f"Applied scenario {scenario_data.get('scenario_id')} (Type: {scenario_data.get('type')}) for {duration_seconds}s. Expires at {self.expires_at}")

    def reset(self):
        if self.active_scenario:
            logger.info(f"Reset active scenario: {self.active_scenario.get('scenario_id')}")
        self.active_scenario = None
        self.expires_at = None
        self.overrides = {}

    def get_overrides(self, route_id: int) -> Optional[Dict[str, Any]]:
        if self.expires_at and datetime.now() > self.expires_at:
            self.reset()
            return None
        return self.overrides.get(route_id)

    def is_active(self) -> bool:
        if self.expires_at and datetime.now() > self.expires_at:
            self.reset()
            return False
        return self.active_scenario is not None

    def get_status_payload(self) -> Optional[Dict[str, Any]]:
        if not self.is_active():
            return None
        return {
            "scenario_id": self.active_scenario.get("scenario_id"),
            "type": self.active_scenario.get("type"),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "affected_route_ids": list(self.overrides.keys())
        }

# Global scenario manager instance
scenario_manager = ScenarioManager()

class ScenarioEngine:
    def __init__(self):
        self.insight_provider = TemplateInsightProvider()

    def _get_current_metrics(self, db: Session) -> Dict[str, Any]:
        """Gather current state metrics for before/after snapshots."""
        buses = db.query(Bus).all()
        routes = db.query(Route).all()
        
        total_buses = len(buses)
        active_buses = [b for b in buses if b.status in ("active", "delayed", "NORMAL", "DELAYED")]
        
        avg_speed = sum(b.speed for b in active_buses) / len(active_buses) if active_buses else 45.0
        avg_occupancy = sum(b.occupancy for b in buses) / len(buses) if buses else 20.0
        
        # Calculate overall travel time baseline (averages)
        avg_travel_time = 0.0
        if routes:
            # Simple average route distance is ~65 km, at avg speed
            total_dist = sum(r.distance_km or 60.0 for r in routes)
            avg_travel_time = (total_dist / len(routes)) / avg_speed * 60.0
            
        return {
            "avg_travel_time_min": round(avg_travel_time, 1),
            "avg_speed_kmh": round(avg_speed, 1),
            "avg_occupancy_pct": round((avg_occupancy / 50.0) * 100.0, 1),
            "active_buses": len(active_buses),
            "total_buses": total_buses,
            "total_passengers": sum(b.occupancy for b in buses)
        }

    async def simulate(
        self,
        scenario_type: str,
        route_id: Optional[int],
        parameters: Optional[Dict[str, Any]],
        db: Session
    ) -> Dict[str, Any]:
        before_snap = self._get_current_metrics(db)
        
        # Default empty parameters if none provided
        params = parameters or {}
        
        impact = {
            "travel_time_delta_min": 0.0,
            "travel_time_delta_pct": 0.0,
            "congestion_delta_pct": 0.0,
            "occupancy_delta_pct": 0.0,
            "affected_buses": 0,
            "affected_passengers": 0,
            "alternative_route": None
        }
        
        overrides = {}
        target_route_name = "All Routes"
        
        all_routes = db.query(Route).all()
        route_id_map = {r.name: r.id for r in all_routes}
        route_name_map = {r.id: r.name for r in all_routes}
        
        if scenario_type == "route_closure":
            if not route_id:
                raise ValueError("route_id is required for route_closure scenario")
            
            target_route = db.query(Route).filter(Route.id == route_id).first()
            if not target_route:
                raise ValueError(f"Route with ID {route_id} not found")
            
            target_route_name = target_route.name
            affected_buses = db.query(Bus).filter(Bus.route_id == route_id).all()
            
            impact["affected_buses"] = len(affected_buses)
            impact["affected_passengers"] = sum(b.occupancy for b in affected_buses)
            impact["alternative_route"] = ALT_ROUTES.get(target_route_name, "Davao → Digos")
            impact["travel_time_delta_min"] = 25.0
            impact["travel_time_delta_pct"] = 45.0
            impact["congestion_delta_pct"] = 22.0
            impact["occupancy_delta_pct"] = 15.0
            
            # Setup overrides for apply:
            # Target route closed
            overrides[route_id] = {
                "status": "CLOSED",
                "speed_multiplier": 0.0,
                "status_override": "STOPPED"
            }
            # Other routes absorb congestion and occupancy
            for r in all_routes:
                if r.id != route_id:
                    overrides[r.id] = {
                        "speed_multiplier": 0.8,
                        "occupancy_multiplier": 1.15,
                        "status_override": "DELAYED"
                    }
                    
        elif scenario_type == "demand_surge":
            demand_pct = params.get("demand_increase_pct", 50.0)
            
            impact["travel_time_delta_min"] = round((demand_pct / 10.0) * 2.0, 1)
            impact["congestion_delta_pct"] = round(demand_pct * 0.4, 1)
            impact["occupancy_delta_pct"] = demand_pct
            
            if route_id:
                target_route = db.query(Route).filter(Route.id == route_id).first()
                if target_route:
                    target_route_name = target_route.name
                
                buses = db.query(Bus).filter(Bus.route_id == route_id).all()
                impact["affected_buses"] = len(buses)
                impact["affected_passengers"] = sum(b.occupancy for b in buses)
                
                overrides[route_id] = {
                    "speed_multiplier": 0.85,
                    "occupancy_multiplier": 1.0 + (demand_pct / 100.0),
                    "status_override": "DELAYED" if demand_pct >= 50 else "MINOR DELAY"
                }
            else:
                buses = db.query(Bus).all()
                impact["affected_buses"] = len(buses)
                impact["affected_passengers"] = sum(b.occupancy for b in buses)
                
                for r in all_routes:
                    overrides[r.id] = {
                        "speed_multiplier": 0.85,
                        "occupancy_multiplier": 1.0 + (demand_pct / 100.0),
                        "status_override": "DELAYED" if demand_pct >= 50 else "MINOR DELAY"
                    }
                    
        elif scenario_type == "severe_weather":
            cond = params.get("weather_condition", "heavy_rain")
            weather_meta = WEATHER_CONDITIONS.get(cond, WEATHER_CONDITIONS["heavy_rain"])
            speed_mult = weather_meta["speed_multiplier"]
            delay = weather_meta["delay_min"]
            
            impact["travel_time_delta_min"] = float(delay)
            impact["travel_time_delta_pct"] = round(((1.0 / speed_mult) - 1.0) * 100.0, 1)
            impact["congestion_delta_pct"] = round((1.0 - speed_mult) * 100.0, 1)
            impact["occupancy_delta_pct"] = 0.0
            
            if route_id:
                target_route = db.query(Route).filter(Route.id == route_id).first()
                if target_route:
                    target_route_name = target_route.name
                    
                buses = db.query(Bus).filter(Bus.route_id == route_id).all()
                impact["affected_buses"] = len(buses)
                impact["affected_passengers"] = sum(b.occupancy for b in buses)
                
                overrides[route_id] = {
                    "weather": cond,
                    "speed_multiplier": speed_mult,
                    "delay_min_override": float(delay),
                    "status_override": "DELAYED" if cond != "storm" else "SEVERELY DELAYED"
                }
            else:
                buses = db.query(Bus).all()
                impact["affected_buses"] = len(buses)
                impact["affected_passengers"] = sum(b.occupancy for b in buses)
                
                for r in all_routes:
                    overrides[r.id] = {
                        "weather": cond,
                        "speed_multiplier": speed_mult,
                        "delay_min_override": float(delay),
                        "status_override": "DELAYED" if cond != "storm" else "SEVERELY DELAYED"
                    }
                    
        elif scenario_type == "combined":
            preset_id = params.get("preset_id", "marilog_landslide")
            
            if preset_id == "marilog_landslide":
                target_route_name = "Davao → Kidapawan"
                rid = route_id_map.get(target_route_name)
                
                if rid:
                    buses = db.query(Bus).filter(Bus.route_id == rid).all()
                    impact["affected_buses"] = len(buses)
                    impact["affected_passengers"] = sum(b.occupancy for b in buses)
                    impact["alternative_route"] = "Davao → Digos"
                    impact["travel_time_delta_min"] = 35.0
                    impact["travel_time_delta_pct"] = 60.0
                    impact["congestion_delta_pct"] = 28.0
                    impact["occupancy_delta_pct"] = 18.0
                    
                    # Target closed
                    overrides[rid] = {
                        "status": "CLOSED",
                        "speed_multiplier": 0.0,
                        "status_override": "STOPPED"
                    }
                    # Others congested
                    for r in all_routes:
                        if r.id != rid:
                            overrides[r.id] = {
                                "speed_multiplier": 0.75,
                                "occupancy_multiplier": 1.20,
                                "status_override": "DELAYED"
                            }
                            
            elif preset_id == "kadayawan_surge":
                target_route_name = "All Corridors"
                buses = db.query(Bus).all()
                impact["affected_buses"] = len(buses)
                impact["affected_passengers"] = sum(b.occupancy for b in buses)
                impact["travel_time_delta_min"] = 12.0
                impact["travel_time_delta_pct"] = 25.0
                impact["congestion_delta_pct"] = 25.0
                impact["occupancy_delta_pct"] = 50.0
                
                for r in all_routes:
                    overrides[r.id] = {
                        "speed_multiplier": 0.8,
                        "occupancy_multiplier": 1.5,
                        "status_override": "OVERLOADED"
                    }
                    
            elif preset_id == "typhoon":
                target_route_name = "All Corridors & Mati Closure"
                mati_id = route_id_map.get("Davao → Mati")
                buses = db.query(Bus).all()
                
                impact["affected_buses"] = len(buses)
                impact["affected_passengers"] = sum(b.occupancy for b in buses)
                impact["travel_time_delta_min"] = 45.0
                impact["travel_time_delta_pct"] = 80.0
                impact["congestion_delta_pct"] = 48.0
                impact["occupancy_delta_pct"] = 15.0
                impact["alternative_route"] = "Davao → Tagum"
                
                for r in all_routes:
                    if r.id == mati_id:
                        overrides[r.id] = {
                            "status": "CLOSED",
                            "speed_multiplier": 0.0,
                            "status_override": "STOPPED"
                        }
                    else:
                        overrides[r.id] = {
                            "weather": "storm",
                            "speed_multiplier": 0.5,
                            "delay_min_override": 25.0,
                            "occupancy_multiplier": 1.15,
                            "status_override": "SEVERELY DELAYED"
                        }
        
        # Calculate projected state for after snapshot
        after_speed = before_snap["avg_speed_kmh"] * (1.0 - (impact["congestion_delta_pct"] / 100.0))
        if after_speed <= 10.0:
            after_speed = 10.0
            
        after_snap = {
            "avg_travel_time_min": round(before_snap["avg_travel_time_min"] + impact["travel_time_delta_min"], 1),
            "avg_speed_kmh": round(after_speed, 1),
            "avg_occupancy_pct": round(min(100.0, before_snap["avg_occupancy_pct"] + impact["occupancy_delta_pct"]), 1),
            "active_buses": before_snap["active_buses"] - impact["affected_buses"] if scenario_type == "route_closure" else before_snap["active_buses"],
            "total_buses": before_snap["total_buses"],
            "total_passengers": int(before_snap["total_passengers"] * (1.0 + (impact["occupancy_delta_pct"] / 100.0)))
        }
        
        # Generate simulated AI Insight
        insight_res = await self.insight_provider.generate_insight(
            scenario_type=scenario_type,
            route_name=target_route_name,
            impact=impact,
            parameters={**params, "preset_id": params.get("preset_id")}
        )
        
        scenario_id = f"sim-{uuid.uuid4().hex[:8]}"
        
        result = {
            "scenario_id": scenario_id,
            "type": scenario_type,
            "timestamp": datetime.now().isoformat(),
            "impact": impact,
            "before_snapshot": before_snap,
            "after_snapshot": after_snap,
            "insight": insight_res,
            "overrides": overrides
        }
        
        # Log to Database
        try:
            log = ScenarioLog(
                scenario_type=scenario_type,
                parameters=params,
                impact_summary=impact,
                insight_text=insight_res["text"]
            )
            db.add(log)
            db.commit()
            logger.info("Scenario log saved to database successfully.")
        except Exception as e:
            db.rollback()
            logger.warning(f"Failed to write scenario audit log to database: {e}")
            
        # Store for apply lookup
        scenario_manager.simulated_scenarios[scenario_id] = result

        return result

# Global scenario engine instance
scenario_engine = ScenarioEngine()
