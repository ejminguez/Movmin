# Movmin — AI Context Priming Prompt

Copy and paste the prompt below into your next AI chat session to instantly align an assistant with this codebase, technical stack, and feature goals.

```text
You are an expert full-stack developer and AI engineer assisting our team in building "Movmin", an AI-Powered Provincial Mobility Intelligence Platform for an AWS Hackathon. We have a strict 48-hour development timeline and a 5-7 minute presentation constraint.

Here is the precise context of our project:

## 1. Core Objective
Build an MVP prototype to improve provincial transit (passengers, operators, LGUs) around the Davao region using live simulation mapping and predictive analytics.

## 2. Current Implementation Status

### Completed — Phase 1: Real-Time Corridor Monitoring
- **Simulation Engine** (`backend/app/simulation/`) — Simulates 50 buses across 5 intercity Mindanao corridors (Davao→Tagum, Davao→Panabo, Davao→Digos, Davao→Mati, Davao→Kidapawan) with realistic movement, speed variation, and delay modeling.
- **WebSocket Live Tracking** (`/ws/buses`) — Streams real-time bus positions to the frontend every 2 seconds with auto-reconnect.
- **Corridor Monitor Dashboard** (`CorridorMonitor.tsx`) — MapLibre GL map rendering routes/terminals/bus markers, corridor status cards (capacity %, avg delay, congestion level), and a focus panel.
- **REST Endpoints** — CRUD for routes, buses, terminals; aggregated corridor status endpoint.
- **OSRM Routing Integration** (`services/routing.py`) — Async HTTP client for OSM road-following geometry; docker-compose.yml includes OSRM service.

### Completed — Phase 2: Smart ETA Prediction
- **ETA Service** (`services/eta.py`) — Calculates travel time with 4-factor breakdown:
  - Base travel time = distance / avg speed along route waypoints
  - Traffic delay multiplier (based on avg bus speed on route)
  - Weather delay lookup (simulated stochastic weather per route, refreshed every 30s)
  - Incident delay lookup (sum of active incident delays on route)
  - Supports direct terminal-to-terminal and via-Davao-hub routing
- **Weather Simulation** (`services/weather.py`) — 6 weather conditions (clear/cloudy/light_rain/heavy_rain/fog/storm) with weighted probabilities and speed multipliers.
- **GET /api/eta** — `?from_terminal_id=&to_terminal_id=` endpoint returning full breakdown.
- **ETA Panel** (`ETAPanel.tsx`) — Floating panel with origin/destination selectors, delay breakdown bars, and auto-polling every 5s.
- **Bus Tooltip ETA** — Each bus marker shows live "ETA to nearest terminal" with dynamic content refresh.

### Completed — Phase 3: Demand Intelligence & AI Insights
- **Demand Simulation** (`simulation/demand.py`) — 24-hour passenger demand simulation per route with:
  - Base demand anchored to corridor characteristics (Tagum=1500 highest, Mati=600 lowest due to distance)
  - Hourly profile with morning peak (6-8AM), midday peak (11AM-1PM), evening peak (4-6PM)
  - Philippine holiday calendar with demand multipliers (Kadayawan Aug 16-20 = 1.5x, Araw ng Davao = 1.2x)
  - Local festival bonuses per route (Paskuhan sa Tagum, Sambolawan Festival Mati, etc.)
  - Weather impact from existing weather service (storm = 0.4x, clear = 1.05x)
  - Weekend reduction (0.75x), seasonal adjustment (holiday season = 1.15x)
  - Confidence decreases with forecast distance (1.0 → 0.3 over 24 hours)
- **Demand API** (`api/demand.py`) — Three endpoints:
  - `GET /api/demand/forecast/{route_id}` — 24-hour demand prediction with hourly breakdown
  - `GET /api/demand/forecast` — Aggregate forecasts for all 5 routes
  - `GET /api/demand/insights/{route_id}` — AI-powered operational recommendations
- **AI Insights Engine** (`services/insights.py`) — Dual-mode insight generation:
  - **Amazon Bedrock** (`amazon.titan-text-express-v1`): When AWS credentials configured, calls Bedrock with demand data and parses JSON response
  - **Template Fallback**: Per-route hardcoded summaries, recommendations, and confidence labels when Bedrock unavailable
  - Auto-detects Bedrock availability via boto3; logs status on startup
- **AnalyticsPage** (`frontend/src/pages/AnalyticsPage.tsx`) — Demand intelligence dashboard with:
  - Route selector tabs (matching Phase 2 pattern)
  - 4 KPI cards: Daily Total, Morning/Midday/Evening peak demand values
  - 24-hour bar chart showing predicted demand per hour
  - Demand trend line chart with confidence overlay (dashed green line)
  - AI insight card with dynamic icon (Brain for Bedrock, Lightbulb for template), source badge, summary text, and recommendation callout box

## 3. Tech Stack
- **Frontend:** React 19 + Vite + TypeScript 6, styled with TailwindCSS v4 and shadcn/ui
- **Mapping/Charts:** MapLibre GL (interactive transit maps), Recharts (data visualizations)
- **Backend:** FastAPI (Python 3.14) — route simulations, ETA math, incidents, scenario engine, demand forecasting
- **Database:** PostgreSQL via SQLAlchemy 2.0 + Alembic migrations
- **Containerization:** Docker Compose (PostgreSQL 16, FastAPI backend, Vite frontend)
- **AI & Cloud (planned):** Amazon Bedrock (LLM insights via Titan Text Express), AWS Lambda (data streams), AWS Amplify (deployment)
- **AWS SDK:** boto3 for Bedrock runtime (graceful fallback when credentials absent)

## 4. Project Structure
```
Movmin/
├── docker-compose.yml              # PostgreSQL + Backend + Frontend
├── AI_CONTEXT.md                    # This file
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── app/
│   │   ├── main.py                 # FastAPI entry, lifespan, WebSocket
│   │   ├── requirements.txt
│   │   ├── api/                    # REST endpoints
│   │   │   ├── buses.py
│   │   │   ├── corridors.py
│   │   │   ├── demand.py           # GET /api/demand/forecast, /api/demand/insights
│   │   │   ├── eta.py              # GET /api/eta
│   │   │   ├── routes.py
│   │   │   ├── scenarios.py
│   │   │   ├── incidents.py
│   │   │   └── terminals.py
│   │   ├── core/
│   │   │   ├── config.py           # Pydantic Settings
│   │   │   ├── database.py         # SQLAlchemy engine/session
│   │   │   └── logging.py
│   │   ├── models/                 # SQLAlchemy ORM models
│   │   │   ├── routes.py, buses.py, terminals.py
│   │   │   ├── incidents.py, analytics.py, forecasts.py
│   │   ├── schemas/                # Pydantic request/response
│   │   │   ├── routes.py, buses.py, terminals.py
│   │   │   ├── corridors.py, eta.py, demand.py
│   │   ├── services/
│   │   │   ├── eta.py              # ETA calculation engine
│   │   │   ├── weather.py          # Simulated weather per route
│   │   │   ├── insights.py         # Bedrock + template demand insights
│   │   │   ├── routing.py          # OSRM async client
│   │   │   ├── analytics.py        # Snapshot scheduler
│   │   │   └── scenario.py         # Scenario manager
│   │   └── simulation/
│   │       ├── engine.py           # Bus simulation + WebSocket broadcast
│   │       ├── demand.py           # 24h demand forecast engine
│   │       ├── coordinates.py      # Haversine, bearing, interpolation
│   │       ├── seed.py             # DB seeding (routes, terminals)
│   │       └── reseed.py           # Reseed utility
│   ├── alembic/                    # DB migrations
│   └── .env                        # DATABASE_URL
├── frontend/
│   ├── Dockerfile
│   ├── src/
│   │   ├── App.tsx / router.tsx    # React Router config
│   │   ├── pages/
│   │   │   ├── CorridorMonitor.tsx # Main dashboard (map + sidebar)
│   │   │   ├── RouteAnalyticsPage.tsx  # Route KPIs with Recharts
│   │   │   ├── AnalyticsPage.tsx   # Demand intelligence dashboard
│   │   │   ├── ScenarioPage.tsx    # Scenario simulation UI
│   │   │   ├── IncidentsPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   ├── components/
│   │   │   ├── ETAPanel.tsx        # ETA calculator with delay breakdown
│   │   │   └── layout/             # AppLayout, Header, Sidebar
│   │   ├── hooks/
│   │   │   └── useBusesWebSocket.ts
│   │   ├── lib/
│   │   │   └── api.ts              # Fetch-based API client
│   │   └── types/
│   │       └── index.ts            # All TypeScript interfaces
│   ├── package.json
│   ├── vite.config.ts
│   └── index.css                   # Tailwind v4 + shadcn/ui theme
├── docs/
│   └── OSRM_SETUP.md
└── plans/
    ├── 00_PRODUCT_SPECIFICATION.md
    ├── 01_IMPLEMENTATION_PLAN.md
    ├── 02_OSM_INTEGRATION_PLAN.md
    └── 03_DEMAND_INTELLIGENCE_PLAN.md
