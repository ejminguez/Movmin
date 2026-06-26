from abc import ABC, abstractmethod
from typing import Dict, Any, List

class InsightProvider(ABC):
    @abstractmethod
    async def generate_insight(
        self,
        scenario_type: str,
        route_name: str,
        impact: Dict[str, Any],
        parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate simulated AI recommendations and insights."""
        pass

class TemplateInsightProvider(InsightProvider):
    async def generate_insight(
        self,
        scenario_type: str,
        route_name: str,
        impact: Dict[str, Any],
        parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        confidence = "medium"
        actions = []
        text = ""
        
        if scenario_type == "route_closure":
            delay_min = impact.get("travel_time_delta_min", 15)
            alt_route = impact.get("alternative_route", "remaining corridors")
            
            if delay_min >= 20:
                text = (
                    f"CRITICAL: Corridor {route_name} is closed. Transit operations are severely disrupted. "
                    f"Rerouting operations via {alt_route} adds an estimated {delay_min:.0f} minutes of travel time. "
                    f"Recommend deploying 3 additional standby buses to handle the commuter overflow."
                )
                confidence = "high"
                actions = [
                    f"Activate emergency rerouting plans via {alt_route}",
                    "Deploy 3 standby buses to adjacent high-capacity routes",
                    "Issue passenger advisories via radio and mobile apps"
                ]
            else:
                text = (
                    f"Alert: corridor {route_name} closure has moderate impact. "
                    f"Rerouting via {alt_route} increases average transit times by {delay_min:.0f} minutes. "
                    f"Current capacity on alternate corridors can absorb passenger displacement with minor delays."
                )
                confidence = "medium"
                actions = [
                    f"Reroute affected buses to {alt_route}",
                    "Monitor congestion levels at transfer terminals"
                ]
                
        elif scenario_type == "demand_surge":
            pct_increase = parameters.get("demand_increase_pct", 50)
            occupancy_pct = impact.get("occupancy_delta_pct", 50)
            buses_needed = max(1, int(pct_increase / 20))
            
            if pct_increase >= 50:
                text = (
                    f"CRITICAL DEMAND SURGE: Passenger volume on {route_name} has surged by {pct_increase}%. "
                    f"Occupancy rates are projected to hit {100 + occupancy_pct:.0f}% capacity. "
                    f"Immediate dispatch of {buses_needed} additional relief fleet buses is required to prevent terminal overload."
                )
                confidence = "high"
                actions = [
                    f"Dispatch {buses_needed} relief buses immediately",
                    "Adjust headway intervals from 15 mins to 8 mins",
                    "Deploy terminal marshals to manage passenger queues"
                ]
            else:
                text = (
                    f"Notice: Passenger demand on {route_name} is up {pct_increase}%. "
                    f"Fleet utilization will rise to {80 + occupancy_pct:.0f}% but remains within safety limits. "
                    f"Minor delays at boarding points expected."
                )
                confidence = "medium"
                actions = [
                    "Monitor boarding queue build-up at peak terminals",
                    "Enable dynamic schedule adjustments if queues exceed 30 mins"
                ]
                
        elif scenario_type == "severe_weather":
            condition = parameters.get("weather_condition", "heavy_rain")
            speed_drop = impact.get("congestion_delta_pct", 20)
            delay_min = impact.get("travel_time_delta_min", 10)
            
            text = (
                f"WEATHER ALERT: {condition.replace('_', ' ').title()} conditions along {route_name} "
                f"have reduced travel speeds by {speed_drop:.0f}%. "
                f"Transit times are extended by {delay_min:.0f} minutes. Advise all operators to exercise caution."
            )
            confidence = "medium"
            actions = [
                "Enforce weather-adjusted speed limits (max 40 km/h)",
                "Increase safety distance intervals between active buses",
                "Display safety warnings on terminal signage"
            ]
            
        elif scenario_type == "combined":
            scenario_id = parameters.get("preset_id", "")
            if "landslide" in scenario_id:
                text = (
                    f"DISASTER RECOVERY: Severe landslide has blocked the Marilog corridor (Davao → Kidapawan). "
                    f"Route is 100% closed. Displacement is causing heavy traffic congestion (+20%) and "
                    f"overcapacity (+15%) on remaining routes. Deploy 3 alternative route buses via Davao → Digos."
                )
                confidence = "high"
                actions = [
                    "Declare Marilog corridor route closure and suspend ticketing",
                    "Deploy 3 alternative route buses via Digos/Cotabato detours",
                    "Establish emergency commuter shelters at Ecoland Terminal"
                ]
            elif "surge" in scenario_id:
                text = (
                    f"FESTIVAL MANAGEMENT: Kadayawan Festival demand surge (+50%) active across all Davao corridors. "
                    f"Total passenger count has doubled. Platform utilization is critical at 95%. "
                    f"Activate maximum regional fleet schedule (deploy 8 reserve buses across all corridors)."
                )
                confidence = "high"
                actions = [
                    "Activate all 8 regional reserve buses from depot",
                    "Implement express shuttle loops between major hubs",
                    "Cooperate with LGU for priority transit lanes"
                ]
            else:  # typhoon
                text = (
                    f"REGIONAL CRISIS: Typhoon Mindanao is causing severe storms region-wide with landslides closing the Davao → Mati route. "
                    f"Average travel times are up by 35 minutes across all corridors. High risk of localized flooding."
                )
                confidence = "high"
                actions = [
                    "Suspend Davao → Mati corridor operations immediately",
                    "Implement region-wide speed reduction of 40%",
                    "Direct active buses to nearest safe terminal hubs"
                ]
        else:
            text = f"Simulation complete. No major anomalies detected for scenario type: {scenario_type}."
            confidence = "low"
            actions = ["Maintain normal monitoring schedules"]
            
        return {
            "text": text,
            "type": "recommendation" if confidence == "high" else "info",
            "confidence": confidence,
            "suggested_actions": actions
        }
