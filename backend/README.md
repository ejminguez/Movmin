# Movmin API

FastAPI backend for the Movmin mobility intelligence platform. Provides real-time corridor monitoring, ETA prediction, incident intelligence, demand forecasting, route analytics, and scenario simulation.

## Tech Stack

- **Framework:** FastAPI
- **ORM:** SQLAlchemy 2.0
- **Migrations:** Alembic
- **Database:** PostgreSQL (via Supabase)
- **Validation:** Pydantic / pydantic-settings
- **Runtime:** Python 3.14

## Project Structure

```
app/
├── api/            # Route handlers (REST endpoints)
├── core/           # Config, database session, logging
├── models/         # SQLAlchemy ORM models
├── schemas/        # Pydantic request/response schemas
├── services/       # Business logic layer
├── simulation/     # Data generation engine
└── main.py         # Application entry point
```

## Quick Start

### Prerequisites

- Python 3.14+
- PostgreSQL database (Supabase or local)

### Setup

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r app/requirements.txt
```

### OSRM Routing Engine (Optional but Recommended)

By default, the backend seeds straight-line waypoint coordinates if OSRM is offline. To use actual road-following geometries, set up OSRM:

1. Download regional OSM data:
   ```bash
   mkdir -p osrm_data
   curl -L -o osrm_data/philippines-latest.osm.pbf https://download.geofabrik.de/asia/philippines-latest.osm.pbf
   ```
2. Build the routing graph (run from the project root directory):
   ```bash
   cd ..
   docker run --rm -t -v "$(pwd)/backend/osrm_data:/data" osrm/osrm-backend osrm-extract -p /opt/car.lua /data/philippines-latest.osm.pbf
   docker run --rm -t -v "$(pwd)/backend/osrm_data:/data" osrm/osrm-backend osrm-contract /data/philippines-latest.osrm
   ```
3. Start the OSRM backend container:
   ```bash
   docker-compose up -d
   ```
4. Seed or re-seed the routes database:
   ```bash
   cd backend
   PYTHONPATH=. .venv/bin/python app/simulation/reseed.py
   ```

### Run this for OSRM (in Mac)
```
docker run -d \
  --name osrm-backend \
  -p 5005:5000 \
  -v "$(pwd)/backend/osrm_data:/data" \
  osrm/osrm-backend \
  osrm-routed --algorithm ch /data/philippines-latest.osrm
```

### Verification and Database Re-seeding (for simulated data OSRM)
1. Verify OSRM is responding:
```bash
curl -s "http://localhost:5005/route/v1/driving/121.0,14.5;121.1,14.6?overview=false"
```
It should return a JSON object with code:ok
2. Re-seed the routes database to fetch actual road-following geometries:
```bash
cd backend
PYTHONPATH=. .venv/bin/python app/simulation/reseed.py
```

### Configuration

Copy the environment template and configure your database connection:

```bash
cp .env.example .env
```

Required environment variable:

```
DATABASE_URL=postgresql://postgres:password@host:5432/postgres
```

For Supabase, use the connection string from Project Settings > Database. The `?pgbouncer=true` parameter is stripped automatically by the application.

### Run

```bash
uvicorn app.main:app --reload
```

The API is available at `http://localhost:8000` with interactive docs at `http://localhost:8000/docs`.

## Database

### Models

| Model      | Table        | Description                           |
|------------|--------------|---------------------------------------|
| Route      | `routes`     | Transit routes with name and color    |
| Bus        | `buses`      | Buses with live position and status   |
| Terminal   | `terminals`  | Route terminals and stops             |
| Incident   | `incidents`  | Active incidents with severity        |
| Analytic   | `analytics`  | Per-route performance snapshots       |
| Forecast   | `forecasts`  | Demand predictions with confidence    |

### Migrations

Tables are created automatically on first startup. For schema changes, use Alembic:

```bash
# Generate a new migration
alembic revision --autogenerate -m "description"

# Apply pending migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

## API Endpoints

| Method | Path               | Description               |
|--------|--------------------|---------------------------|
| GET    | `/health`          | Health check              |

Additional endpoints are added incrementally per the implementation plan.

## Project Status

Under active development. Refer to the implementation plan in `plans/` for the current phase and roadmap.
