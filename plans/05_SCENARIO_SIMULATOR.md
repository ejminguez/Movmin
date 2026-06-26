# Phase 6 — What-If Scenario Simulator

Estimated Time: 4 hrs | Dependencies:** Phases 1–3 complete (routes, buses, incidents, ETA)

---

## 1. Overview

Allow transport planners to simulate disruptions (route closure, demand surge, severe weather) and see the projected impact on travel times, congestion, occupancy, and fleet status. The simulator outputs quantitative deltas plus AI-generated mitigation recommendations.

**Demo relevance (demo step 5–6):** The presenter clicks a preset scenario button, the map animates the disruption, before/after KPIs update, and an insight card displays a recommendation.

---

## 2. AI Architecture — Bedrock Alternative

**Decision: Template-based insight engine with pluggable AI provider interface.**

Instead of Amazon Bedrock (which requires AWS SDK, IAM roles, and model access approvals), use a **zero-dependency template engine** that generates insights from scenario parameters. This works out of the box, has no cold start, and is fully deterministic for demos.

### How it works

```
Scenario params (route_id, closure, demand %, etc.)
  → ScenarioEngine computes impact deltas
  → InsightGenerator selects pre-written template by scenario type
  → Fills in {{placeholders}} with computed values
  → Returns { text, confidence, recommendation }
```

### Pluggable provider

A thin `InsightProvider` ABC allows swapping in OpenAI, Gemini, or any OpenAI-compatible API with one env var:

```python
class InsightProvider(ABC):
    @abstractmethod
    async def generate(self, prompt: str) -> str: ...

class TemplateInsightProvider(InsightProvider):
    """Built-in template engine — no dependencies, always works."""

class OpenAIInsightProvider(InsightProvider):
    """Drop-in OpenAI-compatible provider (works with OpenAI / Gemini / Ollama)."""
```

Set `AI_PROVIDER=template` (default) or `AI_PROVIDER=openai` + `OPENAI_API_KEY` to switch. No AWS-specific setup needed.

---

## 3. Backend Implementation

### 3.1 New files

| File | Purpose |
|------|---------|
| `backend/app/schemas/scenarios.py` | Pydantic request/response schemas |
| `backend/app/api/scenarios.py` | `POST /api/scenarios/simulate`, `GET /api/scenarios/presets` |
| `backend/app/services/scenario.py` | Core scenario engine — impact calculations |
| `backend/app/services/insights.py` | Insight provider interface + template engine |

### 3.2 Scenario Types & Impact Calculations

**Type A: Route Closure**
- Input: `route_id`, `duration_minutes`
- Calculation:
  1. Set route status → `CLOSED`
  2. Re-route buses to alternative routes (round-robin to remaining 4 routes)
  3. Compute delta: `new_avg_delay = base + 15` (fixed closure overhead per leg)
  4. Compute congestion: remaining routes absorb `(closed_route_buses / total_buses)` more traffic → speed drop ~15–25%
  5. Compute occupancy: displaced passengers evenly split → +5–10% per remaining route
- Output: `{ travel_time_delta, congestion_delta, occupancy_delta, affected_stops, alternative_route }`

**Type B: Demand Surge**
- Input: `route_id`, `demand_increase_pct` (range: +10% to +100%)
- Calculation:
  1. New occupancy = `current * (1 + demand_increase_pct / 100)`
  2. If occupancy exceeds capacity → status = `OVERLOADED`
  3. Compute delay: every 10% overcapacity adds 2 min delay
- Output: `{ occupancy_delta, capacity_status, additional_buses_needed }`

**Type C: Severe Weather**
- Input: `route_id`, `weather_condition` (one of heavy_rain/storm/fog)
- Calculation:
  1. Override `get_weather_for_route()` return for this route
  2. Use existing weather delay multipliers from `services/weather.py`
- Output: `{ weather_delay, speed_drop_pct, recommendation }`

**Type D: Combined (preset scenarios)**
- Pre-canned combinations that produce dramatic demo effects:
  - "Marilog Landslide Closure" → Type A on Davao–Bukidnon corridor
  - "Kadayawan Festival Surge" → Type B +50% on all routes
  - "Typhoon Mindanao" → Type C storm all routes + Type A one route

### 3.3 API Endpoints

