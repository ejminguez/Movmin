# Route Analytics Dashboard Plan

## Phase: Phase 5 (Planned)

Phase 5 is the **Route Analytics Dashboard** — a historical analytics layer that snapshots corridor metrics into the `analytics` table at regular intervals and surfaces them through visual charts on a dedicated frontend page. This phase builds on Phase 1 (corridor monitor — live source of per-route metrics) and Phase 2 (ETA — delay breakdown awareness) to provide trend analysis, on-time performance tracking, and utilization history.

---

## 1. Why Route Analytics?

| Before (Phase 1 — Real-Time Only) | After (Phase 5 — Historical + Charts) |
|---|---|
| Corridor status shows only current snapshot | Time-series charts show trends over the last N minutes |
| No data persistence — metrics vanish on refresh | `analytics` table records periodic snapshots |
| No on-time performance tracking | OTP % calculated and tracked per route |
| No utilization history | Capacity utilization trends visible over time |
| Two separate placeholder pages (`/route-analytics`, `/analytics`) | Single consolidated dashboard at `/route-analytics` |

---

## 2. Architecture

```
                        ┌──────────────────────────────────┐
                        │   Simulation Engine               │
                        │   (2s tick, bus positions)        │
                        └──────────┬───────────────────────┘
                                   │ tick (every 30s)
                                   ▼
┌──────────────────────┐   ┌──────────────────────────┐
│  Frontend            │   │  FastAPI — Snapshot Task   │
│  RouteAnalyticsPage  │   │  services/analytics.py     │
│                      │   │  - read bus/incident data  │
│  ┌────────────────┐  │   │  - compute metrics per     │
│  │ TimeSeriesChart│  │   │    route                   │
│  │ (Recharts)     │  │   │  - INSERT INTO analytics   │
│  └────────────────┘  │   └──────────┬─────────────────┘
│  ┌────────────────┐  │              │
│  │ OTP Gauge      │  │              ▼
│  └────────────────┘  │   ┌──────────────────────────┐
│  ┌────────────────┐  │   │  FastAPI — Query Endpoints│
│  │ Delay Breakdown│  │   │  /api/analytics/*          │
│  └────────────────┘  │   │  - get recent by route    │
│                      │   │  - aggregate (avg, max)   │
│  ┌────────────────┐  │   └──────────┬─────────────────┘
│  │ Utilization    │  │              │
│  │ Trend          │  │              ▼
│  └────────────────┘  │   ┌──────────────────────────┐
│                      │   │  PostgreSQL                │
│  ◄── auto-poll 10s ──┤   │  analytics table           │
│                      │   │  forecasts table           │
└──────────────────────┘   └──────────────────────────┘
```

### Components

| Component | File | Role |
|-----------|------|------|
| **Analytics Service** | `backend/app/services/analytics.py` | Periodic snapshot: computes per-route metrics and writes to `analytics` table |
| **Analytics Schema** | `backend/app/schemas/analytics.py` | Pydantic models for request/response |
| **Analytics Endpoints** | `backend/app/api/analytics.py` | `GET /api/analytics/routes/{id}` and aggregation endpoints |
| **Analytics Snapshot Task** | `backend/app/services/analytics.py` (background) | Runs every 30s via FastAPI lifespan, captures corridor state |
| **Route Analytics Page** | `frontend/src/pages/RouteAnalyticsPage.tsx` | Full dashboard with charts, replaces `RoutesPage` stub |
| **Analytics Types** | `frontend/src/types/index.ts` | `AnalyticSnapshot`, `RouteAnalytics` interfaces |

---

## 3. Implementation Steps

### 3.1 Backend — Analytics Service

| File | Action | Status |
|------|--------|--------|
| `backend/app/services/analytics.py` | **New** — Snapshot service + background task | ⬜ Pending |
| `backend/app/schemas/analytics.py` | **New** — `AnalyticSnapshotResponse`, `RouteAnalyticsSummary` | ⬜ Pending |
| `backend/app/api/analytics.py` | **New** — REST endpoints for analytics data | ⬜ Pending |
| `backend/app/main.py` | Register analytics router, start background snapshot task | ⬜ Pending |

