import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { api } from "@/lib/api";
import { useBusesWebSocket } from "@/hooks/useBusesWebSocket";
import type { Route, Terminal, ScenarioPreset, ScenarioResult } from "@/types";
import { ShieldAlert } from "lucide-react";
import ScenarioPanel from "@/components/panels/ScenarioPanel";
import ScenarioPresets from "@/components/panels/ScenarioPresets";

export default function ScenarioPage() {
  const { buses, isConnected, scenarioActive, activeScenario } = useBusesWebSocket();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [presets, setPresets] = useState<ScenarioPreset[]>([]);
  
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [presetResult, setPresetResult] = useState<ScenarioResult | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  const routesAddedRef = useRef<boolean>(false);
  const terminalsAddedRef = useRef<boolean>(false);
  const busMarkersRef = useRef<Record<number, maplibregl.Marker>>({});
  const terminalElementsRef = useRef<Record<number, HTMLDivElement>>({});

  // 1. Fetch initial data
  useEffect(() => {
    async function fetchData() {
      try {
        const [routesData, terminalsData, presetsData] = await Promise.all([
          api.get<Route[]>("/api/routes"),
          api.get<Terminal[]>("/api/terminals"),
          api.getScenarioPresets(),
        ]);
        setRoutes(routesData);
        setTerminals(terminalsData);
        setPresets(presetsData.presets);
      } catch (err) {
        console.error("Error fetching scenario initial data:", err);
      }
    }
    fetchData();
  }, []);

  // 2. Countdown Timer for active scenario expiration
  useEffect(() => {
    if (!scenarioActive || !activeScenario?.expires_at) {
      setCountdown(null);
      setIsApplying(false);
      return;
    }
    setIsApplying(true);

    const updateTimer = () => {
      const msLeft = new Date(activeScenario.expires_at).getTime() - Date.now();
      if (msLeft <= 0) {
        setCountdown(0);
        setIsApplying(false);
      } else {
        setCountdown(Math.ceil(msLeft / 1000));
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [scenarioActive, activeScenario]);

  // 3. Initialize MapLibre GL
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainerRef.current,
      style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      center: [125.68, 7.15],
      zoom: 7.8,
      minZoom: 6,
      maxZoom: 12,
    });

    mapInstance.on("load", () => {
      setIsMapLoaded(true);
    });

    setMap(mapInstance);

    return () => {
      mapInstance.remove();
    };
  }, []);

  // 4. Draw route polylines
  useEffect(() => {
    if (!map || !isMapLoaded || routes.length === 0 || routesAddedRef.current) return;

    routes.forEach((route) => {
      if (!route.waypoints || route.waypoints.length === 0) return;
      const coords = route.waypoints.map((w: number[]) => [w[1], w[0]]);

      map.addSource(`route-${route.id}`, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: coords,
          },
        },
      });

      map.addLayer({
        id: `route-layer-${route.id}`,
        type: "line",
        source: `route-${route.id}`,
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": route.color,
          "line-width": 4,
          "line-opacity": 0.75,
        },
      });
    });

    routesAddedRef.current = true;
  }, [map, isMapLoaded, routes]);

  // 5. Draw terminal markers
  useEffect(() => {
    if (!map || !isMapLoaded || terminals.length === 0 || terminalsAddedRef.current) return;

    terminals.forEach((terminal) => {
      const el = document.createElement("div");
      el.className = "flex flex-col items-center pointer-events-none";

      const shortName = terminal.name
        .replace(" Terminal", "")
        .replace(" City Overland", "")
        .replace(" Multi-Purpose", "")
        .replace(" Bus", "")
        .toUpperCase();

      el.innerHTML = `
        <div class="terminal-dot h-2 w-2 rounded-full bg-amber-500 ring-4 ring-amber-500/25 transition-all duration-300"></div>
        <span class="mt-1 text-[8px] font-black tracking-widest text-amber-500/80 drop-shadow select-none bg-zinc-950/80 px-1 py-0.5 rounded border border-zinc-800">
          ${shortName}
        </span>
      `;

      terminalElementsRef.current[terminal.id] = el;

      new maplibregl.Marker({ element: el })
        .setLngLat([terminal.lng, terminal.lat])
        .addTo(map);
    });

    terminalsAddedRef.current = true;
  }, [map, isMapLoaded, terminals]);

  // 6. Update routes styling dynamically when a scenario is active
  useEffect(() => {
    if (!map || !isMapLoaded || routes.length === 0) return;

    const kidapawanRouteId = routes.find(r => r.name === "Davao → Kidapawan")?.id;
    const matiRouteId = routes.find(r => r.name === "Davao → Mati")?.id;

    routes.forEach((route) => {
      const isClosed =
        (activeScenario?.type === "route_closure" && activeScenario?.affected_route_ids?.includes(route.id)) ||
        (activeScenario?.type === "combined" && activeScenario?.scenario_id?.includes("landslide") && route.id === kidapawanRouteId) ||
        (activeScenario?.type === "combined" && activeScenario?.scenario_id?.includes("typhoon") && route.id === matiRouteId);

      const layerId = `route-layer-${route.id}`;
      if (map.getLayer(layerId)) {
        if (isClosed) {
          map.setPaintProperty(layerId, "line-color", "#ef4444");
          map.setPaintProperty(layerId, "line-width", 6);
          map.setPaintProperty(layerId, "line-dasharray", [2, 2]);
        } else {
          map.setPaintProperty(layerId, "line-color", route.color);
          map.setPaintProperty(layerId, "line-width", 4);
          map.setPaintProperty(layerId, "line-dasharray", [1, 0]); // solid
        }
      }
    });
  }, [map, isMapLoaded, routes, activeScenario]);

  // 7. Update terminal styling dynamically when a scenario is active
  useEffect(() => {
    if (terminals.length === 0) return;

    const kidapawanRouteId = routes.find(r => r.name === "Davao → Kidapawan")?.id;
    const matiRouteId = routes.find(r => r.name === "Davao → Mati")?.id;

    terminals.forEach((terminal) => {
      const el = terminalElementsRef.current[terminal.id];
      if (!el) return;

      const isClosed =
        (activeScenario?.type === "route_closure" && activeScenario?.affected_route_ids?.includes(terminal.route_id)) ||
        (activeScenario?.type === "combined" && activeScenario?.scenario_id?.includes("landslide") && terminal.route_id === kidapawanRouteId) ||
        (activeScenario?.type === "combined" && activeScenario?.scenario_id?.includes("typhoon") && terminal.route_id === matiRouteId);

      const dot = el.querySelector(".terminal-dot") as HTMLElement;
      if (dot) {
        if (isClosed) {
          dot.className = "terminal-dot h-3 w-3 rounded-full bg-red-500 ring-4 ring-red-500/35 animate-pulse transition-all duration-300";
        } else {
          dot.className = "terminal-dot h-2 w-2 rounded-full bg-amber-500 ring-4 ring-amber-500/25 transition-all duration-300";
        }
      }
    });
  }, [terminals, routes, activeScenario]);

  // 8. Update Bus Markers dynamically
  useEffect(() => {
    if (!map || !isMapLoaded || routes.length === 0) return;

    buses.forEach((bus) => {
      if (bus.current_lng == null || bus.current_lat == null) return;
      const existingMarker = busMarkersRef.current[bus.id];

      if (existingMarker) {
        existingMarker.setLngLat([bus.current_lng, bus.current_lat]);
        const el = existingMarker.getElement();
        const dot = el.querySelector(".bus-marker-dot") as HTMLElement;
        
        if (dot) {
          if (bus.status === "STOPPED" || bus.status === "CLOSED") {
            dot.className = "bus-marker-dot relative flex items-center justify-center h-5 w-5 rounded-full bg-red-500 border border-black shadow-lg ring-4 ring-red-500/40 animate-pulse transition-all duration-300";
            dot.innerHTML = `<span class="text-[9px] font-black text-black">!</span>`;
          } else if (bus.status === "delayed" || bus.status === "DELAYED") {
            dot.className = "bus-marker-dot relative flex items-center justify-center h-4.5 w-4.5 rounded-full bg-amber-500 border border-black shadow transition-all duration-300";
            dot.innerHTML = `<div class="bus-marker-arrow w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[7px] border-b-black -mt-[1px] transition-transform duration-300"></div>`;
            const arrow = dot.querySelector(".bus-marker-arrow") as HTMLElement;
            if (arrow) arrow.style.transform = `rotate(${bus.bearing ?? 0}deg)`;
          } else {
            dot.className = "bus-marker-dot relative flex items-center justify-center h-4.5 w-4.5 rounded-full bg-emerald-500 border border-black shadow transition-all duration-300";
            dot.innerHTML = `<div class="bus-marker-arrow w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[7px] border-b-black -mt-[1px] transition-transform duration-300"></div>`;
            const arrow = dot.querySelector(".bus-marker-arrow") as HTMLElement;
            if (arrow) arrow.style.transform = `rotate(${bus.bearing ?? 0}deg)`;
          }
        }
      } else {
        const el = document.createElement("div");
        el.className = "cursor-pointer group";

        const dot = document.createElement("div");
        if (bus.status === "STOPPED" || bus.status === "CLOSED") {
          dot.className = "bus-marker-dot relative flex items-center justify-center h-5 w-5 rounded-full bg-red-500 border border-black shadow-lg ring-4 ring-red-500/40 animate-pulse transition-all duration-300";
          dot.innerHTML = `<span class="text-[9px] font-black text-black">!</span>`;
        } else if (bus.status === "delayed" || bus.status === "DELAYED") {
          dot.className = "bus-marker-dot relative flex items-center justify-center h-4.5 w-4.5 rounded-full bg-amber-500 border border-black shadow transition-all duration-300";
          dot.innerHTML = `<div class="bus-marker-arrow w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[7px] border-b-black -mt-[1px] transition-transform duration-300"></div>`;
          const arrow = dot.querySelector(".bus-marker-arrow") as HTMLElement;
          if (arrow) arrow.style.transform = `rotate(${bus.bearing ?? 0}deg)`;
        } else {
          dot.className = "bus-marker-dot relative flex items-center justify-center h-4.5 w-4.5 rounded-full bg-emerald-500 border border-black shadow transition-all duration-300";
          dot.innerHTML = `<div class="bus-marker-arrow w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[7px] border-b-black -mt-[1px] transition-transform duration-300"></div>`;
          const arrow = dot.querySelector(".bus-marker-arrow") as HTMLElement;
          if (arrow) arrow.style.transform = `rotate(${bus.bearing ?? 0}deg)`;
        }

        el.appendChild(dot);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([bus.current_lng, bus.current_lat])
          .addTo(map);

        busMarkersRef.current[bus.id] = marker;
      }
    });

    // Cleanup stale/orphaned markers
    const activeIds = new Set(buses.map((b) => b.id));
    Object.keys(busMarkersRef.current).forEach((idStr) => {
      const id = parseInt(idStr, 10);
      if (!activeIds.has(id)) {
        busMarkersRef.current[id].remove();
        delete busMarkersRef.current[id];
      }
    });
  }, [map, isMapLoaded, buses, routes]);

  const handleSelectPreset = async (preset: ScenarioPreset) => {
    setSelectedPresetId(preset.id);
    setPresetResult(null);

    const body = {
      type: preset.type,
      parameters: preset.parameters as any
    };

    try {
      const data = await api.simulateScenario(body);
      setPresetResult(data);
    } catch (err) {
      console.error("Failed to simulate preset scenario:", err);
    }
  };

  const handleApplyScenario = async (result: ScenarioResult, durationSeconds: number) => {
    try {
      await api.applyScenario(result.scenario_id, durationSeconds);
      setIsApplying(true);
    } catch (err) {
      console.error("Failed to apply scenario overrides:", err);
    }
  };

  const handleResetScenario = async () => {
    try {
      await api.resetScenario();
      setPresetResult(null);
      setSelectedPresetId(null);
      setIsApplying(false);
      setCountdown(null);
    } catch (err) {
      console.error("Failed to reset scenario overrides:", err);
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 text-zinc-100">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-black text-amber-500 tracking-tight">
            What-If Scenario Simulator
          </h1>
          <p className="text-xs text-zinc-400">
            Simulate regional transit disruptions and evaluate AI-generated mitigations.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-[10px] text-zinc-400">
            <div className={`h-1.5 w-1.5 rounded-full inline-block mr-1.5 ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}></div>
            <span>{isConnected ? "Connected" : "Offline"}</span>
          </div>
        </div>
      </div>

      {/* Main Grid Layout matching CorridorMonitor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-[380px] overflow-hidden">
        {/* Map Container */}
        <div className="lg:col-span-2 flex flex-col bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden relative group">
          <div className="absolute top-3 left-3 z-10 bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded px-3 py-1.5 text-[10px] font-bold text-zinc-300 flex items-center gap-1.5 shadow-lg shadow-black/50">
            <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping"></div>
            <span>Mindanao Network • Scenario Map</span>
          </div>

          <div ref={mapContainerRef} className="w-full flex-1 min-h-[300px] h-full" />

          {scenarioActive && activeScenario && (
            <div className="absolute top-3 right-3 z-10 animate-slide-in">
              <div className="flex items-center gap-3 rounded-lg border border-red-900/50 bg-red-950/80 text-red-200 px-4 py-2 text-xs font-semibold backdrop-blur-sm shadow-lg shadow-red-950/40">
                <ShieldAlert className="h-4.5 w-4.5 text-red-500 animate-bounce" />
                <div className="space-y-0.5">
                  <div className="uppercase tracking-wider">Simulation Disruption Active</div>
                  <div className="text-[10px] text-red-400 font-light">
                    Countdown: <span className="font-mono text-zinc-100 font-bold bg-red-900/50 px-1 py-0.5 rounded">{countdown ?? 0}s</span> remaining
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Control Panel Container */}
        <div className="flex flex-col bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden h-full">
          {/* Preset Selectors row */}
          <div className="p-4 border-b border-zinc-900 bg-zinc-950/30">
            <ScenarioPresets
              presets={presets}
              onSelectPreset={handleSelectPreset}
              selectedPresetId={selectedPresetId}
              disabled={isApplying}
            />
          </div>
          
          {/* Custom Panel Form and results */}
          <div className="flex-1 overflow-hidden">
            <ScenarioPanel
              routes={routes}
              activeScenarioId={activeScenario?.scenario_id || null}
              onApply={handleApplyScenario}
              onReset={handleResetScenario}
              isApplying={isApplying}
              onSelectPreset={setSelectedPresetId}
              presetResult={presetResult}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
