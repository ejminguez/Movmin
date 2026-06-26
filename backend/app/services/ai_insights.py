import json
import logging
import os
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.services.heatmap import (
    aggregate_municipality_demand,
    aggregate_corridor_density,
    detect_underserved_areas,
    recommend_terminals,
    get_hotspots,
    get_summary_stats,
    get_heatmap_metrics_for_ai,
)

logger = logging.getLogger(__name__)

BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "us.amazon.nova-lite-v1:0")
AWS_REGION = os.environ.get("AWS_REGION", "ap-southeast-1")


def _build_prompt(metrics: List[Dict], summary: Dict) -> str:
    municipalities_text = "\n".join(
        f"- Municipality: {m['municipality']}, Demand Score: {m['density_score']}, "
        f"Coverage Score: {m['coverage_score']}, Avg Wait Time: {m['average_wait_time']} min, "
        f"Active Routes: {m['active_routes']}, Underserved: {m['underserved']}, "
        f"Nearest Terminal: {m['terminal_distance_km']} km, Population: {m['population']}"
        for m in metrics[:10]
    )

    prompt = f"""You are a transportation planning analyst for the Davao Region in Mindanao, Philippines.

Analyze the following transit data and provide actionable planning insights.

SUMMARY STATISTICS:
- Highest Demand Municipality: {summary.get('highest_demand_municipality', 'N/A')} (Score: {summary.get('highest_demand_score', 0)})
- Average Density Score: {summary.get('average_density_score', 0)}
- Most Utilized Corridor: {summary.get('most_utilized_corridor', 'N/A')} (Score: {summary.get('most_utilized_corridor_score', 0)})
- Fastest Growing Area: {summary.get('fastest_growing_area', 'N/A')}
- Underserved Areas: {summary.get('underserved_count', 0)}
- Terminal Recommendations Needed: {summary.get('terminal_recommendations_count', 0)}

MUNICIPALITY METRICS (top 10 by demand):
{municipalities_text}

Based on this data, provide:

1. **Demand Assessment** — What is the overall demand pattern across the region? Which corridors or municipalities need immediate attention?

2. **Planning Concerns** — What are the most critical issues (underserved areas, capacity gaps, long wait times)?

3. **Recommendations** — What specific actions should be taken to improve transit service?

4. **Terminal Recommendations** — Where should new terminals or transit hubs be prioritized?

5. **Priority Level** — What is the overall urgency (LOW/MEDIUM/HIGH/CRITICAL)?

Keep the response concise and actionable. Use bullet points for clarity."""

    return prompt


def _invoke_bedrock(prompt: str) -> Optional[str]:
    try:
        import boto3

        bedrock = boto3.client("bedrock-runtime", region_name=AWS_REGION)

        native_request = {
            "schemaVersion": "messages",
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
            return "\n".join(text_parts)

        logger.warning("Bedrock response had unexpected structure: %s", response_body)
        return None

    except ImportError:
        logger.warning("boto3 not installed. Cannot invoke Bedrock.")
        return None
    except Exception as e:
        logger.error("Failed to invoke Bedrock: %s", e, exc_info=True)
        return None


def _generate_fallback_insights(
    metrics: List[Dict],
    summary: Dict,
    underserved: List[Dict],
    terminal_recs: List[Dict],
    hotspots: List[Dict],
) -> Dict:
    lines = []
    lines.append(f"**Demand Assessment:** The region shows an average density score of {summary['average_density_score']}/100. "
                  f"The highest demand is in **{summary['highest_demand_municipality']}** (Score: {summary['highest_demand_score']}). "
                  f"The most utilized corridor is **{summary['most_utilized_corridor']}**.")

    underserved_names = [u["municipality"] for u in underserved[:5]]
    if underserved_names:
        lines.append(f"**Underserved Areas:** {', '.join(underserved_names)} require immediate attention due to high demand and limited coverage.")

    if terminal_recs:
        top_terminal = terminal_recs[0]["municipality"]
        lines.append(f"**Terminal Priority:** **{top_terminal}** is the top candidate for a new terminal (Priority: {terminal_recs[0]['priority']}).")

    total_high = sum(1 for m in metrics if m["density_score"] >= 60)
    total_critical = sum(1 for m in metrics if m["density_score"] >= 80)
    lines.append(f"**Priority Level:** **HIGH** — {total_high} municipalities show high demand, with {total_critical} at critical levels. "
                  f"Immediate capacity improvements needed for underserved corridors.")

    return {
        "summary": "\n".join(lines),
        "underserved_areas": [
            {
                "municipality": u["municipality"],
                "reason": u["reason"],
                "severity": u["severity"],
            }
            for u in underserved[:5]
        ],
        "terminal_recommendations": [
            {
                "location": r["municipality"],
                "reason": r["reason"],
                "priority": r["priority"],
                "expected_impact": r["expected_impact"],
            }
            for r in terminal_recs[:5]
        ],
        "corridor_observations": [
            {
                "corridor": h["municipality"],
                "score": h["density_score"],
                "level": h["demand_level"],
            }
            for h in hotspots[:5]
        ],
    }


def generate_planning_insights(db: Session) -> Dict:
    try:
        metrics = get_heatmap_metrics_for_ai(db)
        summary = get_summary_stats(db)
        underserved = detect_underserved_areas(db)
        terminal_recs = recommend_terminals(db)
        hotspots = get_hotspots(db)

        prompt = _build_prompt(metrics, summary)
        ai_text = _invoke_bedrock(prompt)
        fallback = ai_text is None

        if fallback:
            logger.info("Bedrock unavailable, using rule-based fallback insights.")
            result = _generate_fallback_insights(metrics, summary, underserved, terminal_recs, hotspots)
            result["fallback"] = True
            return result

        return {
            "summary": ai_text,
            "underserved_areas": [
                {
                    "municipality": u["municipality"],
                    "reason": u["reason"],
                    "severity": u["severity"],
                }
                for u in underserved[:5]
            ],
            "terminal_recommendations": [
                {
                    "location": r["municipality"],
                    "reason": r["reason"],
                    "priority": r["priority"],
                    "expected_impact": r["expected_impact"],
                }
                for r in terminal_recs[:5]
            ],
            "corridor_observations": [
                {
                    "corridor": h["municipality"],
                    "score": h["density_score"],
                    "level": h["demand_level"],
                }
                for h in hotspots[:5]
            ],
            "ai_generated": not fallback,
            "fallback": False,
        }

    except Exception as e:
        logger.error("Failed to generate planning insights: %s", e, exc_info=True)
        return {
            "summary": "Error generating insights. Using basic analysis.",
            "underserved_areas": [],
            "terminal_recommendations": [],
            "corridor_observations": [],
            "ai_generated": False,
            "fallback": True,
            "error": str(e),
        }
