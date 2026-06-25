import { useEffect, useRef, useState } from "react";
import type { Incident } from "../types";
import { AlertTriangle, CloudRain, Ban, CloudLightning, Clock, Info } from "lucide-react";

interface IncidentFeedPanelProps {
  incidents: Incident[];
  selectedIncidentId: string | null;
  onSelectIncident: (incident: Incident) => void;
}

export default function IncidentFeedPanel({
  incidents,
  selectedIncidentId,
  onSelectIncident,
}: IncidentFeedPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef<number>(incidents.length);
  const [timeTick, setTimeTick] = useState(0);

  // Trigger re-render of timestamps every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeTick((t) => t + 1);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Sort incidents by created_at descending (newest at the top)
  const sortedIncidents = [...incidents].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Auto-scroll to top when a new incident is created
  useEffect(() => {
    if (incidents.length > prevLengthRef.current) {
      if (containerRef.current) {
        containerRef.current.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
    prevLengthRef.current = incidents.length;
  }, [incidents.length]);

  function getIncidentIcon(type: string) {
    switch (type) {
      case "Flood Warning":
        return <CloudRain className="h-4 w-4 text-blue-400" />;
      case "Landslide":
        return <AlertTriangle className="h-4 w-4 text-red-400" />;
      case "Road Closure":
        return <Ban className="h-4 w-4 text-zinc-400" />;
      case "Weather Advisory":
        return <CloudLightning className="h-4 w-4 text-amber-400" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-amber-400" />;
    }
  }

  function getIncidentIconBg(type: string) {
    switch (type) {
      case "Flood Warning":
        return "bg-blue-950/60 border border-blue-800/50";
      case "Landslide":
        return "bg-red-950/60 border border-red-800/50";
      case "Road Closure":
        return "bg-zinc-900 border border-zinc-800";
      case "Weather Advisory":
        return "bg-amber-950/60 border border-amber-800/50";
      default:
        return "bg-zinc-900 border border-zinc-800";
    }
  }

  function getSeverityStyle(severity: string) {
    switch (severity.toUpperCase()) {
      case "LOW":
        return "bg-emerald-950/80 border border-emerald-700 text-emerald-400";
      case "MEDIUM":
        return "bg-amber-950/80 border border-amber-700 text-amber-400";
      case "HIGH":
        return "bg-orange-950/80 border border-orange-700 text-orange-400";
      case "CRITICAL":
        return "bg-red-950/80 border border-red-700 text-red-400 animate-pulse";
      default:
        return "bg-zinc-800 border border-zinc-700 text-zinc-300";
    }
  }

  function getRelativeTime(isoString: string) {
    if (!isoString) return "";
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    
    if (diffSecs < 10) return "just now";
    if (diffSecs < 60) return `${diffSecs}s ago`;
    
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div 
        ref={containerRef} 
        className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[420px] lg:max-h-none"
      >
        {sortedIncidents.map((incident) => {
          const isSelected = incident.id === selectedIncidentId;
          const isCritical = incident.severity.toUpperCase() === "CRITICAL";
          
          return (
            <div
              key={incident.id}
              onClick={() => onSelectIncident(incident)}
              className={`p-3 rounded-lg border text-left cursor-pointer transition-all duration-200 ${
                isSelected
                  ? "bg-zinc-900 border-zinc-600 shadow-md scale-[1.01]"
                  : "bg-zinc-900/40 border-zinc-900 hover:border-zinc-800 hover:bg-zinc-900/60"
              } ${isCritical && !isSelected ? "ring-1 ring-red-500/20" : ""}`}
            >
              <div className="flex justify-between items-start gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded ${getIncidentIconBg(incident.type)}`}>
                    {getIncidentIcon(incident.type)}
                  </div>
                  <div>
                    <h3 className="font-bold text-xs tracking-tight text-zinc-100 line-clamp-1">
                      {incident.title}
                    </h3>
                    <span className="text-[9px] text-zinc-500 font-mono">
                      {incident.id} • {incident.affected_routes.join(", ") || "All Routes"}
                    </span>
                  </div>
                </div>
                <span className={`text-[8px] font-black tracking-wider px-2 py-0.5 rounded-full ${getSeverityStyle(incident.severity)}`}>
                  {incident.severity}
                </span>
              </div>

              <p className="text-[11px] text-zinc-400 line-clamp-2 mb-2.5 pl-0.5 leading-relaxed">
                {incident.description}
              </p>

              <div className="flex items-center justify-between text-[10px] pl-0.5 border-t border-zinc-800/50 pt-2 text-zinc-500">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-zinc-600" />
                  <span>{getRelativeTime(incident.created_at)}</span>
                </span>
                <span className={incident.estimated_delay_minutes > 0 ? "text-amber-500 font-bold" : "text-emerald-500"}>
                  +{incident.estimated_delay_minutes} min delay
                </span>
              </div>
            </div>
          );
        })}

        {sortedIncidents.length === 0 && (
          <div className="flex flex-col items-center justify-center p-8 text-center text-zinc-500 h-64">
            <Info className="h-8 w-8 mb-2 opacity-50 text-emerald-500" />
            <span className="text-xs text-zinc-400 font-bold">No active incidents</span>
            <span className="text-[10px] text-zinc-600 mt-1">Traffic is flowing smoothly.</span>
          </div>
        )}
      </div>
    </div>
  );
}
