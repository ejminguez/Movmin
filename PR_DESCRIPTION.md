# PR: AI-Powered Demand Intelligence & Provincial Mobility Heatmap

## Summary
Adds passenger demand simulation, AI-powered operational insights, and a provincial mobility heatmap across 22 municipalities in the Davao Region. Merges `feat/ai-demand-intelligence` with `feat/provincial-mobility-heatmap`.

## Changes (31 files, +3,914 / -409)

### Backend — Demand Simulation & AI Insights
- **Demand Simulation Engine** (`simulation/demand.py`) — 24-hour passenger demand per route with hourly profiles, Philippine holiday/festival calendar, weather impact, weekend/season multipliers, confidence decay
- **Demand API** (`api/demand.py`) — `GET /api/demand/forecast`, `GET /api/demand/forecast/{id}`, `GET /api/demand/insights/{id}`
- **AI Insights Engine** (`services/insights.py`) — Dual-mode insights using Amazon Bedrock (nova-lite, configurable via `BEDROCK_MODEL_ID` / `AWS_REGION` env vars) with template-based fallback and `TemplateInsightProvider` for scenario engine
- **Analytics Snapshot Resiliency** — Per-route error handling so one bad route doesn't skip all snapshots

### Backend — Provincial Mobility Heatmap
- **Heatmap Service** (`services/heatmap.py`) — 22-municipality demand aggregation with density scoring, underserved detection, terminal recommendations, corridor density analysis
- **Heatmap API** (`api/heatmap.py`) — 7 endpoints: GeoJSON layer, municipalities, corridors, underserved areas, terminal recs, hotspots, summary stats
- **Planning AI Insights** (`services/ai_insights.py`) — Bedrock-powered regional planning analysis with rule-based fallback

### Backend — Bug Fixes & Quality
- **Bus status normalization** — Engine now writes lowercase statuses (`normal`, `delayed`, `stopped`) so corridor/analytics filters match consistently
- **Weather-aware incidents** — Incident spawning respects current weather (Flood Warning only during rain/storm, auto-expires when weather improves)
- **Scenario-aware weather** — `get_weather_for_route()` checks scenario overrides before falling back to random weather
- **Occupancy fluctuation** — Bus occupancy varies ±2 per tick with 3% surge chance for dynamic utilization charts
- **Reseed FK cleanup** — Proper cascade through scenario_log → forecasts → analytics → incidents → buses → terminals → routes
- **Preset ID fix** — Added `preset_id` to `ScenarioSimulateParameters` schema (was silently dropped by Pydantic)

### Frontend — Demand Intelligence Dashboard
- **AnalyticsPage** — Route selector tabs, 4 KPI cards, 24-hour bar chart, trend line with confidence overlay, AI insight card (Brain/Lightbulb icon, source badge, recommendation callout)
- **RouteAnalyticsPage** — 4 KPI cards, travel time/delay line chart, OTP area chart, capacity utilization bar chart, recent snapshots table

### Frontend — Provincial Mobility Heatmap
- **CorridorMonitor** — Heatmap toggle button, MapLibre GL heatmap layer (circle radius/color by density score, clickable popups, hotspot emoji markers), "Planning" tab with `PlanningInsightsPanel`
- **PlanningInsightsPanel** — Summary tiles, AI/rule-based markdown insights, demand hotspots, underserved areas with severity, terminal priority recommendations
- **New types** — `HeatmapGeoJSON`, `PlanningInsights`, `MunicipalityDemand`, `UnderservedArea`, `TerminalRecommendation`, `DemandHotspot`, `DemandSummary`

### Infrastructure
- **OSRM** — Docker Compose service + `scripts/setup-osrm.sh` for automated data download/processing
- **`.env` support** — Docker Compose now reads `.env` file for Bedrock/AWS configuration
- **Navigation** — Added missing nav items, removed Settings/Incidents pages

## Key Configurations
- Amazon Bedrock: `apac.amazon.nova-lite-v1:0` (default), region `ap-southeast-1` — override via `BEDROCK_MODEL_ID` / `AWS_REGION` env vars
- OSRM: `http://osrm:5000` (default) — override via `OSRM_URL` env var

## How to Test
1. `docker compose up --build -d` — starts DB, backend, frontend, OSRM
2. Visit `http://localhost:5173/analytics` — demand charts & AI insights
3. Visit `http://localhost:5173/` — heatmap toggle on map, "Planning" tab in sidebar
4. Run scenario presets — weather overrides should reflect in ETA/demand
5. Check incident spawning — Flood Warnings should only appear during rain/storm weather
