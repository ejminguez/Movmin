# Smart ETA Prediction Plan

## Phase: Phase 2 (Complete)

Phase 2 is **Smart ETA Prediction** — calculating travel time between terminals by factoring in traffic congestion, simulated weather conditions, and active incidents. This phase builds on Phase 1's simulation engine (which generates live bus positions, speeds, and incidents) and adds a dedicated ETA service, REST endpoint, and frontend UI.

---

## 1. Why Smart ETA?

| Before (Phase 1) | After (Phase 2) |
|---|---|
| No ETA computation — corridor monitor shows only current speed/delay | 4-factor ETA: base time + traffic + weather + incident delays |
| No terminal-to-terminal routing | Origin/destination selector with direct + via-hub routes |
| Bus popups show speed only | Bus tooltips show live ETA to nearest terminal |
| No weather awareness | Simulated weather per route affects travel time |
| No incident-delay awareness | Active incidents automatically inflate ETA |

---

## 2. Architecture

```
┌─────────────┐    GET /api/eta          ┌──────────────────┐
│  Frontend   │◄────────────────────────►│  FastAPI          │
│  ETAPanel   │   ?from_terminal_id=     │  /api/eta.py      │
│  Corridor   │   &to_terminal_id=       │                   │
│  Monitor    │                          │  ┌─────────────┐  │
└──────┬──────┘                          │  │ eta.py      │  │
       │                                 │  │ (service)   │  │
       │ WS bus positions (existing)     │  └──────┬──────┘  │
       │                                 │         │         │
       ▼                                 │  ┌──────▼──────┐  │
┌──────────────┐                         │  │ weather.py  │  │
│  MapLibre GL │                         │  │ (in-memory) │  │
│  (bus popup  │                         │  └─────────────┘  │
│   with ETA)  │                         │                   │
└──────────────┘                         └────────┬──────────┘
                                                   │
                                          ┌────────▼──────────┐
                                          │  PostgreSQL        │
                                          │  routes, buses,    │
                                          │  terminals,        │
                                          │  incidents         │
                                          └───────────────────┘
```

### Components

| Component | File | Role |
|-----------|------|------|
| **ETA Service** | `backend/app/services/eta.py` | Core calculation engine: base time, traffic, weather, incident delays |
| **Weather Service** | `backend/app/services/weather.py` | Simulated weather conditions per route (stochastic, refreshed every 30s) |
| **ETA Schema** | `backend/app/schemas/eta.py` | Pydantic `ETAResponse` with full breakdown |
| **ETA Endpoint** | `backend/app/api/eta.py` | `GET /api/eta?from_terminal_id=&to_terminal_id=` |
| **ETA Panel** | `frontend/src/components/ETAPanel.tsx` | Floating UI: selectors, delay breakdown bars, auto-polling |
| **Bus Tooltip ETA** | `frontend/src/pages/CorridorMonitor.tsx` | Client-side haversine ETA in bus marker popups (dynamic refresh) |

---

## 3. ETA Calculation Logic

```
ETA = Base Travel Time + Traffic Delay + Weather Delay + Incident Delay

  Base Travel Time = (distance_km / avg_route_speed) × 60
                     - distance_km: along route waypoints between terminals
                     - avg_route_speed: mean speed of active buses on that route (default 45 km/h)

  Traffic Delay    = f(avg_route_speed)
                     ≥45 km/h → 0 min
                     30-45 km/h → 5 min
                     <30 km/h → 12 min

  Weather Delay    = from simulated condition per route:
                     Clear 0min | Cloudy 2min | Light Rain 5min | Heavy Rain 12min | Fog 15min | Storm 25min
                     (weighted random: Clear 40%, Cloudy 25%, Light Rain 18%, Heavy Rain 10%, Fog 5%, Storm 2%)

  Incident Delay   = sum(estimated_delay_min) for all active incidents on the route
```

### Edge Cases

| Scenario | Handling |
|----------|----------|
| No buses on route | Default speed 45 km/h; traffic delay 0 |
| Same terminal selected | Origin/destination must differ (frontend validation) |
| Cross-route routing (e.g., Tagum → Digos) | Route via Davao hub terminal: leg1 (Tagum→hub) + leg2 (hub→Digos), weather = worst of both legs |
| Hub terminal (Davao Ecoland, route_id=null) | Treated as shared hub: ETA computed along the non-hub terminal's route |
| Waypoints unavailable | Falls back to haversine (great-circle) distance |
| Weather cache stale (>30s) | Cache cleared; fresh random conditions assigned per route |

