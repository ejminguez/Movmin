import { useState, useEffect } from "react";
import type { Route, ScenarioResult, ScenarioSimulateRequest } from "@/types";
import { 
  Play, AlertTriangle, ShieldAlert,
  TrendingUp, Clock, Users, ArrowUpRight, ArrowRight
} from "lucide-react";
import { api } from "@/lib/api";

interface ScenarioPanelProps {
  routes: Route[];
  activeScenarioId: string | null;
  isApplying: boolean;
  onSelectPreset: (presetId: string | null) => void;
  presetResult: ScenarioResult | null;
}

export default function ScenarioPanel({
  routes,
  activeScenarioId,
  isApplying,
  onSelectPreset,
  presetResult
}: ScenarioPanelProps) {
  const [type, setType] = useState<"route_closure" | "demand_surge" | "severe_weather">("route_closure");
  const [selectedRouteId, setSelectedRouteId] = useState<number>(routes[0]?.id || 1);
  const [durationMinutesStr, setDurationMinutesStr] = useState<string>("60");
  const [demandIncreasePct, setDemandIncreasePct] = useState<number>(50);
  const [weatherCondition, setWeatherCondition] = useState<string>("heavy_rain");
  
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeResult = presetResult || result;

  // Update selected route if routes list changes/loads
  useEffect(() => {
    if (routes.length > 0 && !routes.some(r => r.id === selectedRouteId)) {
      setSelectedRouteId(routes[0].id);
    }
  }, [routes, selectedRouteId]);

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    onSelectPreset(null); // Clear active preset if running custom
    
    const parsedDuration = durationMinutesStr === "" ? 60 : parseInt(durationMinutesStr, 10);
    const body: ScenarioSimulateRequest = {
      type,
      route_id: selectedRouteId,
      parameters: {
        duration_minutes: type === "route_closure" ? parsedDuration : undefined,
        demand_increase_pct: type === "demand_surge" ? demandIncreasePct : undefined,
        weather_condition: type === "severe_weather" ? weatherCondition : undefined,
      }
    };

    try {
      const data = await api.simulateScenario(body);
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to run simulation");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col text-zinc-100 overflow-hidden bg-zinc-950/20">
      {/* Compact Input Form Section */}
      <div className="p-4 border-b border-zinc-900/60 shrink-0 bg-zinc-950/40">
        <form onSubmit={handleSimulate} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Disruption Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                disabled={isLoading || isApplying}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50"
              >
                <option value="route_closure">Route Closure</option>
                <option value="demand_surge">Demand Surge</option>
                <option value="severe_weather">Severe Weather</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Target Corridor</label>
              <select
                value={selectedRouteId}
                onChange={(e) => setSelectedRouteId(Number(e.target.value))}
                disabled={isLoading || isApplying}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50"
              >
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            {/* Conditional Input */}
            <div>
              {type === "route_closure" && (
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Duration (min)</label>
                  <input
                    type="text"
                    value={durationMinutesStr}
                    onChange={(e) => setDurationMinutesStr(e.target.value.replace(/\D/g, ""))}
                    placeholder="60"
                    disabled={isLoading || isApplying}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50 font-mono"
                  />
                </div>
              )}

              {type === "demand_surge" && (
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Surge Increase</label>
                    <span className="text-[10px] text-amber-500 font-mono">+{demandIncreasePct}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="10"
                    value={demandIncreasePct}
                    onChange={(e) => setDemandIncreasePct(Number(e.target.value))}
                    disabled={isLoading || isApplying}
                    className="w-full accent-amber-500 h-1 bg-zinc-800 rounded-lg cursor-pointer mt-2"
                  />
                </div>
              )}

              {type === "severe_weather" && (
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Condition</label>
                  <select
                    value={weatherCondition}
                    onChange={(e) => setWeatherCondition(e.target.value)}
                    disabled={isLoading || isApplying}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="heavy_rain">Heavy Rain</option>
                    <option value="fog">Thick Fog</option>
                    <option value="storm">Storm Typhoon</option>
                  </select>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || isApplying || routes.length === 0}
              className="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-zinc-950 text-xs font-bold rounded py-1.5 px-3 flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed h-[30px]"
            >
              {isLoading ? (
                <span className="h-3.5 w-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <Play className="h-3 w-3 fill-zinc-950" />
              )}
              Run What-If
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="m-4 p-3 bg-red-950/20 border border-red-900/55 rounded flex items-start gap-2 text-xs text-red-400 shrink-0">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Scrollable Results & AI Recommendations Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeResult ? (
          <div className="space-y-4">
            {/* Impact Metric Grid */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Projected System Impact</h3>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-zinc-900/30 border border-zinc-850 p-2.5 rounded flex flex-col justify-between">
                  <div className="flex items-center justify-between text-zinc-500">
                    <span className="text-[9px] font-bold uppercase tracking-wider">Avg Delay</span>
                    <Clock className="h-3 w-3 text-zinc-400" />
                  </div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-base font-bold font-mono text-red-500">
                      +{Math.round(activeResult.impact.travel_time_delta_min)}m
                    </span>
                    <span className="text-[9px] text-red-400">
                      (+{Math.round(activeResult.impact.travel_time_delta_pct)}%)
                    </span>
                  </div>
                </div>

                <div className="bg-zinc-900/30 border border-zinc-850 p-2.5 rounded flex flex-col justify-between">
                  <div className="flex items-center justify-between text-zinc-500">
                    <span className="text-[9px] font-bold uppercase tracking-wider">Congestion</span>
                    <TrendingUp className="h-3 w-3 text-zinc-400" />
                  </div>
                  <div className="mt-1">
                    <span className="text-base font-bold font-mono text-red-500">
                      +{Math.round(activeResult.impact.congestion_delta_pct)}%
                    </span>
                  </div>
                </div>

                <div className="bg-zinc-900/30 border border-zinc-850 p-2.5 rounded flex flex-col justify-between">
                  <div className="flex items-center justify-between text-zinc-500">
                    <span className="text-[9px] font-bold uppercase tracking-wider">Occupancy</span>
                    <Users className="h-3 w-3 text-zinc-400" />
                  </div>
                  <div className="mt-1">
                    <span className="text-base font-bold font-mono text-yellow-500">
                      +{Math.round(activeResult.impact.occupancy_delta_pct)}%
                    </span>
                  </div>
                </div>

                <div className="bg-zinc-900/30 border border-zinc-850 p-2.5 rounded flex flex-col justify-between">
                  <div className="flex items-center justify-between text-zinc-500">
                    <span className="text-[9px] font-bold uppercase tracking-wider">Affected Fleet</span>
                    <ShieldAlert className="h-3 w-3 text-zinc-400" />
                  </div>
                  <div className="mt-1 flex flex-col">
                    <span className="text-xs font-semibold text-zinc-200 leading-none">
                      {activeResult.impact.affected_buses} Buses
                    </span>
                    <span className="text-[8px] text-zinc-500 font-light mt-1">
                      ~{activeResult.impact.affected_passengers} Passengers
                    </span>
                  </div>
                </div>
              </div>

              {activeResult.impact.alternative_route && (
                <div className="bg-emerald-950/15 border border-emerald-900/30 p-2 rounded text-xs flex items-center justify-between text-emerald-400">
                  <div className="flex items-center gap-2">
                    <ArrowUpRight className="h-4 w-4 shrink-0" />
                    <div>
                      <span className="text-[9px] text-emerald-500/85 uppercase tracking-wider font-bold">Suggested Reroute</span>
                      <span className="font-semibold text-zinc-200">{activeResult.impact.alternative_route}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* AI Mitigation Insight */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">AI Recommendation</h3>
                <span className="text-[9px] text-zinc-500">Confidence: <span className="text-emerald-400 font-bold capitalize">{activeResult.insight.confidence}</span></span>
              </div>

              <div className="bg-zinc-900/40 border border-zinc-900 p-3 rounded space-y-2.5">
                <p className="text-xs text-zinc-300 leading-relaxed font-light">
                  {activeResult.insight.text}
                </p>
                {activeResult.insight.suggested_actions.length > 0 && (
                  <div className="space-y-1 border-t border-zinc-800/60 pt-2">
                    <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider">Suggested Dispatch Actions</div>
                    <ul className="space-y-1 text-xs font-light text-zinc-400">
                      {activeResult.insight.suggested_actions.map((act, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <ArrowRight className="h-3 w-3 text-amber-500/70 mt-0.5 shrink-0" />
                          <span className="leading-tight">{act}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>


          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 font-light mt-10">
            <ShieldAlert className="h-10 w-10 text-zinc-700/80 mb-3" />
            <p className="text-xs">No active simulation overrides.</p>
            <p className="text-[10px] mt-1 text-zinc-650 leading-relaxed">
              Select a preset at the top or configure a custom scenario, then click "Run What-If" to generate impact projections.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