```
POST /api/scenarios/simulate
  Body: {
    type: "route_closure" | "demand_surge" | "severe_weather" | "combined",
    route_id?: int,
    parameters: {
      duration_minutes?: int,
      demand_increase_pct?: number,
      weather_condition?: string,
      route_ids?: int[]   // for combined
    }
  }
  Response: {
    scenario_id: str,
    type: str,
    timestamp: str,
    impact: {
      travel_time_delta_min: number,     // +/- delta vs baseline
      travel_time_delta_pct: number,
      congestion_delta_pct: number,
      occupancy_delta_pct: number,
      affected_buses: number,
      affected_passengers: number,
      alternative_route?: string,
    },
    before_snapshot: { /* current state */ },
    after_snapshot: { /* projected state */ },
    insight: {
      text: string,                       // "Deploy 2 additional buses..."
      type: "recommendation" | "alert" | "info",
      confidence: "high" | "medium" | "low",
      suggested_actions: string[]
    }
  }

GET /api/scenarios/presets
  Response: {
    presets: [
      {
        id: "marilog_landslide",
        name: "Marilog Landslide Closure",
        description: "Simulate a landslide closing the Davao–Bukidnon corridor",
        type: "combined",
        parameters: { ... }
      },
      {
        id: "kadayawan_surge",
        name: "Kadayawan Festival Demand Surge",
        description: "+50% passenger demand across all Davao routes",
        type: "combined",
        parameters: { ... }
      },
      {
        id: "typhoon",
        name: "Typhoon Mindanao",
        description: "Severe weather + road closures across the region",
        type: "combined",
        parameters: { ... }
      }
    ]
  }

POST /api/scenarios/apply
  Body: { scenario_id: str, duration_seconds: int }
  Description: Actually applies scenario changes to the live simulation
               for a given duration (for demo flow — buses react on map)
  Response: { applied: true, expires_at: str }

POST /api/scenarios/reset
  Description: Clears all scenario overrides, restores normal simulation
  Response: { status: "ok" }
```

### 3.4 ETA service changes

A new `ScenarioOverlay` context is added to `services/eta.py`:

```python
# Thread-local or in-memory store
_scenario_overrides: dict = {}  # route_id -> override dict

def set_scenario_override(route_id: int, overrides: dict):
    _scenario_overrides[route_id] = overrides

def clear_scenario_overrides():
    _scenario_overrides.clear()

def get_scenario_override(route_id: int) -> dict | None:
    return _scenario_overrides.get(route_id)
```

The ETA `_leg_time()` function checks `get_scenario_override(route_id)` and applies overrides to speed multiplier, weather, and occupancy.

### 3.5 Scenario Engine (services/scenario.py)

```python
class ScenarioEngine:
    def simulate_route_closure(
        route_id: int, db: Session
    ) -> ScenarioResult: ...

    def simulate_demand_surge(
        route_id: int, increase_pct: float, db: Session
    ) -> ScenarioResult: ...

    def simulate_weather_event(
        route_id: int, condition: str, db: Session
    ) -> ScenarioResult: ...

    def simulate_combined(
        params: CombinedParams, db: Session
    ) -> ScenarioResult: ...

    def apply_scenario(
        result: ScenarioResult, duration_seconds: int, db: Session
    ): ...  # Writes overrides to in-memory store + caps incidents

    def reset_all(): ...  # Clears overrides
```

### 3.6 Insight Templates (services/insights.py)

```python
class TemplateInsightProvider(InsightProvider):
    INSIGHTS = {
        "route_closure": {
            "high": "...consider deploying {additional_buses} buses...",
            "medium": "...expected delays of {delay_min} minutes...",
            "low": "...minimal impact expected..."
        },
        "demand_surge": {
            "high": "Demand exceeds capacity by {pct_over}%. Deploy {buses_needed} additional buses...",
            "medium": "...consider adding {buses_needed} bus...",
            "low": "...current fleet can handle..."
        },
        "severe_weather": "Speed reduction of {speed_drop}% expected. Advise drivers to exercise caution.",
        "combined": "Multiple disruptions detected. {primary_impact}. Recommended action: {action}."
    }
```

### 3.7 DB changes

Add a lightweight `scenario_logs` table for audit trail during demo:

