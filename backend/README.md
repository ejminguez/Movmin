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
