# OSRM Setup Guide

[OSRM](http://project-osrm.org/) (Open Source Routing Machine) computes real-world, road-following driving routes for Movmin's bus corridor simulation.

## Architecture

```
┌─────────────┐    /route/v1/driving/...    ┌──────────────┐
│  OSRM        │◄──────────────────────────►│  FastAPI      │
│  (Docker)    │   port 5000 → host 5005    │  routing.py   │
└─────────────┘                             └──────┬───────┘
                                                   │
                                         ┌─────────▼────────┐
                                         │  PostgreSQL        │
                                         │  routes.waypoints  │
                                         └───────────────────┘
```

## Automated Setup

```bash
./scripts/setup-osrm.sh
```

Downloads the Philippines OSM extract, runs `osrm-extract` + `osrm-contract`, and verifies the container responds to route queries. Steps are idempotent — completed steps are skipped on re-run.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (macOS) or Docker Engine (Linux)
- ~2 GB free disk space for the OSM data + processed graph

## Manual Setup

### 1. Download OSM Data

```bash
mkdir -p backend/osrm_data
curl -L -o backend/osrm_data/philippines-latest.osm.pbf \
  https://download.geofabrik.de/asia/philippines-latest.osm.pbf
```

> **Note:** The Philippines extract is ~200 MB compressed. Other regions are available at [download.geofabrik.de](https://download.geofabrik.de/).

### 2. Extract Road Network

The `osrm-extract` step reads the raw `.pbf` file, processes road geometries, and produces an `.osrm` graph:

```bash
docker run --rm -t \
  -v "$(pwd)/backend/osrm_data:/data" \
  osrm/osrm-backend \
  osrm-extract -p /opt/car.lua /data/philippines-latest.osm.pbf
```

This takes 1–3 minutes depending on hardware.

### 3. Build Contraction Hierarchies

`osrm-contract` precomputes shortest-path data for fast queries:

```bash
docker run --rm -t \
  -v "$(pwd)/backend/osrm_data:/data" \
  osrm/osrm-backend \
  osrm-contract /data/philippines-latest.osrm
```

This takes 3–10 minutes and produces files like `.osrm.hsgr`, `.osrm.edges`, etc.

### 4. Start the OSRM Server

The `docker-compose.yml` at the project root runs OSRM on port **5005** (mapped from container port 5000):

```bash
docker compose up -d
```

Verify it is running:

```bash
curl -s "http://localhost:5005/route/v1/driving/121.0,14.5;121.1,14.6?overview=false" | jq .
```

Expected response: a JSON object with a `code: "Ok"` field.

## Docker-Compose Reference

From `docker-compose.yml`:

```yaml
services:
  osrm:
    image: osrm/osrm-backend:latest
    container_name: osrm-backend
    ports:
      - "5005:5000"
    volumes:
      - ./backend/osrm_data:/data
    command: osrm-routed --algorithm ch /data/philippines-latest.osrm
    restart: unless-stopped
```

- Port `5005` is used instead of `5000` to avoid the macOS Control Center conflict.
- `--algorithm ch` uses Contraction Hierarchies for fast queries.
- The data directory is mounted read-write so the container can read the graph files.

## Usage

### Test a Route

```bash
# Query OSRM directly (lon,lat format)
curl -s "http://localhost:5005/route/v1/driving/120.9842,14.5995;121.0193,14.5610?geometries=geojson" | jq '.routes[0].geometry'
```

### Seed Routes into Database

After OSRM is running, reseed routes to fetch road-following waypoints:

```bash
cd backend
python -m app.simulation.reseed
```

This queries OSRM for each defined corridor and stores the road-following waypoints in the `routes.waypoints` JSON column.

## Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| `curl: connection refused` | OSRM container not started | `docker compose up -d` |
| Container exits immediately | Missing `.osrm` graph files | Run `./scripts/setup-osrm.sh` |
| Port 5005 already in use | Another service on that port | Change the host port in `docker-compose.yml` |
| `osrm-extract` fails with "out of memory" | Default Docker memory too low | Increase Docker Desktop memory to 4 GB (Settings → Resources → Advanced) |
| Slow first request | Cold start — OSRM loads graph into RAM | Wait ~30–60s after container start. First request is always slowest. |

## Standalone Docker Commands

Run each step independently (without `docker-compose`):

```bash
# Extract
docker run --rm -t -v "$(pwd)/backend/osrm_data:/data" osrm/osrm-backend \
  osrm-extract -p /opt/car.lua /data/philippines-latest.osm.pbf

# Contract
docker run --rm -t -v "$(pwd)/backend/osrm_data:/data" osrm/osrm-backend \
  osrm-contract /data/philippines-latest.osrm

# Route (foreground)
docker run --rm -i -p 5005:5000 -v "$(pwd)/backend/osrm_data:/data" osrm/osrm-backend \
  osrm-routed --algorithm ch /data/philippines-latest.osrm
```

## Updating OSM Data

1. Download a fresh `.pbf` extract: `./scripts/setup-osrm.sh`
2. Stop the container: `docker compose stop osrm`
3. Re-run `osrm-extract` and `osrm-contract` (script skips existing files — delete the old ones first)
4. Start the stack: `docker compose up -d`
5. Re-seed routes: `cd backend && python -m app.simulation.reseed`

## Verification Checklist

- [ ] `docker compose ps` shows `osrm-backend` as `Up`
- [ ] `curl http://localhost:5005/route/v1/driving/121.0,14.5;121.1,14.6?overview=false` returns `{"code":"Ok"}`
- [ ] `GET /api/routes` returns waypoints with 100+ coordinate pairs per route
- [ ] Map displays curved road-following polylines instead of straight lines
- [ ] Route distances match real-world driving distances
- [ ] Bus simulation works with OSM waypoints (not fallback hardcoded points)