```python
class ScenarioLog(Base):
    __tablename__ = "scenario_logs"
    id = Column(Integer, primary_key=True)
    scenario_type = Column(String(50))
    parameters = Column(JSON)
    impact_summary = Column(JSON)
    insight_text = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
```

---

## 4. Frontend Implementation

### 4.1 New/Modified files

| File | Status | Purpose |
|------|--------|---------|
| `frontend/src/pages/ScenarioPage.tsx` | **New** | Dedicated scenario simulator page |
| `frontend/src/components/panels/ScenarioPanel.tsx` | **New** | Scenario configuration + results panel |
| `frontend/src/components/panels/ScenarioPresets.tsx` | **New** | Preset scenario buttons for demo flow |
| `frontend/src/types/index.ts` | **Modify** | Add scenario types |
| `frontend/src/lib/api.ts` | **Modify** | Add scenario API methods |
| `frontend/src/router.tsx` | **Modify** | Add `/scenarios` route |
| `frontend/src/components/layout/Sidebar.tsx` | **Modify** | Add nav link |

### 4.2 TypeScript types (add to `types/index.ts`)

```typescript
export interface ScenarioPreset {
  id: string;
  name: string;
  description: string;
  type: "route_closure" | "demand_surge" | "severe_weather" | "combined";
  parameters: Record<string, unknown>;
}

export interface ScenarioImpact {
  travel_time_delta_min: number;
  travel_time_delta_pct: number;
  congestion_delta_pct: number;
  occupancy_delta_pct: number;
  affected_buses: number;
  affected_passengers: number;
  alternative_route?: string;
}

export interface ScenarioInsight {
  text: string;
  type: "recommendation" | "alert" | "info";
  confidence: "high" | "medium" | "low";
  suggested_actions: string[];
}

export interface ScenarioResult {
  scenario_id: string;
  type: string;
  timestamp: string;
  impact: ScenarioImpact;
  before_snapshot: Record<string, unknown>;
  after_snapshot: Record<string, unknown>;
  insight: ScenarioInsight;
}

export interface ScenarioSimulateRequest {
  type: "route_closure" | "demand_surge" | "severe_weather" | "combined";
  route_id?: number;
  parameters: {
    duration_minutes?: number;
    demand_increase_pct?: number;
    weather_condition?: string;
    route_ids?: number[];
  };
}
```

### 4.3 Scenario Panel UI

**Layout (250px slide-in panel from right side, matches existing panel style):**

```
┌──────────────────────────┐
│ Scenario Simulator   [X] │
│                          │
│ ┌─ Preset Scenarios ──┐  │
│ │ Marilog Landslide   │  │
│ │ Kadayawan Surge     │  │
│ │ Typhoon Mindanao    │  │
│ └─────────────────────┘  │
│                          │
│ ── Custom Scenario ──    │
│                          │
│ Type: [Route Closure v]  │
│ Route: [Davao→Tagum  v]  │
│ Duration: [15] min       │
│                          │
│ [▶ Run Simulation]       │
│                          │
│ ── Impact Analysis ──    │
│ Travel Time: +25 min     │
│ Congestion:  +18%        │
│ Occupancy:   +12%        │
│ Affected:   10 buses     │
│                          │
│ ┌─ AI Insight ─────────┐ │
│ │ ⚠ Deploy 2 additional│ │
│ │ buses on the Davao→  │ │
│ │ Tagum route...        │ │
│ └──────────────────────┘ │
│                          │
│ [Apply to Map]  [Reset]  │
└──────────────────────────┘
```

**States to handle:**
- **Idle:** Preset buttons prominent, custom form collapsed
- **Loading:** Skeleton placeholders on impact cards, insight shimmer
- **Results:** Impact cards animate in (numbered counters), insight fades in
- **Applied:** "Scenario Active" banner, countdown timer showing remaining seconds
- **Error:** Toast notification + form re-enable

### 4.4 Map integration

When a scenario is **applied** to the live simulation:
- Affected route polyline flashes red/dashed
- Bus markers on the route show warning icon overlays
- Affected terminal marker pulses
- After duration expires, map returns to normal state

### 4.5 API client additions (lib/api.ts)