**Key functions in `services/analytics.py`:**

| Function | Purpose |
|----------|---------|
| `take_snapshot(db)` | Compute per-route metrics (travel time, delay, OTP, utilization, bus count) and INSERT a row per route into `analytics` |
| `start_snapshot_scheduler(app)` | Launch background asyncio task that calls `take_snapshot` every 30s |
| `get_route_history(db, route_id, minutes)` | Query recent `analytics` rows for a route (default last 60 min) |
| `get_route_summary(db, route_id)` | Aggregate metrics: avg delay, avg OTP, avg utilization over available window |

**Snapshot computation logic (inside `take_snapshot`):**

```
For each route:
  1. Query active buses on route
  2. avg_speed = mean speed of active buses (or 0 if none)
  3. avg_travel_time_min = route.distance_km / max(avg_speed, 1) * 60
  4. avg_delay_min = sum of estimated_delay_min from active incidents on route
  5. on_time_performance:
     - If avg_delay_min == 0 → 100%
     - If avg_delay_min <= 5 → 90%
     - If avg_delay_min <= 15 → 70%
     - Else → 40%
  6. utilization = mean occupancy / capacity across active buses * 100
  7. active_bus_count = number of active buses on route

INSERT INTO analytics (route_id, avg_travel_time_min, avg_delay_min, on_time_performance, utilization, active_bus_count)
```

### 3.2 Backend — Analytics Schemas

```python
class AnalyticSnapshotResponse(BaseModel):
    id: int
    route_id: int
    route_name: str
    color: str
    timestamp: datetime
    avg_travel_time_min: float | None
    avg_delay_min: float | None
    on_time_performance: float | None
    utilization: float | None
    active_bus_count: int

class RouteAnalyticsSummary(BaseModel):
    route_id: int
    route_name: str
    color: str
    current_utilization: float
    avg_utilization: float
    current_delay_min: float
    avg_delay_min: float
    current_otp: float
    avg_otp: float
    snapshot_count: int
```

### 3.3 Backend — Analytics API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/analytics/routes/{route_id}` | Recent snapshots for a route (query param `minutes=60`) |
| GET | `/api/analytics/routes/{route_id}/summary` | Aggregated summary for a route |
| GET | `/api/analytics/routes` | Latest snapshot for all routes |

**`GET /api/analytics/routes/{route_id}?minutes=60`**

Response (200):
```json
{
  "route_id": 1,
  "route_name": "Davao → Tagum",
  "color": "#eab308",
  "snapshots": [
    {
      "id": 42,
      "timestamp": "2026-06-25T10:30:00Z",
      "avg_travel_time_min": 90.1,
      "avg_delay_min": 5.0,
      "on_time_performance": 70.0,
      "utilization": 65.2,
      "active_bus_count": 8
    }
  ]
}
```

**`GET /api/analytics/routes/{route_id}/summary`**

Response (200):
```json
{
  "route_id": 1,
  "route_name": "Davao → Tagum",
  "color": "#eab308",
  "current_utilization": 65.2,
  "avg_utilization": 58.7,
  "current_delay_min": 5.0,
  "avg_delay_min": 3.2,
  "current_otp": 70.0,
  "avg_otp": 82.5,
  "snapshot_count": 120
}
```

**`GET /api/analytics/routes`**

Response (200):
```json
[
  {
    "route_id": 1,
    "route_name": "Davao → Tagum",
    "color": "#eab308",
    "timestamp": "2026-06-25T10:30:00Z",
    "avg_travel_time_min": 90.1,
    "avg_delay_min": 5.0,
    "on_time_performance": 70.0,
    "utilization": 65.2,
    "active_bus_count": 8
  }
]
```

### 3.4 Backend — main.py Integration

1. Import analytics router: `from app.api.analytics import router as analytics_router`
2. Register: `app.include_router(analytics_router, prefix="/api")`
3. In the lifespan function, after starting the simulation engine, call `start_snapshot_scheduler(app)` to begin the periodic 30s snapshot task