---

## 4. Implementation Steps

### 4.1 Backend — Weather Service

| File | Action | Status |
|------|--------|--------|
| `backend/app/services/weather.py` | **New** — In-memory weather cache with weighted random assignment per route, 30s refresh | ✅ Done |

**Design decisions:**
- In-memory (not persisted) — weather is ephemeral simulation data
- Weights favor clear/cloudy (65% combined); storms are rare (2%)
- `_key` field returned for priority comparison in multi-leg routing
- `CONDITION_PRIORITY` list enables deterministic "worst weather" selection

### 4.2 Backend — ETA Service

| File | Action | Status |
|------|--------|--------|
| `backend/app/services/eta.py` | **New** — Core engine with `calculate_eta(from_terminal_id, to_terminal_id, db)` | ✅ Done |
| `backend/app/schemas/eta.py` | **New** — `ETAResponse` schema (11 fields) | ✅ Done |
| `backend/app/api/eta.py` | **New** — `GET /api/eta` with Query params | ✅ Done |
| `backend/app/main.py` | Register ETA router (`app.include_router(eta_router)`) | ✅ Done |

**Key functions in `eta.py`:**

| Function | Purpose |
|----------|---------|
| `_nearest_waypoint_index()` | Find closest waypoint index to a lat/lng coordinate |
| `_route_distance_between()` | Sum haversine distances along waypoints between two coordinates |
| `_get_avg_speed()` | Mean speed of active buses on a route (fallback 45 km/h) |
| `_get_traffic_delay()` | Delay based on avg speed thresholds |
| `_get_incident_delay()` | Sum of `estimated_delay_min` for active incidents |
| `_leg_time()` | Compute full breakdown for a single route segment |
| `calculate_eta()` | Main entry: determines direct or via-hub routing, returns breakdown |

### 4.3 Frontend — ETA Panel

| File | Action | Status |
|------|--------|--------|
| `frontend/src/components/ETAPanel.tsx` | **New** — Floating ETA calculator panel | ✅ Done |
| `frontend/src/pages/CorridorMonitor.tsx` | Modified — Added ETA toggle button, panel overlay, bus popup ETA | ✅ Done |
| `frontend/src/types/index.ts` | Modified — Added `ETAResponse` interface | ✅ Done |

**ETAPanel components:**

| Component | Purpose |
|-----------|---------|
| `ETAPanel` (default) | Main panel: selectors, loading/error states, result display, auto-poll (5s) |
| `DelayRow` | Single delay breakdown row with icon, label, progress bar, value |

**Bus tooltip ETA:**
- Client-side calculation using haversine distance from bus to nearest terminal on its route
- `ETA = (distance_km / speed_kmh) × 60`
- Updated dynamically every WebSocket tick via `popup.setHTML()`
- Shown in popup as: "ETA to {Terminal}: X min"

---

## 5. API Specification

### `GET /api/eta?from_terminal_id={int}&to_terminal_id={int}`

**Response (200):**
```json
{
  "from_terminal": "Davao Ecoland Terminal",
  "to_terminal": "Tagum City Overland Terminal",
  "route_name": "Davao → Tagum",
  "distance_km": 63.5,
  "avg_speed": 42.3,
  "base_time_min": 90.1,
  "traffic_delay_min": 5.0,
  "weather_delay_min": 2.0,
  "weather_condition": "Cloudy",
  "incident_delay_min": 0.0,
  "total_time_min": 97.1
}
```

**Error (404):**
```json
{
  "detail": "Could not calculate ETA for the given terminals. Make sure both terminals exist and are connected."
}
```

---

## 6. Weather Conditions Reference

| Condition | Label | Speed Multiplier | Delay (min) | Weight |
|-----------|-------|-----------------|-------------|--------|
| `clear` | Clear | 1.0 | 0 | 40% |
| `cloudy` | Cloudy | 0.95 | 2 | 25% |
| `light_rain` | Light Rain | 0.85 | 5 | 18% |
| `heavy_rain` | Heavy Rain | 0.70 | 12 | 10% |
| `fog` | Fog | 0.60 | 15 | 5% |
| `storm` | Storm | 0.50 | 25 | 2% |