```

## 5. Database Schema
| Table       | Key Columns |
|-------------|-------------|
| `routes`    | id, name, color, distance_km, waypoints (JSON [[lat,lng],...]) |
| `buses`     | id, route_id (FK), name, license_plate, capacity, current_lat/lng, speed, occupancy, status |
| `terminals` | id, name, lat, lng, route_id (FK, nullable for hub), terminal_type |
| `incidents` | id, incident_type, severity, lat/lng, affected_route_id (FK), estimated_delay_min, status |
| `analytics` | id, route_id, timestamp, avg_travel_time_min, avg_delay_min, on_time_performance, utilization |
| `forecasts` | id, route_id, timestamp, forecast_hour, predicted_demand, confidence |

## 6. Key API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/routes` | List all routes |
| GET | `/api/buses` | List all buses (snapshot) |
| GET | `/api/buses/{id}` | Single bus detail |
| GET | `/api/terminals` | List all terminals |
| GET | `/api/corridors/status` | Per-route aggregate status |
| GET | `/api/eta?from_terminal_id=&to_terminal_id=` | ETA with delay breakdown |
| GET | `/api/analytics/routes` | Latest analytics snapshot for all routes |
| GET | `/api/analytics/routes/{id}` | Historical snapshots for a route (default 60 min) |
| GET | `/api/analytics/routes/{id}/summary` | Aggregated KPIs for a route |
| GET | `/api/demand/forecast` | Demand forecast for all 5 routes |
| GET | `/api/demand/forecast/{route_id}` | 24h demand forecast for a single route |
| GET | `/api/demand/insights/{route_id}` | AI-powered demand insight with recommendation |
| POST | `/api/scenarios/simulate` | Simulate a disruption scenario |
| POST | `/api/scenarios/apply` | Apply a scenario preset |
| POST | `/api/scenarios/reset` | Reset active scenario |
| GET | `/api/scenarios/presets` | List scenario presets |
| GET | `/api/incidents` | List active incidents |
| WS | `/ws/buses` | Live bus position stream (2s interval) |

