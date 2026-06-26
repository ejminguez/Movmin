#!/usr/bin/env bash
set -euo pipefail

OSRM_DATA_DIR="${OSRM_DATA_DIR:-./backend/osrm_data}"
OSM_EXTRACT_URL="${OSM_EXTRACT_URL:-https://download.geofabrik.de/asia/philippines-latest.osm.pbf}"
PBF_FILE="${OSRM_DATA_DIR}/philippines-latest.osm.pbf"
OSRM_FILE="${OSRM_DATA_DIR}/philippines-latest.osrm"
OSRM_IMAGE="osrm/osrm-backend"

echo "=== OSRM Setup Script ==="
echo "Data directory: $(cd "$(dirname "$0")/.." && realpath "${OSRM_DATA_DIR}")"
echo ""

# Step 0: Create data directory
mkdir -p "${OSRM_DATA_DIR}"

# Step 1: Download OSM data
if [ -f "${PBF_FILE}" ]; then
  echo "[1/4] OSM extract already exists at ${PBF_FILE}, skipping download."
else
  echo "[1/4] Downloading Philippines OSM extract..."
  echo "       URL: ${OSM_EXTRACT_URL}"
  curl -L -o "${PBF_FILE}" "${OSM_EXTRACT_URL}"
  echo "       Done. ($(du -h "${PBF_FILE}" | cut -f1))"
fi

# Step 2: Extract road network
if [ -f "${OSRM_FILE}" ]; then
  echo "[2/4] OSRM graph already exists at ${OSRM_FILE}, skipping extract."
else
  echo "[2/4] Extracting road network (osrm-extract)..."
  docker run --rm -t \
    -v "$(realpath "${OSRM_DATA_DIR}"):/data" \
    "${OSRM_IMAGE}" \
    osrm-extract -p /opt/car.lua "/data/$(basename "${PBF_FILE}")"
  echo "       Done."
fi

# Step 3: Build Contraction Hierarchies
HSGR_FILE="${OSRM_DATA_DIR}/philippines-latest.osrm.hsgr"
if [ -f "${HSGR_FILE}" ]; then
  echo "[3/4] Contraction hierarchies already exist, skipping contract."
else
  echo "[3/4] Building contraction hierarchies (osrm-contract)..."
  docker run --rm -t \
    -v "$(realpath "${OSRM_DATA_DIR}"):/data" \
    "${OSRM_IMAGE}" \
    osrm-contract "/data/$(basename "${OSRM_FILE}")"
  echo "       Done."
fi

# Step 4: Verify the container starts
echo "[4/4] Verifying OSRM container starts..."
CONTAINER_NAME="osrm-setup-test"
docker rm -f "${CONTAINER_NAME}" 2>/dev/null || true

docker run --rm -d --name "${CONTAINER_NAME}" \
  -p 5005:5000 \
  -v "$(realpath "${OSRM_DATA_DIR}"):/data" \
  "${OSRM_IMAGE}" \
  osrm-routed --algorithm ch "/data/$(basename "${OSRM_FILE}")"

echo "       Waiting for OSRM to warm up (5s)..."
sleep 5

echo "       Testing route query..."
RESPONSE=$(curl -s "http://localhost:5005/route/v1/driving/121.0,14.5;121.1,14.6?overview=false" 2>/dev/null || echo "")

if echo "${RESPONSE}" | grep -q '"code":"Ok"'; then
  echo "       OSRM is working! Response: ${RESPONSE}"
  echo ""
  echo "=== OSRM setup complete ==="
else
  echo "       WARNING: Route query did not return Ok."
  echo "       Response: ${RESPONSE}"
  echo "       Check logs: docker logs ${CONTAINER_NAME}"
fi

docker rm -f "${CONTAINER_NAME}" 2>/dev/null || true
echo ""
echo "Next steps:"
echo "  1. Start the full stack:  docker compose up -d"
echo "  2. Reseed routes:         cd backend && python -m app.simulation.reseed"
