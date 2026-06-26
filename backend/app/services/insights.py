import json
import logging
import os
from typing import Optional

from app.simulation.demand import (
    get_demand_forecast,
    get_total_daily_demand,
    get_peak_hours,
    get_route_multipliers_summary,
)

logger = logging.getLogger(__name__)

BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "apac.amazon.nova-lite-v1:0")
AWS_REGION = os.environ.get("AWS_REGION", "ap-southeast-1")

ROUTE_SUMMARIES: dict[int, str] = {
    1: "Tagum Corridor — high-volume inter-city route serving the Davao–Tagum daily commute.",
    3: "Digos Corridor — moderate-volume southbound commuter route with consistent midday traffic.",
    2: "Panabo Corridor — short-distance commuter route with high frequency and sharp peak demand.",
    4: "Mati Corridor — long-distance east coast route with lower baseline demand but significant tourist-related surges.",
    5: "Kidapawan Corridor — upland route connecting Davao to Kidapawan, with moderate demand driven by agricultural trade.",
}

RECOMMENDATIONS: dict[int, str] = {
    1: "Consider adding 2 extra trips during 6–8 AM and 4–6 PM peak windows to reduce overcrowding on the Tagum corridor.",
    3: "Deploy 1 additional bus during the 11 AM–1 PM lunch peak to absorb the midday demand surge on the Digos corridor.",
    2: "Short-headway scheduling is critical for Panabo — maintain 10-minute intervals during morning peak to prevent bunching.",
    4: "Schedule long-distance Mati trips with a mid-morning departure to align with tourist arrival patterns; consider seasonal capacity adjustments.",
    5: "Coordinate Kidapawan departures with market hours (6–9 AM) to capture agricultural commuter demand.",
}

CONFIDENCE_LABELS = {
    1: ("high", "Historical data shows consistent daily patterns on this route."),
    3: ("high", "Digos corridor demand follows a stable commuter pattern with high predictability."),
    2: ("medium", "Panabo's short-haul nature makes demand sensitive to weather and local events."),
    4: ("low", "Mati's long-distance demand is highly seasonal and can vary significantly."),
    5: ("medium", "Kidapawan demand is influenced by agricultural cycles and local market schedules."),
}

try:
    import boto3
    from botocore.exceptions import NoCredentialsError, ClientError

    bedrock = boto3.client("bedrock-runtime", region_name=AWS_REGION)
    BEDROCK_AVAILABLE = True
    logger.info("Amazon Bedrock client initialized (model=%s, region=%s).", BEDROCK_MODEL_ID, AWS_REGION)
except Exception:
    bedrock = None
    BEDROCK_AVAILABLE = False
    logger.info("Amazon Bedrock not available — falling back to template-based insights.")


def _generate_bedrock_insight(route_id: int, forecast_data: dict) -> Optional[dict]:
    if not BEDROCK_AVAILABLE or bedrock is None:
        return None

    prompt = f"""You are a public transit demand analyst in Davao Region, Philippines.
Given the following demand forecast data for a transit route, generate a short insight
with: 1) a one-sentence summary of the demand pattern, 2) an operational recommendation,
3) peak hours identified.

Route ID: {route_id}
Daily Total Demand: {forecast_data['daily_total']}
Peak Hours: {json.dumps(forecast_data['peak_hours'])}
Forecast: {json.dumps(forecast_data['forecast'][:6])}

Respond in JSON format with keys: "summary", "recommendation", "peak_hours"."""

    try:
        native_request = {
            "messages": [
                {
                    "role": "user",
                    "content": [{"text": prompt}],
                }
            ],
            "inferenceConfig": {
                "max_new_tokens": 1000,
                "temperature": 0.3,
            },
        }

        response = bedrock.invoke_model(
            modelId=BEDROCK_MODEL_ID,
            body=json.dumps(native_request),
        )

        response_body = json.loads(response["body"].read())
        content = response_body.get("output", {}).get("message", {}).get("content", [])
        if content:
            text_parts = [c["text"] for c in content if c.get("text")]
            full_text = "\n".join(text_parts)
            clean = full_text.strip().removeprefix("```json").removesuffix("```").strip()
            return json.loads(clean)

        logger.warning("Bedrock response had unexpected structure: %s", response_body)
        return None
    except Exception as e:
        logger.warning("Bedrock insight generation failed: %s", e)
        return None


