import { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { api } from "@/lib/api";
import type {
  PlanningInsights,
  DemandSummary,
  UnderservedArea,
  TerminalRecommendation,
  DemandHotspot,
} from "@/types";
import {
  Lightbulb,
  RefreshCw,
  AlertTriangle,
  MapPin,
  BarChart3,
  TrendingUp,
  Target,
  Route,
  Brain,
  Loader2,
} from "lucide-react";

export default function PlanningInsightsPanel() {
  const [insights, setInsights] = useState<PlanningInsights | null>(null);
  const [summary, setSummary] = useState<DemandSummary | null>(null);
  const [underserved, setUnderserved] = useState<UnderservedArea[]>([]);
  const [terminalRecs, setTerminalRecs] = useState<TerminalRecommendation[]>([]);
  const [hotspots, setHotspots] = useState<DemandHotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [insightsData, summaryData, underservedData, terminalData, hotspotsData] =
        await Promise.all([
          api.get<PlanningInsights>("/api/heatmap/insights"),
          api.get<DemandSummary>("/api/heatmap/summary"),
          api.get<UnderservedArea[]>("/api/heatmap/underserved"),
          api.get<TerminalRecommendation[]>("/api/heatmap/terminals"),
          api.get<DemandHotspot[]>("/api/heatmap/hotspots"),
        ]);
      setInsights(insightsData);
      setSummary(summaryData);
      setUnderserved(underservedData);
      setTerminalRecs(terminalData);
      setHotspots(hotspotsData);
    } catch (err) {
      setError("Failed to load planning insights");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return (
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 text-amber-500 animate-spin mb-3" />
        <p className="text-xs text-zinc-400">Analyzing demand patterns...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center gap-2 text-red-400 mb-2">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-xs font-bold">Error</span>
        </div>
        <p className="text-xs text-zinc-400">{error}</p>
        <button
          onClick={fetchAll}
          className="mt-3 flex items-center gap-1.5 text-[10px] text-amber-500 hover:text-amber-400 font-bold"
        >
          <RefreshCw className="h-3 w-3" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
            Planning Insights
          </span>
        </div>
        <button
          onClick={fetchAll}
          className="text-zinc-500 hover:text-amber-500 transition-colors"
          title="Refresh insights"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-3 space-y-3 overflow-y-auto flex-1">
        {insights?.ai_generated && (
          <div className="flex items-center gap-1.5 mb-2">
            <Brain className="h-3 w-3 text-purple-500" />
            <span className="text-[9px] font-bold text-purple-400 uppercase tracking-wider">
              AI-Powered Analysis
            </span>
          </div>
        )}

        {insights?.fallback && !insights?.ai_generated && (
          <div className="flex items-center gap-1.5 mb-2">
            <BarChart3 className="h-3 w-3 text-amber-500" />
            <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">
              Rule-Based Analysis
            </span>
          </div>
        )}

        {summary && (
          <div className="grid grid-cols-2 gap-2">
            <MetricTile
              label="Highest Demand"
              value={summary.highest_demand_municipality}
              sub={`Score: ${summary.highest_demand_score}`}
              icon={<TrendingUp className="h-3.5 w-3.5 text-red-500" />}
            />
            <MetricTile
              label="Avg Density"
              value={`${summary.average_density_score}`}
              sub="/ 100"
              icon={<BarChart3 className="h-3.5 w-3.5 text-amber-500" />}
            />
            <MetricTile
              label="Busiest Corridor"
              value={summary.most_utilized_corridor}
              sub={`Score: ${summary.most_utilized_corridor_score}`}
              icon={<Route className="h-3.5 w-3.5 text-blue-500" />}
            />
            <MetricTile
              label="Underserved Areas"
              value={`${summary.underserved_count}`}
              sub={`of ${summary.total_municipalities} municipalities`}
              icon={<AlertTriangle className="h-3.5 w-3.5 text-orange-500" />}
            />
          </div>
        )}

        {insights?.summary && (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Brain className="h-3 w-3 text-purple-500" />
              <span className="text-[9px] font-bold text-purple-400 uppercase tracking-wider">
                AI Recommendations
              </span>
            </div>
            <div className="text-[11px] text-zinc-300 leading-relaxed">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => <h1 className="text-sm font-bold text-zinc-100 mt-2 mb-1">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-xs font-bold text-zinc-100 mt-2 mb-1">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-[11px] font-bold text-zinc-100 mt-1.5 mb-0.5">{children}</h3>,
                  h4: ({ children }) => <h4 className="text-[11px] font-bold text-zinc-100 mt-1.5 mb-0.5">{children}</h4>,
                  h5: ({ children }) => <h5 className="text-[11px] font-bold text-zinc-100 mt-1.5 mb-0.5">{children}</h5>,
                  h6: ({ children }) => <h6 className="text-[11px] font-bold text-zinc-100 mt-1.5 mb-0.5">{children}</h6>,
                  p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc list-inside mb-1.5 space-y-0.5">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-1.5 space-y-0.5">{children}</ol>,
                  li: ({ children }) => <li className="text-zinc-300">{children}</li>,
                  strong: ({ children }) => <strong className="font-bold text-zinc-100">{children}</strong>,
                  hr: () => <hr className="border-zinc-700 my-2" />,
                }}
              >
                {insights.summary}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {hotspots.length > 0 && (
          <Section title="Demand Hotspots" icon={<Target className="h-3 w-3 text-red-500" />}>
            <div className="space-y-1.5">
              {hotspots.map((h) => (
                <div
                  key={h.municipality}
                  className="flex items-center justify-between bg-zinc-900/40 border border-zinc-800/60 rounded px-2.5 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-zinc-200">{h.municipality}</span>
                    {h.underserved && (
                      <span className="text-[8px] font-bold text-red-500 bg-red-950/50 px-1 py-0.5 rounded">
                        UNDERSERVED
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <DemandBadge level={h.demand_level} />
                    <span className="text-[11px] font-black font-mono">{h.density_score}</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {underserved.length > 0 && (
          <Section title="Underserved Areas" icon={<AlertTriangle className="h-3 w-3 text-orange-500" />}>
            <div className="space-y-1.5">
              {underserved.slice(0, 5).map((u) => (
                <div
                  key={u.municipality}
                  className="bg-zinc-900/40 border border-zinc-800/60 rounded px-2.5 py-2"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-zinc-200">{u.municipality}</span>
                    <SeverityBadge severity={u.severity} />
                  </div>
                  <p className="text-[9px] text-zinc-400 leading-relaxed">{u.reason}</p>
                  <div className="flex gap-3 mt-1 text-[9px] text-zinc-500">
                    <span>Score: {u.density_score}</span>
                    <span>Coverage: {u.coverage_score}%</span>
                    <span>Routes: {u.active_routes}</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {terminalRecs.length > 0 && (
          <Section title="Terminal Recommendations" icon={<MapPin className="h-3 w-3 text-amber-500" />}>
            <div className="space-y-1.5">
              {terminalRecs.slice(0, 5).map((r) => (
                <div
                  key={r.municipality}
                  className="bg-zinc-900/40 border border-zinc-800/60 rounded px-2.5 py-2"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-zinc-200">{r.municipality}</span>
                    <PriorityBadge priority={r.priority} />
                  </div>
                  <p className="text-[9px] text-zinc-400 leading-relaxed">{r.reason}</p>
                  <p className="text-[9px] text-zinc-500 mt-1 italic">{r.expected_impact}</p>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-[12px] font-black text-zinc-100 leading-tight truncate">{value}</div>
      <div className="text-[8px] text-zinc-500 mt-0.5">{sub}</div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">{title}</span>
      </div>
      {children}
    </div>
  );
}

function DemandBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    CRITICAL: "bg-red-950 text-red-400 border-red-800",
    HIGH: "bg-orange-950 text-orange-400 border-orange-800",
    MODERATE: "bg-yellow-950 text-yellow-400 border-yellow-800",
    LOW: "bg-green-950 text-green-400 border-green-800",
    VERY_LOW: "bg-zinc-900 text-zinc-400 border-zinc-700",
  };
  return (
    <span
      className={`text-[8px] font-bold px-1 py-0.5 rounded border ${styles[level] || styles.LOW}`}
    >
      {level}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    CRITICAL: "bg-red-950 text-red-400",
    HIGH: "bg-orange-950 text-orange-400",
    MEDIUM: "bg-yellow-950 text-yellow-400",
    LOW: "bg-zinc-800 text-zinc-400",
  };
  return (
    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${styles[severity] || styles.MEDIUM}`}>
      {severity}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    HIGH: "bg-red-950 text-red-400",
    MEDIUM: "bg-yellow-950 text-yellow-400",
    LOW: "bg-zinc-800 text-zinc-400",
  };
  return (
    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${styles[priority] || styles.MEDIUM}`}>
      {priority}
    </span>
  );
}
