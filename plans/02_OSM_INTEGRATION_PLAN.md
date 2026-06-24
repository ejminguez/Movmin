# OpenStreetMap Routing Integration Plan

## Current Phase: Phase 1 (Refinement)

The project is in **Phase 1 — Simulation Engine + Real-Time Corridor Monitoring**. The core corridor monitoring is functional: 5 hardcoded routes with straight-line waypoints, simulation engine running 50 buses, WebSocket live tracking, and MapLibre GL rendering. OSM integration is a **Phase 1 refinement** that replaces hardcoded waypoints with real road-following geometry from OSM data.

---

## 1. Why OSM Routing?

| Before (Hardcoded) | After (OSM) |
|---|---|
| Straight-line waypoints between cities | Actual road-following polylines |
| Haversine distance (~air distance) | Real driving distance (road km) |
| No road network awareness | Speed limits, road types, one-ways |
| Manual waypoint creation | Automatic routing via OSM graph |
| Simulated bus paths don't follow real roads | Bus paths follow actual highways |

---

## 2. Architecture

```
┌─────────────┐      OSRM HTTP API       ┌──────────────┐
│   OSRM       │◄────────────────────────►│  FastAPI      │
│  (Docker)    │   /route/v1/driving/...  │  /services/   │
│  port 5000   │                          │  routing.py   │
└─────────────┘                          └──────┬───────┘
                                                │
                                      ┌─────────▼────────┐
                                      │  PostgreSQL        │
                                      │  routes.waypoints  │
                                      │  (JSON column)     │
                                      └─────────┬────────┘
                                                │
                                      ┌─────────▼────────┐
                                      │  Frontend          │
                                      │  MapLibre GL       │
                                      │  (no changes       │
                                      │   needed)          │
                                      └───────────────────┘
```

### Components

- **OSRM Backend** — Docker container serving routing requests on port 5000
- **`services/routing.py`** — Async HTTP client that calls OSRM and returns GeoJSON + waypoints
- **`routes.waypoints`** — New JSON column storing `[[lat, lng], ...]` per route
- **`seed.py`** — Fetches OSRM routes at seed time with fallback to hardcoded data
- **MapLibre GL** — Frontend unchanged; reads waypoints from API and draws polylines

---

## 3. Implementation Steps

### 3.1 OSRM Setup

**Option A — Docker (recommended for local dev):**
```bash
docker run -t -v $(pwd):/data ghcr.io/project-osrm/osrm-backend \
  osrm-extract -p /opt/osrm/profiles/car.lua /data/philippines-latest.osm.pbf

docker run -t -v $(pwd):/data ghcr.io/project-osrm/osrm-backend \
  osrm-contract /data/philippines.osrm

docker run -d -p 5000:5000 -v $(pwd):/data \
  --name osrm ghcr.io/project-osrm/osrm-backend \
  osrm-routed /data/philippines.osrm
```

