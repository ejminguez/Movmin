import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { Route, AnalyticSnapshot, RouteAnalyticsSummary, RouteSnapshotResponse } from "@/types";
import {
  Clock,
  Activity,
  Percent,
  Bus,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  AlertTriangle,
  History,
  Calendar
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  BarChart,
  Bar
} from "recharts";

export default function RouteAnalyticsPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [history, setHistory] = useState<AnalyticSnapshot[]>([]);
  const [summary, setSummary] = useState<RouteAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // 1. Fetch all routes on mount
  useEffect(() => {
    async function fetchRoutes() {
      try {
        const data = await api.get<Route[]>("/api/routes");
        setRoutes(data);
        if (data.length > 0) {
          setSelectedRouteId(data[0].id);
        }
      } catch (err) {
        console.error("Error fetching routes:", err);
        setError("Failed to load transit routes. Please ensure the backend server is running.");
        setLoading(false);
      }
    }
    fetchRoutes();
  }, []);

  // 2. Main data fetching function for selected route
  const fetchRouteData = useCallback(async (routeId: number, showLoadingIndicator = false) => {
    if (showLoadingIndicator) setLoading(true);
    setError(null);
    try {
      const [historyData, summaryData] = await Promise.all([
        api.get<RouteSnapshotResponse>(`/api/analytics/routes/${routeId}?minutes=60`),
        api.get<RouteAnalyticsSummary>(`/api/analytics/routes/${routeId}/summary`)
      ]);
      setHistory(historyData.snapshots);
      setSummary(summaryData);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("Error fetching analytics data:", err);
      setError("Failed to fetch analytics. Please check your connection and try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // 3. Trigger fetch and polling when selected route changes
  useEffect(() => {
    if (selectedRouteId === null) return;

    fetchRouteData(selectedRouteId, true);

    // Poll history every 10 seconds for real-time chart updates
    const historyInterval = setInterval(() => {
      fetchRouteData(selectedRouteId, false);
    }, 10000);

    return () => {
      clearInterval(historyInterval);
    };
  }, [selectedRouteId, fetchRouteData]);

  // Handle manual refresh click
  const handleRefresh = () => {
    if (selectedRouteId === null) return;
    setRefreshing(true);
    fetchRouteData(selectedRouteId, false);
  };

  // Helper to format timestamps for charts
  const formatTimeTick = (tickStr: string) => {
    try {
      const date = new Date(tickStr);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return tickStr;
    }
  };

  const selectedRoute = routes.find((r) => r.id === selectedRouteId);
  const routeColor = selectedRoute?.color || "#3b82f6";
  const latestSnapshot = history.length > 0 ? history[history.length - 1] : null;

  // Render loading skeleton
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-zinc-900 rounded-xl border border-zinc-800" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-zinc-900 rounded-xl border border-zinc-800" />
          <div className="h-80 bg-zinc-900 rounded-xl border border-zinc-800" />
        </div>
      </div>
    );
  }

  // Render error message
  if (error && routes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6">
        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-zinc-100 mb-2">Failed to Load Dashboard</h2>
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
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-100 flex items-center gap-2">
            <Activity className="h-6 w-6 text-amber-500" />
            Route Analytics
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Analyze historical performance, delay trends, and capacity utilization metrics across the Davao region.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="text-right text-[11px] text-zinc-500">
            <div>Last Polled: {lastRefreshed.toLocaleTimeString()}</div>
            <div className="flex items-center justify-end gap-1 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Live Polling (10s)
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-300 hover:text-zinc-100 transition-colors disabled:opacity-50"
            title="Refresh analytics manually"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
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
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: route.color }}
                  />
                  {route.name}
                </div>
                {isActive && (
                  <div
                    className="absolute bottom-[-1px] left-0 right-0 h-[2px] transition-all"
                    style={{ backgroundColor: route.color }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Graceful empty state check */}
      {(!summary || summary.snapshot_count === 0 || history.length === 0) ? (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-12 text-center max-w-xl mx-auto shadow-lg shadow-black/20">
          <div className="relative mx-auto w-16 h-16 flex items-center justify-center bg-zinc-800/40 rounded-full border border-zinc-700/50 mb-4 animate-pulse">
            <RefreshCw className="h-6 w-6 text-amber-500 animate-spin duration-[4000ms]" />
          </div>
          <h3 className="text-base font-bold text-zinc-200 mb-2">Collecting Route Data</h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto mb-6 leading-relaxed">
            The analytics background service records status snapshots every 30 seconds. We are currently gathering initial historical metrics for this corridor.
          </p>
          <div className="flex items-center justify-center gap-3 text-xs text-zinc-500 bg-zinc-950/50 border border-zinc-800/60 rounded-lg py-2.5 px-4 w-fit mx-auto">
            <Clock className="h-3.5 w-3.5" />
            <span>Next database snapshot in ~15-30 seconds</span>
          </div>
        </div>
      ) : (
        <>
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: On-Time Performance */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Percent className="h-3 w-3 text-emerald-500" />
                  On-Time Performance
                </span>
                <div className="text-2xl font-black text-zinc-100 mt-2">
                  {summary.current_otp}%
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px]">
                <span className="text-zinc-500">Average OTP:</span>
                <span className="font-semibold text-zinc-300">{summary.avg_otp}%</span>
              </div>
            </div>

            {/* Card 2: Average Delay */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-amber-500" />
                  Average Delay
                </span>
                <div className="text-2xl font-black text-zinc-100 mt-2">
                  {summary.avg_delay_min.toFixed(1)} <span className="text-xs font-normal text-zinc-500 ml-0.5">min</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px]">
                <span className="text-zinc-500">Current Delay:</span>
                <span className="font-semibold text-zinc-300">{summary.current_delay_min} min</span>
              </div>
            </div>

            {/* Card 3: Capacity Utilization */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="h-3 w-3 text-blue-500" />
                  Capacity Utilization
                </span>
                <div className="text-2xl font-black text-zinc-100 mt-2">
                  {summary.avg_utilization.toFixed(1)}%
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px]">
                <span className="text-zinc-500">Current:</span>
                <span className="font-semibold text-zinc-300">{summary.current_utilization}%</span>
              </div>
            </div>

            {/* Card 4: Bus Fleet Count */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Bus className="h-3 w-3 text-purple-500" />
                  Active Fleet
                </span>
                <div className="text-2xl font-black text-zinc-100 mt-2">
                  {latestSnapshot?.active_bus_count ?? 0} <span className="text-xs font-normal text-zinc-500 ml-0.5">buses</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px]">
                <span className="text-zinc-500">Recorded Snapshots:</span>
                <span className="font-semibold text-zinc-300">{summary.snapshot_count}</span>
              </div>
            </div>
          </div>

          {/* Visual Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Travel Time & Delay Trend */}
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
              <h3 className="text-sm font-bold text-zinc-200 mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-zinc-400" />
                Corridor Travel Time & Delay Trend
              </h3>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={formatTimeTick}
                      stroke="#71717a"
                      fontSize={10}
                      tickLine={false}
                    />
                    <YAxis stroke="#71717a" fontSize={10} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "8px" }}
                      labelStyle={{ color: "#a1a1aa", fontSize: "11px", fontWeight: "bold" }}
                      itemStyle={{ fontSize: "12px" }}
                      labelFormatter={(label) => `Time: ${formatTimeTick(label)}`}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                    <Line
                      type="monotone"
                      name="Travel Time (min)"
                      dataKey="avg_travel_time_min"
                      stroke={routeColor}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      name="Delay (min)"
                      dataKey="avg_delay_min"
                      stroke="#ef4444"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: On-Time Performance Trend */}
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
              <h3 className="text-sm font-bold text-zinc-200 mb-4 flex items-center gap-2">
                <Percent className="h-4 w-4 text-zinc-400" />
                On-Time Performance History
              </h3>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorOtp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={routeColor} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={routeColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={formatTimeTick}
                      stroke="#71717a"
                      fontSize={10}
                      tickLine={false}
                    />
                    <YAxis stroke="#71717a" fontSize={10} tickLine={false} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "8px" }}
                      labelStyle={{ color: "#a1a1aa", fontSize: "11px", fontWeight: "bold" }}
                      itemStyle={{ fontSize: "12px" }}
                      labelFormatter={(label) => `Time: ${formatTimeTick(label)}`}
                    />
                    <Area
                      type="monotone"
                      name="OTP %"
                      dataKey="on_time_performance"
                      stroke={routeColor}
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorOtp)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Passenger Capacity Utilization */}
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
              <h3 className="text-sm font-bold text-zinc-200 mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-zinc-400" />
                Fleet Capacity Utilization Trend
              </h3>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={formatTimeTick}
                      stroke="#71717a"
                      fontSize={10}
                      tickLine={false}
                    />
                    <YAxis stroke="#71717a" fontSize={10} tickLine={false} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "8px" }}
                      labelStyle={{ color: "#a1a1aa", fontSize: "11px", fontWeight: "bold" }}
                      itemStyle={{ fontSize: "12px" }}
                      labelFormatter={(label) => `Time: ${formatTimeTick(label)}`}
                    />
                    <Bar
                      name="Utilization %"
                      dataKey="utilization"
                      fill={routeColor}
                      radius={[4, 4, 0, 0]}
                      opacity={0.8}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Log Panel: Recent Snapshots */}
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-200 mb-3.5 flex items-center gap-2">
                  <History className="h-4 w-4 text-zinc-400" />
                  Recent Database Log
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-500 font-semibold">
                        <th className="py-2">Time</th>
                        <th className="py-2">Active Fleet</th>
                        <th className="py-2 text-right">Utilization</th>
                        <th className="py-2 text-right">Avg Delay</th>
                        <th className="py-2 text-right">OTP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/40">
                      {[...history].reverse().slice(0, 6).map((snap) => (
                        <tr key={snap.id} className="text-zinc-400 hover:bg-zinc-900/20">
                          <td className="py-2">{formatTimeTick(snap.timestamp)}</td>
                          <td className="py-2 flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
                            {snap.active_bus_count} buses
                          </td>
                          <td className="py-2 text-right">{snap.utilization !== null ? `${snap.utilization}%` : "—"}</td>
                          <td className="py-2 text-right text-red-400">{snap.avg_delay_min !== null ? `${snap.avg_delay_min}m` : "0m"}</td>
                          <td className="py-2 text-right text-emerald-400">{snap.on_time_performance}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="text-[10px] text-zinc-500 flex items-center gap-1 mt-4">
                <Calendar className="h-3 w-3" />
                Showing up to 6 latest snapshots. Historical limits default to 60 minutes.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
