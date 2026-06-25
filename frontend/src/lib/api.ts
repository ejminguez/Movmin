import type { ScenarioPreset, ScenarioResult, ScenarioSimulateRequest } from "@/types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  health: () => request<{ status: string }>("/health"),

  simulateScenario: (body: ScenarioSimulateRequest) =>
    request<ScenarioResult>("/api/scenarios/simulate", { method: "POST", body: JSON.stringify(body) }),

  getScenarioPresets: () =>
    request<{ presets: ScenarioPreset[] }>("/api/scenarios/presets"),

  applyScenario: (scenarioId: string, durationSeconds: number) =>
    request<{ applied: boolean; expires_at: string }>("/api/scenarios/apply", {
      method: "POST",
      body: JSON.stringify({ scenario_id: scenarioId, duration_seconds: durationSeconds }),
    }),

  resetScenario: () =>
    request<{ status: string }>("/api/scenarios/reset", { method: "POST", body: JSON.stringify({}) }),
};
