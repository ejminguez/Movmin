# Movmin

AI-powered mobility platform that monitors traffic conditions in real time, predicts congestion, and provides actionable insights for smarter transportation management. It helps cities optimize traffic flow, improve public transport efficiency, and support data-driven mobility decisions.

---

## OpenStreetMap (OSM) Routing Engine Setup

Movmin uses OSRM (OpenSource Routing Machine) to compute real-world, road-following geometries for bus route networks.

### 1. Preprocess the OSM Graph
1. Ensure **Docker Desktop** is running.
2. Download the Philippines OSM extract (~200MB PBF, expands to ~570MB):
   ```bash
   mkdir -p backend/osrm_data
   curl -L -o backend/osrm_data/philippines-latest.osm.pbf https://download.geofabrik.de/asia/philippines-latest.osm.pbf
   ```
3. Extract the road network graph:
   ```bash
   docker run --rm -t -v "$(pwd)/backend/osrm_data:/data" osrm/osrm-backend osrm-extract -p /opt/car.lua /data/philippines-latest.osm.pbf
   ```
4. Build contraction hierarchies:
   ```bash
   docker run --rm -t -v "$(pwd)/backend/osrm_data:/data" osrm/osrm-backend osrm-contract /data/philippines-latest.osrm
   ```

### 2. Start OSRM Server
Start the OSRM routed server in the background:
```bash
docker-compose up -d
```
The OSRM service is mapped to port `5005` (to avoid conflicting with macOS Control Center on port `5000`).

### 3. Seed Database with OSRM Routes
Wipe old straight-line waypoints and query OSRM for the exact highway coordinates for all corridors:
```bash
cd backend
# Apply schema changes (if not already applied)
.venv/bin/alembic upgrade head

# Run reseed utility
PYTHONPATH=. .venv/bin/python app/simulation/reseed.py
```