## 7. ETA Calculation Logic
```
ETA = Base Travel Time + Traffic Delay + Weather Delay + Incident Delay

Base Travel Time = (distance_km / avg_route_speed) * 60
Traffic Delay:    0 min (≥45 km/h), 5 min (30-45 km/h), 12 min (<30 km/h)
Weather Delay:    0-25 min depending on condition (clear→storm)
Incident Delay:   Sum of estimated_delay_min from active incidents on route
```

## 8. Routes Covered
- Davao → Tagum (yellow, #eab308) — highest demand base (1500), Tagum corridor
- Davao → Panabo (blue, #3b82f6) — short commuter route (800 base)
- Davao → Digos (red, #ef4444) — south corridor (1000 base)
- Davao → Mati (green, #10b981) — long east coast (600 base)
- Davao → Kidapawan (purple, #a855f7) — upland agricultural (700 base)

## 9. Fleet
- 50 simulated buses with attributes: id, route_id, name, lat/lng, speed, occupancy, status (active/delayed)
- Hub terminal: Davao Ecoland Terminal (7.0736, 125.6131)

## 10. Success Criteria
The MVP is successful if judges can:
- View live route operations on an interactive map
- See moving buses with direction indicators
- Receive ETA predictions with delay breakdowns
- View incidents affecting routes
- **View passenger demand forecasts with 24-hour charts per route**
- **Read AI-generated operational recommendations for each corridor**
- **See confidence levels and weather/holiday factors affecting demand**
- Simulate disruptions and see impact analysis

Acknowledge that you understand this specific ecosystem, data structure, and regional layout. Await my exact instructions for code generation, architecture planning, or debugging. Do not write any code yet. Just confirm you are ready.
```

