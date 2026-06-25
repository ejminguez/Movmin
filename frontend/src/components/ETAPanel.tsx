import { useState, useEffect, useCallback } from "react";
import { X, Clock, Route, CloudRain, AlertTriangle, Car, Gauge } from "lucide-react";
import { api } from "@/lib/api";
import type { Terminal, ETAResponse } from "@/types";

interface ETAPanelProps {
  terminals: Terminal[];
  onClose: () => void;
}

export default function ETAPanel({ terminals, onClose }: ETAPanelProps) {
  const [fromId, setFromId] = useState<number | "">("");
  const [toId, setToId] = useState<number | "">("");
  const [eta, setEta] = useState<ETAResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEta = useCallback(async (from: number, to: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<ETAResponse>(
        `/api/eta?from_terminal_id=${from}&to_terminal_id=${to}`
      );
      setEta(data);
    } catch (err) {
      setError("Could not calculate ETA. Ensure terminals are connected.");
      setEta(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (fromId !== "" && toId !== "" && fromId !== toId) {
      fetchEta(fromId, toId);
    } else {
      setEta(null);
    }
  }, [fromId, toId, fetchEta]);

  useEffect(() => {
    if (fromId === "" || toId === "" || fromId === toId || !eta) return;
    const interval = setInterval(() => {
      fetchEta(fromId, toId);
    }, 5000);
    return () => clearInterval(interval);
  }, [fromId, toId, eta, fetchEta]);

  const fromTerminal = terminals.find((t) => t.id === fromId);
  const toTerminal = terminals.find((t) => t.id === toId);

  const maxDelay = eta
    ? Math.max(eta.base_time_min, eta.traffic_delay_min + eta.weather_delay_min + eta.incident_delay_min, 1)
    : 1;
  const totalDelay = eta
    ? eta.traffic_delay_min + eta.weather_delay_min + eta.incident_delay_min
    : 0;

  return (
    <div className="bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-xl p-4 shadow-xl shadow-black/50 w-72">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-amber-500" />
            ETA Calculator
          </span>
        </h3>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-2 mb-3">
        <select
          value={fromId}
          onChange={(e) => {
            setFromId(e.target.value ? Number(e.target.value) : "");
            setEta(null);
          }}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500/50 transition-colors appearance-none cursor-pointer"
        >
          <option value="">Select origin...</option>
          {terminals.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <select
          value={toId}
          onChange={(e) => {
            setToId(e.target.value ? Number(e.target.value) : "");
            setEta(null);
          }}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500/50 transition-colors appearance-none cursor-pointer"
        >
          <option value="">Select destination...</option>
          {terminals.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-4">
          <div className="h-5 w-5 rounded-full border-2 border-zinc-700 border-t-amber-500 animate-spin" />
        </div>
      )}

      {error && (
        <div className="text-center py-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 mx-auto mb-1" />
          <p className="text-[10px] text-zinc-400">{error}</p>
        </div>
      )}

      {eta && !loading && (
        <div className="space-y-3">
          <div className="text-center">
            <div className="text-3xl font-black text-amber-500">
              {Math.round(eta.total_time_min)}
              <span className="text-sm font-medium text-zinc-400 ml-1">min</span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              {fromTerminal?.name.replace(" Terminal", "")} → {toTerminal?.name.replace(" Terminal", "")}
            </p>
          </div>

          <div className="space-y-1.5">
            <DelayRow
              icon={<Gauge className="h-3 w-3" />}
              label="Base travel time"
              value={eta.base_time_min}
              max={maxDelay}
              color="bg-zinc-600"
            />
            <DelayRow
              icon={<Car className="h-3 w-3" />}
              label="Traffic delay"
              value={eta.traffic_delay_min}
              max={maxDelay}
              color="bg-amber-600"
            />
            <DelayRow
              icon={<CloudRain className="h-3 w-3" />}
              label={`Weather (${eta.weather_condition})`}
              value={eta.weather_delay_min}
              max={maxDelay}
              color="bg-blue-600"
            />
            {eta.incident_delay_min > 0 && (
              <DelayRow
                icon={<AlertTriangle className="h-3 w-3" />}
                label="Incident delay"
                value={eta.incident_delay_min}
                max={maxDelay}
                color="bg-red-600"
              />
            )}
          </div>

          <div className="flex justify-between text-[10px] text-zinc-500 pt-1.5 border-t border-zinc-800">
            <span>{eta.distance_km} km</span>
            <span>{eta.avg_speed} km/h avg</span>
          </div>

          {totalDelay > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
              <p className="text-[10px] text-amber-400 font-semibold">
                +{Math.round(totalDelay)} min delay expected
              </p>
            </div>
          )}
        </div>
      )}

      {!eta && !loading && !error && fromId !== "" && toId !== "" && fromId === toId && (
        <p className="text-[10px] text-zinc-500 text-center py-2">
          Origin and destination must differ
        </p>
      )}
    </div>
  );
}

function DelayRow({
  icon,
  label,
  value,
  max,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-zinc-500 shrink-0">{icon}</span>
      <span className="text-[10px] text-zinc-400 flex-1 truncate">{label}</span>
      <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden shrink-0">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-zinc-300 w-8 text-right shrink-0">
        {Math.round(value)}
      </span>
    </div>
  );
}
