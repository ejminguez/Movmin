import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Route, DemandForecast, DemandInsight, DemandForecastHour } from "@/types";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, Legend } from "recharts";
import { TrendingUp, Clock, AlertTriangle, Lightbulb, Brain, RefreshCw, Route as RouteIcon, BarChart3, Target } from "lucide-react";

export default function AnalyticsPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [forecast, setForecast] = useState<DemandForecast | null>(null);
  const [insight, setInsight] = useState<DemandInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const r = await api.get<Route[]>("/api/routes");
        setRoutes(r);
        if (r.length > 0) setSelectedRouteId(r[0].id);
      } catch {
        setError("Failed to load routes. Ensure backend is running.");
        setLoading(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (selectedRouteId === null) return;
    setLoading(true);
    setError(null);

    Promise.all([
      api.getDemandForecast(selectedRouteId),
      api.getDemandInsights(selectedRouteId),
    ])
      .then(([f, i]) => {
        setForecast(f);
        setInsight(i);
      })
      .catch(() => setError("Failed to fetch demand forecast."))
      .finally(() => setLoading(false));
  }, [selectedRouteId]);

  const formatHour = (h: number) => `${h.toString().padStart(2, "0")}:00`;
  const selectedRoute = routes.find((r) => r.id === selectedRouteId);
  const routeColor = selectedRoute?.color || "#3b82f6";

  const chartData: ({ hour: string } & Record<string, number>)[] = [];
  if (forecast) {
    for (const f of forecast.forecasts) {
      chartData.push({
        hour: formatHour(f.hour),
        [`demand_${forecast.route_id}`]: f.predicted_demand,
        confidence: Math.round(f.confidence * 100),
      });
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse p-6">
        <div className="h-8 bg-zinc-800 rounded w-1/3 mb-2" />
        <div className="h-4 bg-zinc-800 rounded w-1/2 mb-6" />
        <div className="flex gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 bg-zinc-800 rounded w-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-zinc-900 rounded-xl border border-zinc-800" />
          <div className="h-80 bg-zinc-900 rounded-xl border border-zinc-800" />
        </div>
        <div className="h-40 bg-zinc-900 rounded-xl border border-zinc-800" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6">
        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-zinc-100 mb-2">Failed to Load</h2>
        <p className="text-sm text-zinc-400 max-w-md mb-6">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" /> Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-100 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-amber-500" />
            Demand Intelligence
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Passenger demand forecasting and AI-powered operational insights for the Davao Region transit network.
          </p>
        </div>
      </div>

      {routes.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-px">
          {routes.map((route) => {
            const isActive = route.id === selectedRouteId;
            return (
              <button
                key={route.id}
                onClick={() => setSelectedRouteId(route.id)}
                className={`relative px-4 py-2 text-xs font-semibold rounded-t-lg transition-all duration-200 border-t border-x cursor-pointer ${
                  isActive
                    ? "bg-zinc-900 border-zinc-800 text-zinc-100"
                    : "bg-transparent border-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: route.color }} />
                  {route.name}
                </div>
                {isActive && (
                  <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] transition-all" style={{ backgroundColor: route.color }} />
                )}
              </button>
            );
          })}
        </div>
      )}

      {forecast && insight && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Target className="h-3 w-3 text-amber-500" />
                  Daily Demand
                </span>
                <div className="text-2xl font-black text-zinc-100 mt-2">
                  {insight.daily_total.toLocaleString()}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px]">
                <span className="text-zinc-500">Projected passengers</span>
                <span className="font-semibold text-zinc-300">today</span>
              </div>
            </div>

            {insight.peak_hours.slice(0, 3).map((peak, idx) => (
              <div key={idx} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-blue-500" />
                    {peak.label}
                  </span>
                  <div className="text-2xl font-black text-zinc-100 mt-2">
                    {peak.demand.toLocaleString()}
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px]">
                  <span className="text-zinc-500">At {peak.hour.toString().padStart(2, "0")}:00</span>
                  <span className="font-semibold text-zinc-300">peak passengers</span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
              <h3 className="text-sm font-bold text-zinc-200 mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-zinc-400" />
                24-Hour Demand Forecast
              </h3>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="hour" stroke="#71717a" fontSize={10} tickLine={false} interval={2} />
                    <YAxis stroke="#71717a" fontSize={10} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "8px" }}
                      labelStyle={{ color: "#a1a1aa", fontSize: "11px", fontWeight: "bold" }}
                      itemStyle={{ fontSize: "12px" }}
                    />
                    <Bar
                      dataKey={`demand_${forecast.route_id}`}
                      name="Predicted Demand"
                      fill={routeColor}
                      radius={[4, 4, 0, 0]}
                      opacity={0.85}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
              <h3 className="text-sm font-bold text-zinc-200 mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-zinc-400" />
                Demand Trend & Forecast Confidence
              </h3>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="hour" stroke="#71717a" fontSize={10} tickLine={false} interval={2} />
                    <YAxis yAxisId="left" stroke="#71717a" fontSize={10} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" stroke="#71717a" fontSize={10} tickLine={false} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "8px" }}
                      labelStyle={{ color: "#a1a1aa", fontSize: "11px", fontWeight: "bold" }}
                      itemStyle={{ fontSize: "12px" }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey={`demand_${forecast.route_id}`}
                      name="Demand"
                      stroke={routeColor}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="confidence"
                      name="Confidence %"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                      strokeDasharray="4 4"
                      activeDot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-start gap-4">
              <div className="hidden sm:flex h-10 w-10 rounded-lg bg-amber-500/10 border border-amber-500/20 items-center justify-center flex-shrink-0 mt-0.5">
                {insight.source.includes("Bedrock") ? (
                  <Brain className="h-5 w-5 text-amber-400" />
                ) : (
                  <Lightbulb className="h-5 w-5 text-amber-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-amber-400" />
                    AI-Powered Insight
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700 flex items-center gap-1">
                    <RouteIcon className="h-3 w-3" />
                    {forecast.route_name}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    insight.source.includes("Bedrock")
                      ? "bg-emerald-900/30 text-emerald-400 border border-emerald-800/40"
                      : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                  }`}>
                    {insight.source}
                  </span>
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed mb-3">{insight.summary}</p>
                <div className="bg-zinc-950/50 border border-zinc-800/60 rounded-lg p-3.5">
                  <p className="text-xs font-semibold text-amber-400 mb-1.5 flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5" />
                    Recommendation
                  </p>
                  <p className="text-sm text-zinc-300 leading-relaxed">{insight.recommendation}</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