**Data source:** [Geofabrik Philippines extract](https://download.geofabrik.de/asia/philippines-latest.osm.pbf) (~200MB)

**Option B — Public OSRM demo server** (for quick testing, rate-limited):
```
https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}
```

**Option C — GraphHopper** (alternative; Java-based, has a free tier API):
```
https://graphhopper.com/api/1/route?point={lat1},{lng1}&point={lat2},{lng2}&vehicle=car
```

### 3.2 Backend: OSRM Client

| File | Action | Status |
|---|---|---|
| `backend/app/services/routing.py` | **New** — Async OSRM client | ✅ Done |
| `backend/app/models/routes.py` | Add `waypoints = Column(JSON)` | ✅ Done |
| `backend/app/schemas/routes.py` | Update waypoints type | ✅ Done |
| `backend/app/api/routes.py` | Remove hardcoded dict injection, read from model | ✅ Done |
| `backend/app/simulation/seed.py` | Call OSRM on seed, fallback to hardcoded | ✅ Done |
| `backend/app/simulation/engine.py` | Read waypoints from `route.waypoints` | ✅ Done |
| `backend/alembic/versions/` | Migration for waypoints column | ✅ Done |

### 3.3 Migration

```bash
alembic upgrade head
```

### 3.4 Re-seed Routes

The seed script auto-detects if routes exist. To re-seed with OSM data:
```sql
DELETE FROM routes;
```
Then restart the app — seed will fetch routes from OSRM and store road-following geometry.

---

## 4. Alternative Routing Engines

### 4.1 OSRM (Recommended)
| Pro | Con |
|---|---|
| Fastest routing engine (C++) | Must host or use rate-limited public demo |
| Simple HTTP API | Large OSM extract download |
| Well-documented | No built-in turn-by-turn instructions in basic route |

### 4.2 GraphHopper
| Pro | Con |
|---|---|
| Java — easier to extend | Slower than OSRM |
| Free tier: 5,000 requests/day | Java heap overhead |
| Supports multiple vehicle profiles | Public API requires API key |
| Built-in elevation data | |

### 4.3 Valhalla
| Pro | Con |
|---|---|
| C++ (fast) | More complex setup |
| Excellent for isochrones | Best for pedestrian/bike routing |
| Uber's routing engine | |

### 4.4 YourNavigation
| Pro | Con |
|---|---|
| Cloud-hosted (no self-hosting) | Paid |
| Turn-by-turn, traffic data | Commercial dependency |

---

## 5. Frontend Considerations

**No frontend changes required.** The existing code in `CorridorMonitor.tsx`:

```typescript
const coords = route.waypoints.map((w: number[]) => [w[1], w[0]]);
```

Already accepts `[lat, lng]` pairs from the API and converts to `[lng, lat]` for MapLibre. Since waypoints now come from `route.waypoints` (JSON column) instead of the hardcoded dict injection, the frontend works transparently.

### Potential Future Frontend Work

- **Interactive routing** — Let users click two points on the map to get a route between them
- **Alternative route display** — Show primary + alternate routes on the map
- **Route snapping** — Snap bus positions to the nearest road segment (map-matching)
- **Basemap switch** — Option to use OpenStreetMap raster tiles instead of CartoDB

---

## 6. Roadmap Within Phase 1

```
Current state:
  Phase 0 (Scaffolding)       ████████████████████████ 100%
  Phase 1 (Corridor Monitor)  ████████████████░░░░░░░░  70%
    ├── Simulation Engine     ████████████████████████ 100%
    ├── REST Endpoints        ████████████████████████ 100%
    ├── WebSocket Bus Tracking████████████████████████ 100%
    ├── Map Rendering         ████████████████████████ 100%
    └── OSM Routing           ████████░░░░░░░░░░░░░░░░  35%  ◄── HERE
        ├── Code changes      ████████████████████████ 100%
        ├── OSRM setup        ░░░░░░░░░░░░░░░░░░░░░░░░   0%
        ├── Data download     ░░░░░░░░░░░░░░░░░░░░░░░░   0%
        ├── Migration run     ░░░░░░░░░░░░░░░░░░░░░░░░   0%
        └── Re-seed & verify  ░░░░░░░░░░░░░░░░░░░░░░░░   0%
```

### Immediate To-Do

- [ ] Set up `docker-compose.yml` with OSRM service
- [ ] Download Philippines OSM extract
- [ ] Build OSRM routing graph
- [ ] Start OSRM container
- [ ] Install `httpx` (`pip install httpx`)
- [ ] Run Alembic migration
- [ ] Re-seed routes (delete existing + restart or call seed endpoint)
- [ ] Verify routes follow actual roads on the map
- [ ] Add graceful degradation if OSRM is unavailable

---

## 7. Future Phases That Benefit From OSM

| Phase | How OSM Helps |
|---|---|
| **Phase 2 — ETA Prediction** | Real road distances give accurate travel time baselines |
| **Phase 3 — Incident Feed** | OSM road segments enable precise incident location pinning |
| **Phase 5 — Analytics** | Historical OSM data enables speed profile analysis |
| **Phase 6 — Scenario Simulator** | Alternative route recommendation needs road network graph |
| **Phase 7 — Heatmap** | OSM administrative boundaries for municipal-level aggregation |

---

## 8. Deployment Considerations (Phase 9)

- **OSRM on AWS:** Run OSRM on ECS Fargate with EFS volume for the OSM graph
- **Cost:** ~$20–30/month for t3a.medium (2 vCPU, 4 GB RAM) + EFS storage
- **Cold start:** OSRM takes 30–60s to load the routing graph on container start
- **Alternative:** Use a hosted routing API (GraphHopper, Mapbox, Stadia Maps) to avoid self-hosting

---

## 9. Verification Checklist

- [ ] OSRM container is running and responding on port 5000
- [ ] `GET /api/routes` returns waypoints with 100+ coordinate pairs per route (not 5–14)
- [ ] Map displays curved road-following polylines instead of straight lines
- [ ] Route distance_km matches Google Maps / real-world driving distance
- [ ] Bus simulation works with both OSM and fallback waypoints
- [ ] API still works if OSRM is down (fallback paths preserved)
