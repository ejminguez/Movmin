# Movmin

AI-powered provincial mobility intelligence platform that monitors traffic conditions in real time, predicts ETAs, and provides actionable insights for smarter transportation management.

Built for the AWS Hackathon. Davao region focus.

---

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 22+ (for frontend dev outside Docker)
- Python 3.14+ (for backend dev outside Docker)

### Run with Docker Compose (easiest)

```bash
# Start all services (PostgreSQL + Backend + Frontend)
docker compose up --build
```

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs
- **WebSocket:** ws://localhost:8000/ws/buses

### Run without Docker

#### 1. Database

Start PostgreSQL and create the `movmin` database:

```bash
docker run -d --name movmin-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=movmin \
  -p 5432:5432 \
  postgres:16
```

#### 2. Backend

```bash
cd backend
source .venv/bin/activate

# Configure database URL (default: postgresql://postgres:postgres@localhost:5432/movmin)
echo 'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/movmin' > .env

# Start API server
uvicorn app.main:app --reload
```

#### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Features

### Implemented

| Feature | Status |
|---------|--------|
| Real-Time Corridor Monitoring (MapLibre GL map, 50 buses, 5 routes) | ✅ |
| WebSocket Live GPS Stream (2s interval, auto-reconnect) | ✅ |
| OSRM Road-Following Routing (docker-compose, fallback waypoints) | ✅ |
| **Smart ETA Prediction** (4-factor breakdown: base + traffic + weather + incident) | ✅ |
| **ETA Calculator Panel** (origin/destination selectors, dynamic polling) | ✅ |
| **Bus Tooltip ETA** (hover any bus to see ETA to nearest terminal) | ✅ |
| Corridor Status Panel (capacity %, avg delay, congestion level) | ✅ |
| Focus Panel (per-corridor metrics) | ✅ |

### Planned

- Incident Intelligence Feed (PAGASA, floods, landslides)
- AI Demand Intelligence (Kadayawan Festival spikes)
- Route Analytics Dashboard (trends, on-time performance)
- What-If Scenario Simulator (road closures, demand shocks)
- Provincial Mobility Heatmap (terminal hub recommendations)
- Amazon Bedrock integration (AI-generated insights)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TypeScript 6 |
| Styling | TailwindCSS v4, shadcn/ui |
| Maps | MapLibre GL |
| Charts | Recharts |
| Backend | FastAPI (Python 3.14) |
| ORM | SQLAlchemy 2.0 + Alembic |
| Database | PostgreSQL 16 |
| Routing | OSRM (Docker) |
| Containerization | Docker Compose |

---

## Architecture

```
┌──────────┐     HTTP/WS      ┌──────────┐     SQL      ┌──────────┐
│ Frontend │◄────────────────►│ Backend  │◄────────────►│ PostgreSQL│
│ :5173    │   /api + /ws     │ :8000    │              │ :5432     │
└──────────┘                  └────┬─────┘              └──────────┘
                                   │
                           ┌───────▼───────┐
                           │  Simulation   │
                           │  Engine       │
                           │  (in-process) │
                           └───────────────┘
```

- **Simulation Engine** runs in-process with the FastAPI server, updating 50 bus positions every 2 seconds and broadcasting via WebSocket.
- **ETA Service** calculates travel time factoring base speed, traffic congestion, simulated weather, and active incidents.
- **OSRM** (optional) provides real road-following geometry when available; falls back to waypoint interpolation.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/routes` | List all routes |
| GET | `/api/buses` | List all buses (current snapshot) |
| GET | `/api/buses/{id}` | Single bus detail |
| GET | `/api/terminals` | List all terminals |
| GET | `/api/corridors/status` | Per-route aggregate status |
| GET | `/api/eta?from_terminal_id=&to_terminal_id=` | ETA with delay breakdown |
| WS | `/ws/buses` | Live bus position stream |

---

## Project Structure

```
Movmin/
├── docker-compose.yml     # PostgreSQL + Backend + Frontend
├── AI_CONTEXT.md          # AI priming prompt for assistants
├── backend/
│   ├── app/
│   │   ├── api/           # FastAPI route handlers
│   │   ├── core/          # Config, database, logging
│   │   ├── models/        # SQLAlchemy ORM models
│   │   ├── schemas/       # Pydantic request/response schemas
│   │   ├── services/      # Business logic (ETA, weather, routing)
│   │   └── simulation/    # Bus simulation engine + coordinates
│   └── alembic/           # Database migrations
├── frontend/
│   ├── src/
│   │   ├── pages/         # Route pages (CorridorMonitor, etc.)
│   │   ├── components/    # React components (ETAPanel, layout)
│   │   ├── hooks/         # Custom hooks (useBusesWebSocket)
│   │   ├── lib/           # API client, utilities
│   │   └── types/         # TypeScript type definitions
├── plans/                 # Product spec & implementation plan
└── docs/                  # OSRM setup guide
```

---

## ETA Calculation

```
ETA = Base Travel Time + Traffic Delay + Weather Delay + Incident Delay

Base Travel Time = (distance_km / avg_route_speed) × 60
Traffic Delay:    0 min (≥45 km/h), 5 min (30-45 km/h), 12 min (<30 km/h)
Weather Delay:    0–25 min depending on condition (clear → storm)
Incident Delay:   Sum of active incident delays on the route
```

---

## Routes

| Corridor | Color | Distance |
|----------|-------|----------|
| Davao → Tagum | Yellow | ~64 km |
| Davao → Panabo | Blue | ~29 km |
| Davao → Digos | Red | ~54 km |
| Davao → Mati | Green | ~157 km |
| Davao → Kidapawan | Purple | ~82 km |

---

## OSRM Setup (Optional)

For road-following route geometry instead of straight-line waypoints:

```bash
mkdir -p backend/osrm_data
curl -L -o backend/osrm_data/philippines-latest.osm.pbf \
  https://download.geofabrik.de/asia/philippines-latest.osm.pbf

docker run --rm -t -v "$(pwd)/backend/osrm_data:/data" osrm/osrm-backend \
  osrm-extract -p /opt/car.lua /data/philippines-latest.osm.pbf

docker run --rm -t -v "$(pwd)/backend/osrm_data:/data" osrm/osrm-backend \
  osrm-contract /data/philippines-latest.osrm

docker compose up -d osrm
cd backend && .venv/bin/python app/simulation/reseed.py
```

See [docs/OSRM_SETUP.md](docs/OSRM_SETUP.md) for details.