### 3.5 Frontend — Route Analytics Dashboard Page

| File | Action | Status |
|------|--------|--------|
| `frontend/src/pages/RouteAnalyticsPage.tsx` | **New** — Full analytics dashboard with Recharts | ⬜ Pending |
| `frontend/src/pages/RoutesPage.tsx` | **Remove/rename** — Replaced by RouteAnalyticsPage | ⬜ Pending |
| `frontend/src/pages/AnalyticsPage.tsx` | **Keep as-is or redirect** — Stub remains for future AI insights | ⬜ Pending |
| `frontend/src/types/index.ts` | **Modified** — Add `AnalyticSnapshot`, `RouteAnalyticsSummary` | ⬜ Pending |
| `frontend/src/router.tsx` | Update to point `/route-analytics` to new page | ⬜ Pending |

**RouteAnalyticsPage components:**

| Component | Purpose |
|-----------|---------|
| `RouteAnalyticsPage` (default) | Main dashboard: route selector tabs, grid of chart panels |
| `TimeSeriesChart` (inline) | Recharts `LineChart` showing travel time / delay / OTP over time |
| `UtilizationChart` (inline) | Recharts `BarChart` showing utilization per route |
| `SummaryCards` (inline) | KPI cards: current OTP, avg delay, utilization, bus count |

**Dashboard layout (wireframe):**

```
┌─────────────────────────────────────────────┐
│  Route Analytics Dashboard                    │
│  [Davao→Tagum] [Davao→Panabo] [Davao→Digos] │  ← route tabs
├─────────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │
│  │ OTP  │ │Delay │ │Util  │ │Buses │       │  ← KPI cards
│  │ 82%  │ │3.2m  │ │58.7% │ │  8   │       │
│  └──────┘ └──────┘ └──────┘ └──────┘       │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────┐│
│  │  Travel Time (min)           ┌─────┐    ││
│  │  ╱‾‾‾╲     ╱‾‾╲             │Legend│    ││  ← Line chart
│  │ ╱     ╲___╱    ╲___         └─────┘    ││
│  │                                         ││
│  └─────────────────────────────────────────┘│
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────┐│
│  │  Delay Breakdown (min)                  ││
│  │  ████▌    ███    █████    ██            ││  ← Area/line chart
│  │  ███████  █████  ███████  █████         ││
│  └─────────────────────────────────────────┘│
├─────────────────────────────────────────────┤
│  ┌──────────────────────┐ ┌────────────────┐│
│  │  On-Time Performance │ │  Utilization   ││
│  │  ┌────┐              │ │  ████████ 65%  ││  ← Bar + gauge
│  │  │ 82%│              │ │  ██████   52%  ││
│  │  └────┘              │ │  █████████ 78% ││
│  └──────────────────────┘ └────────────────┘│
└─────────────────────────────────────────────┘
```

### 3.6 Frontend — Auto-Polling

- The dashboard auto-polls `/api/analytics/routes/{selectedRouteId}?minutes=60` every 10s
- The summary cards call `/api/analytics/routes/{selectedRouteId}/summary` every 30s (less frequent)
- Switching route tabs immediately refetches data for the selected route
- Loading state: skeleton placeholders while data loads
- Error state: toast/alert with retry button
- Empty state: "No analytics data yet — snapshots are collected every 30s" message

### 3.7 Frontend — Types

```typescript
export interface AnalyticSnapshot {
  id: number;
  route_id: number;
  route_name: string;
  color: string;
  timestamp: string;
  avg_travel_time_min: number | null;
  avg_delay_min: number | null;
  on_time_performance: number | null;
  utilization: number | null;
  active_bus_count: number;
}

export interface RouteAnalyticsSummary {
  route_id: number;
  route_name: string;
  color: string;
  current_utilization: number;
  avg_utilization: number;
  current_delay_min: number;
  avg_delay_min: number;
  current_otp: number;
  avg_otp: number;
  snapshot_count: number;
}

export interface RouteSnapshotResponse {
  route_id: number;
  route_name: string;
  color: string;
  snapshots: AnalyticSnapshot[];
}
```

