# Implementation Plan

## Project Structure

```
Movmin/
├── frontend/                    # React + Vite + TypeScript
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── map/             # MapLibre GL interactive map
│   │   │   ├── panels/          # Side panels (route status, incidents)
│   │   │   ├── charts/          # Recharts visualizations
│   │   │   └── layout/          # App shell, header, sidebar
│   │   ├── hooks/               # Custom React hooks
│   │   ├── lib/                 # Utilities, API client, constants
│   │   ├── types/               # TypeScript type definitions
│   │   └── pages/               # Route pages
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.ts
├── backend/                     # FastAPI
│   ├── app/
│   │   ├── api/                 # Route handlers
│   │   ├── core/                # Config, DB session
│   │   ├── models/              # SQLAlchemy models
│   │   ├── schemas/             # Pydantic schemas
│   │   ├── services/            # Business logic
│   │   └── simulation/          # Data generation engine
│   ├── alembic/                 # DB migrations
│   ├── requirements.txt
│   └── main.py
├── infrastructure/              # AWS / IaC
│   ├── lambda/                  # Lambda function code
│   └── amplify/                 # Amplify config
├── plans/                       # Planning documents
│   ├── 00_PRODUCT_SPECIFICATION.md
│   └── 01_IMPLEMENTATION_PLAN.md
└── README.md
```

---

## Phase 0 — Project Scaffolding (2 hrs)

### Backend
- [ ] Initialize FastAPI project with `main.py`, `requirements.txt`
- [ ] Set up project structure: `api/`, `core/`, `models/`, `schemas/`, `services/`, `simulation/`
- [ ] Configure CORS, environment variables, logging
- [ ] Add SQLAlchemy + Alembic with PostgreSQL connection
- [ ] Define initial DB models: `routes`, `buses`, `terminals`, `incidents`, `analytics`, `forecasts`
- [ ] Create initial migration

### Frontend
- [ ] Scaffold Vite + React + TypeScript project
- [ ] Install and configure Tailwind CSS + shadcn/ui
- [ ] Install MapLibre GL, Recharts
- [ ] Set up project structure: `components/`, `hooks/`, `lib/`, `types/`, `pages/`
- [ ] Create API client wrapper in `lib/api.ts`
- [ ] Build app layout shell: header, sidebar, main content area

### Infrastructure
- [ ] Create AWS Amplify config for frontend deployment
- [ ] Set up Lambda function stubs
- [ ] Document required AWS env vars

**Checkpoint:** Both projects boot, clean compile, app shell renders.

---

## Phase 1 — Simulation Engine + Real-Time Corridor Monitoring (6 hrs)

### Backend
- [ ] Implement `simulation/engine.py` — generates synthetic bus GPS data for 50 buses across 5 routes
- [ ] Create `/api/routes` endpoints: `GET /routes`, `GET /routes/{id}`
- [ ] Create `/api/buses` endpoints: `GET /buses` (returns live positions with speed, occupancy, status)
- [ ] Create `/api/terminals` endpoints: `GET /terminals`
- [ ] Create `/api/corridors/status` — aggregate status per route (active bus count, avg speed, congestion level)
- [ ] Implement WebSocket endpoint `ws:// /ws/buses` for pushing live bus position updates
- [ ] Add simulation tick loop (1–2s interval) updating bus positions along route paths

### Frontend
- [ ] Initialize MapLibre GL map with base tile layer
- [ ] Add route path polylines (color-coded by congestion)
- [ ] Add bus markers with direction rotation, updated via WebSocket
- [ ] Add terminal markers
- [ ] Build Route Status Panel showing per-route: active buses, avg speed, status text
- [ ] Connect map interactions (click route → highlight, show detail)

**Checkpoint:** Map displays 5 routes with moving buses, route status panel updates live.

---

## Phase 2 — Smart ETA Prediction (4 hrs)

### Backend
- [ ] Implement ETA service (`services/eta.py`)
  - Base travel time = distance / avg speed
  - Traffic delay multiplier
  - Weather delay lookup
  - Incident delay lookup
- [ ] Create `GET /eta?from={terminal_id}&to={terminal_id}` endpoint
- [ ] Integrate simulated weather conditions into ETA calculation
- [ ] Return breakdown: base time + traffic + weather + incident delays

### Frontend
- [ ] Add ETA panel UI (origin/destination selectors)
- [ ] Display ETA result with delay breakdown
- [ ] Update ETA dynamically as conditions change on the route
- [ ] Show ETA tooltip on bus marker hover

**Checkpoint:** User can select origin/destination and see live ETA with delay reasoning.

---

## Phase 3 — Incident Intelligence Feed (3 hrs)

### Backend
- [ ] Implement incident simulation (`simulation/incidents.py`)
  - Flood warnings, landslides, road closures, weather advisories
  - Random incident generation with affected routes and delay estimates
- [ ] Create `GET /incidents` endpoint (list active incidents)
- [ ] Create `GET /incidents/{id}` endpoint
- [ ] Add incident markers to bus positions (affects speed/status)

### Frontend
- [ ] Build Incident Feed Panel (scrollable list of active incidents)
- [ ] Show incident markers on the map
- [ ] Color-code by severity: flood (blue), landslide (red), closure (gray)
- [ ] Click incident → show detail card with affected routes, estimated delay
- [ ] Auto-scroll to new incidents as they appear

**Checkpoint:** Incidents appear on map and feed, bus behavior reacts, ETA updates.

---

## Phase 4 — AI Demand Intelligence (4 hrs)

### Backend
- [ ] Implement demand simulation (`simulation/demand.py`)
  - Historical passenger counts per route
  - Holiday/school calendar multipliers
  - Event/festival detection (e.g., Kadayawan)
  - Weather impact on demand