The `speed_multiplier` field is available for future integration with the simulation engine (to slow buses in bad weather) but is not currently applied — delay is added as a flat minute value.

---

## 7. Terminal Routing Matrix

The 6 terminals form a hub-and-spoke topology centered on Davao Ecoland:

```
                    Tagum
                   /
            Panabo
           /
Davao ---─┤    Digos
  (hub)    \
            \    Mati
             \
              Kidapawan
```

| From | To | Route |
|------|----|-------|
| Davao (hub) | Tagum | Direct (Davao→Tagum) |
| Davao (hub) | Panabo | Direct (Davao→Panabo) |
| Davao (hub) | Digos | Direct (Davao→Digos) |
| Davao (hub) | Mati | Direct (Davao→Mati) |
| Davao (hub) | Kidapawan | Direct (Davao→Kidapawan) |
| Tagum | Panabo | Via Davao hub (2 legs) |
| Tagum | Digos | Via Davao hub (2 legs) |
| ... | ... | Via Davao hub (2 legs) |

**Hub detection:** A terminal with `route_id IS NULL` and `terminal_type = 'terminal'` is treated as the shared hub.

---

## 8. Dynamic Update Behavior

| Trigger | Effect |
|---------|--------|
| WebSocket tick (every 2s) | Bus speeds change → traffic delay updates → ETA recalculated |
| Weather cache refresh (every 30s) | New random conditions → weather delay updates |
| Incident creation/deletion | Incident delay sum updates |
| Frontend poll (every 5s) | ETAPanel re-fetches `/api/eta` → UI updates |
| Bus marker update (every 2s) | Tooltip ETA recalculated client-side with new position/speed |

---

## 9. Testing Matrix

| Test Case | Expected Result |
|-----------|----------------|
| Select Davao → Tagum | Returns ETA with all 4 breakdown fields populated |
| Select Tagum → Davao | Same as above (route distance symmetric) |
| Select same terminal twice | Frontend shows "Origin and destination must differ" |
| Select cross-route (Tagum → Digos) | Returns combined ETA via Davao hub, "worst" weather |
| All buses on route stopped (speed=0) | Falls back to 45 km/h default speed |
| Active incident on route | `incident_delay_min` matches incident's `estimated_delay_min` |
| Weather just refreshed | Different condition may appear on re-fetch |
| Terminal IDs that don't exist | Returns 404 |
| Bus tooltip hover | Shows ETA to nearest terminal with current speed |

---

## 10. Verification Checklist

- [ ] `GET /api/eta?from_terminal_id=1&to_terminal_id=2` returns valid ETA with 4 delay fields
- [ ] Traffic delay increases when buses on that route slow down
- [ ] Weather delay changes over time (stochastic)
- [ ] Incident delay reflects active incidents on the route
- [ ] Frontend ETA panel opens/closes via button toggle
- [ ] Origin/destination dropdowns list all terminals
- [ ] Delay breakdown bars render with proportional widths
- [ ] ETA auto-updates every 5 seconds
- [ ] Bus marker popup shows "ETA to {Terminal}: X min"
- [ ] Cross-route ETA correctly routes via Davao hub
- [ ] 404 error handled gracefully in UI
- [ ] Docker Compose builds and runs all 3 services

---

## 11. Future Enhancements

| Enhancement | Priority | Notes |
|-------------|----------|-------|
| Integrate `speed_multiplier` from weather into simulation engine | Medium | Slow buses in rain/storm for more realistic ETA impact |
| Machine learning ETA | Low | Train model on historical simulation data |
| Real weather API integration | Low | Replace simulated weather with PAGASA/OpenWeatherMap API |
| Per-bus ETA endpoint | Low | `GET /api/eta/bus/{id}?to_terminal_id=` for precise bus-level ETA |
| ETA confidence interval | Low | Show range (e.g., "45-55 min") based on speed variance |
| Multiple intermediate stops | Low | Support multi-point routing (e.g., Davao → Panabo → Tagum) |