---

## 4. Snapshot Cadence

| Parameter | Value |
|-----------|-------|
| Snapshot interval | Every 30s |
| Data retention | In-memory query window (last 60 min = ~120 snapshots per route) |
| Cleanup strategy | None for MVP — DB rows accumulate; future: TTL cleanup job |
| DB write model | 1 INSERT per route per tick (5 routes × 1 row = 5 rows / 30s = 600 rows / hour) |

### Edge Cases

| Scenario | Handling |
|----------|----------|
| No buses on route | `avg_travel_time_min` = route.distance / default 45 km/h; `utilization` = 0; `active_bus_count` = 0 |
| All buses delayed | `avg_delay_min` reflects incident sum; OTP drops accordingly |
| Route has no incidents | `avg_delay_min` = 0; OTP = 100% (unless buses are slow — traffic delay not factored into OTP in MVP) |
| Snapshot task fails (DB down) | Logged error; next tick retries automatically |
| No snapshots yet (fresh start) | Frontend shows empty state with hint about 30s collection cycle |

---

## 5. Dynamic Update Behavior

| Trigger | Effect |
|---------|--------|
| Snapshot tick (every 30s) | New rows inserted into `analytics` table |
| Frontend poll (every 10s) | Re-fetches snapshot history → charts update |
| Route tab switch | Immediate fetch for new route's snapshots |
| Simulation speed change | Faster/slower snapshot collection rates reflected in chart density |

---

## 6. Testing Matrix

| Test Case | Expected Result |
|-----------|----------------|
| Wait 30s after app start | `analytics` table has at least 5 rows (one per route) |
| `GET /api/analytics/routes/1?minutes=60` | Returns array of snapshots, sorted by timestamp desc |
| `GET /api/analytics/routes/1/summary` | Returns aggregated metrics with snapshot_count > 0 |
| `GET /api/analytics/routes` | Returns latest snapshot for all 5 routes |
| Load analytics page with no data | Empty state with informational message |
| Switch between route tabs | Charts reload with correct route data |
| Verify chart renders time on X-axis | Line chart shows continuous time series |
| Verify OTP changes with incidents | Adding incident → OTP drops in next snapshot |
| Verify utilization changes | Changing bus occupancy → utilization shifts |

---

## 7. Verification Checklist

- [ ] Background snapshot task writes to `analytics` table every 30s for all 5 routes
- [ ] `GET /api/analytics/routes/{id}` returns paginated/limited snapshot history
- [ ] `GET /api/analytics/routes/{id}/summary` returns aggregated KPIs
- [ ] `GET /api/analytics/routes` returns latest snapshot for all routes
- [ ] Analytics router registered in `main.py` and not conflicting with existing routes
- [ ] RouteAnalyticsPage renders 4 KPI cards with live data
- [ ] Time-series line chart displays travel time, delay, or OTP over last 60 min
- [ ] Utilization bar chart renders correctly
- [ ] Route tabs switch data correctly
- [ ] Auto-polling updates charts every 10s without flicker
- [ ] Loading skeletons show during initial data fetch
- [ ] Empty state shown when no snapshots exist yet
- [ ] `/route-analytics` URL renders the new dashboard (not the stub)
- [ ] No regressions on existing Corridor Monitor, ETA, or incident features
- [ ] Docker Compose builds and runs without errors

---

## 8. Future Enhancements

| Enhancement | Priority | Notes |
|-------------|----------|-------|
| Date-range picker | Medium | Let users select custom time windows |
| Export to CSV | Low | Download snapshot data |
| Comparison overlay | Low | Overlay two routes' delay trends on same chart |
| AI insights integration | Low | Feed analytics data to Bedrock for natural-language summaries |
| Forecast overlay | Low | Plot `forecasts.predicted_demand` alongside actual utilization |
| Real-time alerts | Low | Trigger alert when OTP drops below threshold |
| Historical cleanup (TTL) | Low | Delete rows older than N hours to manage table size |