- [ ] Create `GET /demand` endpoint returning current demand + forecast
- [ ] Create `GET /demand/insights` — AI-generated text insights
- [ ] Integrate Amazon Bedrock for insight generation:
  - Prompt: route name, current demand, forecast growth, contributing factors
  - Return: natural language recommendation

### Frontend
- [ ] Build Demand Forecast Chart (Recharts bar/line chart)
- [ ] Show current demand + forecast delta
- [ ] Display AI insight card with generated text
- [ ] Add route selector to filter by route

**Checkpoint:** Demand chart shows per-route forecast, AI insights update with context.

---

## Phase 5 — Route Analytics Dashboard (3 hrs)

### Backend
- [ ] Implement analytics aggregation (`services/analytics.py`)
  - Average travel time per route
  - Delay frequency and average delay
  - On-time performance (within threshold %)
  - Route utilization (occupancy / capacity)
- [ ] Create `GET /analytics/routes` endpoint
- [ ] Create `GET /analytics/routes/{id}/history` for trend data

### Frontend
- [ ] Build dashboard stat cards (avg delay, on-time rate, utilization)
- [ ] Add line chart for travel time trends (last 24h simulated)
- [ ] Add bar chart for route comparison
- [ ] Add date range picker (simulated time)

**Checkpoint:** Dashboard shows per-route stats and historical trends.

---

## Phase 6 — What-If Scenario Simulator (4 hrs)

### Backend
- [ ] Implement scenario engine (`services/scenario.py`)
  - Input: route closure or demand increase percentage
  - Logic: recalculate route metrics under new conditions
  - Output: travel time delta, congestion delta, recommended alternative route, resource recommendation
- [ ] Integrate Bedrock for scenario recommendation prompt
- [ ] Create `POST /scenarios/simulate` endpoint
- [ ] Create `GET /scenarios/presets` — list of demo scenarios

### Frontend
- [ ] Build Scenario Simulator panel
  - Route closure selector + demand increase slider
  - "Run Simulation" button
- [ ] Display before/after comparison
- [ ] Show AI recommendation text
- [ ] Highlight alternative route on map
- [ ] Add preset scenario buttons for demo flow

**Checkpoint:** User can simulate disruption, see impact, get AI recommendation.

---

## Phase 7 — Provincial Mobility Heatmap (3 hrs)

### Backend
- [ ] Implement heatmap data generation (`services/heatmap.py`)
  - Aggregate demand by location/municipality
  - Compute corridor density scores
  - Identify underserved areas
- [ ] Create `GET /heatmap` endpoint returning GeoJSON features
- [ ] Create `GET /heatmap/insights` — AI analysis of patterns + terminal recommendations

### Frontend
- [ ] Add heatmap layer toggle on MapLibre GL map
- [ ] Color gradient: low (green) → high (red) demand
- [ ] Show demand hotspot labels
- [ ] Build Planning Insights panel (underserved areas, terminal recommendations)
- [ ] Connect to AI insight endpoint

**Checkpoint:** Map has toggleable heatmap overlay, planning insights panel populated.

---

## Phase 8 — Demo Polish & Integration (4 hrs)

### Frontend
- [ ] Build guided demo mode: step-through with auto-highlighting
- [ ] Add incident trigger button (simulate flood/closure on demand)
- [ ] Polish UI: loading states, empty states, error states
- [ ] Responsive layout adjustments
- [ ] Add time controls (speed up / slow down simulation)

### Backend
- [ ] Seed script for reproducible demo data
- [ ] Health check endpoint `GET /health`
- [ ] API documentation with OpenAPI tags

### Integration
- [ ] End-to-end demo flow walkthrough
- [ ] Performance tuning (WebSocket batch updates)
- [ ] Final README update with setup instructions

**Checkpoint:** Complete demo walkable end-to-end in 5–7 minutes.

---

## Phase 9 — Deployment (2 hrs)

### Backend
- [ ] Containerize with Docker
- [ ] Deploy FastAPI to AWS ECS or Lambda (via Mangum)
- [ ] Set up RDS PostgreSQL instance
- [ ] Run migrations on deploy

### Frontend
- [ ] Configure Amplify build settings
- [ ] Set environment variables for API endpoint, WebSocket URL
- [ ] Deploy to Amplify

### Infrastructure
- [ ] Set up Bedrock model access
- [ ] Create scheduled Lambda for simulation data generation
- [ ] CloudWatch logging and monitoring

**Checkpoint:** Full stack running on AWS, accessible via public URL.

---

## Total Estimate: ~31 hours (within 48-hour budget)

| Phase | Task | Hours |
|-------|------|-------|
| 0 | Project Scaffolding | 2 |
| 1 | Corridor Monitoring | 6 |
| 2 | ETA Prediction | 4 |
| 3 | Incident Feed | 3 |
| 4 | AI Demand Intelligence | 4 |
| 5 | Route Analytics | 3 |
| 6 | Scenario Simulator | 4 |
| 7 | Mobility Heatmap | 3 |
| 8 | Demo Polish | 4 |
| 9 | Deployment | 2 |
| | **Buffer** | **~17** |

**Key risk:** AWS Bedrock access may require approval — have fallback mock AI insights.

---

## Implementation Ordering Rationale

1. **Phase 1 first** — map with moving buses is the demo's visual centerpiece; everything else builds on it.
2. **Phase 2–3** — ETA and incidents add interactivity and create cause-effect dynamics on the map.
3. **Phase 4–5** — AI and analytics leverage data already flowing from Phases 1–3.
4. **Phase 6** — scenario simulator is a standalone feature but depends on route/incident data.
5. **Phase 7** — heatmap is the most independent feature; can be built last.
6. **Phase 8–9** — polish and deploy after all features are stable.