def _generate_template_insight(route_id: int) -> dict:
    daily_total = get_total_daily_demand(route_id)
    peaks = get_peak_hours(route_id)
    multipliers = get_route_multipliers_summary(route_id)

    summary = ROUTE_SUMMARIES.get(
        route_id,
        f"Route {route_id} has a daily estimated demand of {daily_total:,} passengers."
    )
    recommendation = RECOMMENDATIONS.get(
        route_id,
        "Monitor demand patterns and adjust fleet deployment during peak hours."
    )

    active_factors = []
    if multipliers["weekend"] < 1:
        active_factors.append("Weekend mode active (demand reduced ~25%)")
    if multipliers["holiday"] != 1.0:
        label = "increased" if multipliers["holiday"] > 1 else "reduced"
        active_factors.append(f"Holiday multiplier active: demand {label}")
    if multipliers["festival"] > 1:
        active_factors.append("Local festival season boosting demand")
    if multipliers["weather"] < 1:
        active_factors.append("Adverse weather reducing demand")
    if multipliers["weather"] > 1:
        active_factors.append("Clear weather boosting demand")

    confidence_label = CONFIDENCE_LABELS.get(route_id, ("medium", ""))

    return {
        "summary": f"{summary} Peak demand reaches {peaks[0]['demand']:,} passengers during {peaks[0]['label'].lower()} (hour {peaks[0]['hour']:02d}:00). Total daily estimate: {daily_total:,} passengers.",
        "recommendation": recommendation,
        "peak_hours": [p["hour"] for p in peaks],
        "confidence": confidence_label[0],
        "confidence_note": confidence_label[1],
        "active_factors": active_factors,
    }


def get_insights(route_id: int) -> dict:
    forecast_data = {
        "daily_total": get_total_daily_demand(route_id),
        "peak_hours": get_peak_hours(route_id),
        "forecast": get_demand_forecast(route_id, 24),
    }

    bedrock_result = _generate_bedrock_insight(route_id, forecast_data)

    template = _generate_template_insight(route_id)

    if bedrock_result:
        return {
            "summary": bedrock_result.get("summary", template["summary"]),
            "recommendation": bedrock_result.get("recommendation", template["recommendation"]),
            "peak_hours": bedrock_result.get("peak_hours", template["peak_hours"]),
            "daily_total": forecast_data["daily_total"],
            "confidence": template["confidence"],
            "confidence_note": template["confidence_note"],
            "active_factors": template["active_factors"],
            "source": "Amazon Bedrock AI",
        }

    return {
        "summary": template["summary"],
        "recommendation": template["recommendation"],
        "peak_hours": [p["hour"] for p in forecast_data["peak_hours"]],
        "daily_total": forecast_data["daily_total"],
        "confidence": template["confidence"],
        "confidence_note": template["confidence_note"],
        "active_factors": template["active_factors"],
        "source": "Template-based (Bedrock unavailable)",
    }


class TemplateInsightProvider:
    async def generate_insight(
        self,
        scenario_type: str,
        route_name: str,
        impact: dict,
        parameters: dict,
    ) -> dict:
        templates = {
            "route_closure": "Route closure on {route} will cause significant disruption. "
                             "Estimated {affected_buses} buses affected, {affected_passengers} passengers impacted. "
                             "Alternative route: {alt_route}. Travel time increase of {delay_min} min.",
            "demand_surge": "Demand surge detected on {route}. Passenger volume increasing by {pct}%. "
                            "Consider deploying additional buses to maintain service levels.",
            "severe_weather": "Severe weather affecting {route}. "
                              "Speed reduced by {pct}%, expect delays of {delay_min} min. "
                              "Advise passengers to allow extra travel time.",
            "combined": "Combined disruption on {route}: {sub_impacts}. "
                        "Multiple factors contributing to {delay_min} min estimated delays.",
        }

        template = templates.get(scenario_type, "Disruption scenario active on {route}.")
        delay = impact.get("travel_time_delta_min", 0)
        pct = impact.get("travel_time_delta_pct", 0)
        alt = impact.get("alternative_route", "N/A")

        text = template.format(
            route=route_name,
            affected_buses=impact.get("affected_buses", 0),
            affected_passengers=impact.get("affected_passengers", 0),
            alt_route=alt,
            delay_min=delay,
            pct=pct,
            sub_impacts=parameters.get("description", "multiple events"),
        )

        return {
            "text": text,
            "type": "alert" if delay > 15 else "recommendation",
            "confidence": "high" if scenario_type == "route_closure" else "medium",
            "suggested_actions": [
                f"Reroute buses around {route_name}" if "closure" in scenario_type else
                f"Deploy backup buses to {route_name}",
                "Notify passengers of expected delays",
                f"Update ETA predictions for {route_name}",
            ],
        }