```typescript
export const api = {
  // ... existing methods ...

  simulateScenario: (body: ScenarioSimulateRequest) =>
    api.post<ScenarioResult>("/api/scenarios/simulate", body),

  getScenarioPresets: () =>
    api.get<{ presets: ScenarioPreset[] }>("/api/scenarios/presets"),

  applyScenario: (scenarioId: string, durationSeconds: number) =>
    api.post<{ applied: boolean; expires_at: string }>("/api/scenarios/apply", {
      scenario_id: scenarioId,
      duration_seconds: durationSeconds,
    }),

  resetScenario: () =>
    api.post<{ status: string }>("/api/scenarios/reset"),
};
```

### 4.6 Route changes

Add to `router.tsx`:
```typescript
{ path: "scenarios", element: <ScenarioPage /> },
```

Sidebar gets a new nav item between "Route Analytics" and "Incidents":
```tsx
{ label: "Scenario Simulator", path: "/scenarios", icon: FlaskConical }
```

---

## 5. Integration with Existing Simulation

The key architectural decision is **non-destructive simulation**:

1. `POST /api/scenarios/simulate` is purely computational — reads current state, computes deltas, returns results. **Does not change anything.**
2. `POST /api/scenarios/apply` writes overrides to an in-memory dict (`_scenario_overrides`) that the simulation engine's `_tick()` method checks on each iteration.
3. `POST /api/scenarios/reset` clears the dict.
4. Overrides auto-expire after the specified duration.

Changes to `simulation/engine.py`:
- In `_tick()`, after loading incidents, check `_scenario_overrides` for this bus's route_id
- If overrides exist, apply speed multipliers and status modifications
- Broadcast a `scenario_active` flag in WebSocket data so frontend can render map effects

Changes to `services/eta.py`:
- `_get_avg_speed()`, `_get_traffic_delay()`, and `_leg_time()` check scenario overrides
- Route closure sets speed to 0 for affected buses

---

## 6. Implementation Order

| Step | Task | Est. |
|------|------|------|
| 6.1 | Create `schemas/scenarios.py` — Pydantic models | 15 min |
| 6.2 | Create `services/insights.py` — Template insight provider + ABC | 30 min |
| 6.3 | Create `services/scenario.py` — Scenario impact engine | 60 min |
| 6.4 | Add `scenario_logs` model + migration | 15 min |
| 6.5 | Modify `services/eta.py` — scenario overlay hooks | 15 min |
| 6.6 | Modify `simulation/engine.py` — apply overrides in tick | 30 min |
| 6.7 | Create `api/scenarios.py` — REST endpoints | 30 min |
| 6.8 | Register router in `main.py` | 5 min |
| 6.9 | Frontend: types + API lib additions | 15 min |
| 6.10 | Frontend: ScenarioPanel component | 45 min |
| 6.11 | Frontend: ScenarioPresets component | 15 min |
| 6.12 | Frontend: ScenarioPage + routing + sidebar | 15 min |
| 6.13 | Frontend: map integration (dashed routes, bus overlays) | 30 min |
| **Total** | | **6 hrs** |

> **Note:** 6 hrs exceeds the original 4 hr estimate because of real-time simulation integration (steps 6.5–6.6) and map effects (6.13). These are optional polish if time is tight — the core simulation-only `POST /simulate` endpoint works standalone without them.

---

## 7. Key Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Simulation overrides break the engine's normal tick | Use a separate in-memory override dict read-only in tick; never modify bus_states directly |
| Impact calculations feel arbitrary/not realistic | Tune constants during demo prep. Perception matters more than accuracy for 5 min presentation |
| "Apply to map" feature is complex | Cut scope: only implement `POST /simulate` (read-only impact analysis) if time is short; skip live map effects |
| AI insights are too generic | Template approach lets us hand-craft demo-relevant messages. Save AI API for post-MVP polish |

---

## 8. Demo Flow Script

1. Click **"Marilog Landslide Closure"** preset
2. Panel shows: Travel Time +25min, Congestion +18%, Occupancy +12%
3. Insight reads: *"Deploy 2 additional buses on the Davao–Tagum route and advise commuters on delays"*
4. Click **"Apply to Map"** → buses slow/stop on affected route, polyline turns red, countdown appears
5. Click **"Reset"** → simulation returns to normal
6. (Alternative) Click **"Kadayawan Festival Surge"** → shows demand-driven impact
