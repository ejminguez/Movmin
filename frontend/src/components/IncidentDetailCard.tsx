import { useEffect, useState } from "react";
import type { Incident } from "../types";
import { X, AlertTriangle, Clock, MapPin, Route, ShieldAlert } from "lucide-react";

interface IncidentDetailCardProps {
  incident: Incident;
  onClose: () => void;
}

export default function IncidentDetailCard({ incident, onClose }: IncidentDetailCardProps) {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    if (!incident.expires_at) {
      setTimeLeft("N/A");
      return;
    }

    const updateTimer = () => {
      const expiry = new Date(incident.expires_at!).getTime();
      const now = new Date().getTime();
      const diff = expiry - now;
      
      if (diff <= 0) {
        setTimeLeft("Expiring...");
      } else {
        const secs = Math.floor((diff / 1000) % 60);
        const mins = Math.floor(diff / 1000 / 60);
        setTimeLeft(`${mins}m ${secs}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [incident.expires_at, incident.id]);

  function getSeverityColor(severity: string) {
    switch (severity.toUpperCase()) {
      case "LOW":
        return "text-emerald-400 border-emerald-800 bg-emerald-950/40";
      case "MEDIUM":
        return "text-yellow-400 border-yellow-800 bg-yellow-950/40";
      case "HIGH":
        return "text-orange-400 border-orange-800 bg-orange-950/40";
      case "CRITICAL":
        return "text-red-400 border-red-800 bg-red-950/40";
      default:
        return "text-zinc-300 border-zinc-700 bg-zinc-800/40";
    }
  }

  function getSeverityBadge(severity: string) {
    switch (severity.toUpperCase()) {
      case "LOW":
        return "bg-emerald-950 text-emerald-400 border-emerald-800";
      case "MEDIUM":
        return "bg-amber-950 text-amber-400 border-amber-800";
      case "HIGH":
        return "bg-orange-950 text-orange-400 border-orange-800";
      case "CRITICAL":
        return "bg-red-950 text-red-400 border-red-800 animate-pulse";
      default:
        return "bg-zinc-800 text-zinc-300 border-zinc-700";
    }
  }

  return (
    <div className="bg-zinc-950/95 backdrop-blur-md border border-zinc-850 rounded-xl p-4 shadow-2xl w-[320px] transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
      {/* Card Header */}
      <div className="flex justify-between items-start gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <ShieldAlert className="h-4.5 w-4.5 text-amber-500" />
          <span className="text-[10px] font-black tracking-widest text-zinc-500 uppercase font-mono">
            Incident Details
          </span>
        </div>
        <button 
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300 p-1 hover:bg-zinc-900 rounded transition-all"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Main Info */}
      <div className="space-y-3.5">
        <div>
          <h2 className="text-sm font-black text-zinc-100 leading-tight">
            {incident.title}
          </h2>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`text-[8px] font-black tracking-wider px-2 py-0.5 rounded border ${getSeverityBadge(incident.severity)}`}>
              {incident.severity}
            </span>
            <span className="text-[9px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-850 px-1.5 py-0.5 rounded uppercase">
              {incident.status}
            </span>
          </div>
        </div>

        {/* Description */}
        <p className="text-[11px] text-zinc-400 leading-relaxed bg-zinc-900/50 p-2.5 rounded border border-zinc-900">
          {incident.description}
        </p>

        {/* Detail List */}
        <div className="space-y-2 text-[10px] text-zinc-400 border-t border-zinc-900 pt-3">
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5 text-zinc-500">
              <Route className="h-3.5 w-3.5 text-zinc-650" />
              Affected Routes:
            </span>
            <span className="font-bold text-zinc-200">
              {incident.affected_routes.join(", ") || "All Routes"}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5 text-zinc-500">
              <Clock className="h-3.5 w-3.5 text-zinc-650" />
              Estimated Delay:
            </span>
            <span className="font-black text-amber-500">
              +{incident.estimated_delay_minutes} min
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5 text-zinc-500">
              <MapPin className="h-3.5 w-3.5 text-zinc-650" />
              Location (Coords):
            </span>
            <span className="font-mono text-zinc-300">
              {incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)}
            </span>
          </div>

          <div className="flex justify-between items-center border-t border-zinc-900/50 pt-2 mt-2">
            <span className="flex items-center gap-1.5 text-zinc-500">
              <Clock className="h-3.5 w-3.5 text-zinc-650" />
              Auto-Expires In:
            </span>
            <span className="font-black font-mono text-rose-500 text-xs">
              {timeLeft}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
