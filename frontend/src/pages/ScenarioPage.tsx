import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { api } from "@/lib/api";
import { useBusesWebSocket } from "@/hooks/useBusesWebSocket";
import type { Route, Terminal, Incident, CorridorStatusResponse } from "@/types";
import {
  MapPin, AlertTriangle, ShieldAlert, Clock, TriangleAlert,
  Plus, Trash2, X,
} from "lucide-react";

export default function ScenarioPage() {
  const { buses, incidents, isConnected, scenarioActive, activeScenario } = useBusesWebSocket();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Add incident form state
  const [incType, setIncType] = useState("Road Closure");
  const [incSeverity, setIncSeverity] = useState("MEDIUM");
  const [incRouteId, setIncRouteId] = useState<number>(1);
  const [incDelay, setIncDelay] = useState(15);
  const [incDuration, setIncDuration] = useState("30");

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  const routesAddedRef = useRef<boolean>(false);
  const terminalsAddedRef = useRef<boolean>(false);
  const busMarkersRef = useRef<{ [id: number]: maplibregl.Marker }>({});
  const busPopupsRef = useRef<{ [id: number]: maplibregl.Popup }>({});
  const incidentMarkersRef = useRef<{ [id: string]: maplibregl.Marker }>({});

  function displayRouteName(routeName: string | undefined, direction: boolean | undefined): string {
    if (!routeName) return "Unknown";
    if (direction === false) {
      const parts = routeName.split(" → ");
      if (parts.length === 2) return `${parts[1]} → ${parts[0]}`;
    }
    return routeName;
  }

  function getBusColor(status: string): string {
    const s = status.toLowerCase().replace(/[\s_]/g, "_");
    if (s === "stopped") return "#71717a";
    if (s === "severely_delayed" || s === "closed") return "#ef4444";
    if (s === "delayed" || s === "minor_delay") return "#f59e0b";
    return "#10b981";
  }

  // 1. Fetch initial data
  useEffect(() => {
    async function fetchData() {
      try {
        const [routesData, terminalsData] = await Promise.all([
          api.get<Route[]>("/api/routes"),
          api.get<Terminal[]>("/api/terminals"),
        ]);
        setRoutes(routesData);
        setTerminals(terminalsData);
        if (routesData.length > 0) {
          setSelectedRouteId(routesData[0].id);
          setIncRouteId(routesData[0].id);
        }
      } catch (err) {
        console.error("Error fetching initial data:", err);
      }
    }
    fetchData();
  }, []);

  // 2. Countdown Timer for active scenario expiration
  useEffect(() => {
    if (!scenarioActive || !activeScenario?.expires_at) {
      setCountdown(null);
      return;
    }
    const updateTimer = () => {
      const msLeft = new Date(activeScenario.expires_at).getTime() - Date.now();
      if (msLeft <= 0) {
        setCountdown(0);
      } else {
        setCountdown(Math.ceil(msLeft / 1000));
      }
    };
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [scenarioActive, activeScenario]);

  // 3. Initialize Map
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
    mapInstance.on("load", () => setIsMapLoaded(true));
    setMap(mapInstance);
    return () => mapInstance.remove();
  }, []);

  // 4. Draw route lines
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
          geometry: { type: "LineString", coordinates: coords },
        },
      });
      map.addLayer({
        id: `route-layer-${route.id}`,
        type: "line",
        source: `route-${route.id}`,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": route.color, "line-width": 4, "line-opacity": 0.7 },
      });
      map.addLayer({
        id: `route-click-layer-${route.id}`,
        type: "line",
        source: `route-${route.id}`,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "transparent", "line-width": 15 },
      });
      map.on("click", `route-click-layer-${route.id}`, () => setSelectedRouteId(route.id));
      map.on("mouseenter", `route-click-layer-${route.id}`, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", `route-click-layer-${route.id}`, () => { map.getCanvas().style.cursor = ""; });
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
        .replace(" Terminal", "").replace(" City Overland", "")
        .replace(" Multi-Purpose", "").replace(" Bus", "").toUpperCase();
      el.innerHTML = `
        <div class="h-2 w-2 rounded-full bg-amber-500 ring-4 ring-amber-500/25"></div>
        <span class="mt-1 text-[8px] font-black tracking-widest text-amber-500 drop-shadow select-none bg-zinc-950/80 px-1 py-0.5 rounded border border-zinc-800">
          ${shortName}
        </span>
      `;
      new maplibregl.Marker({ element: el })
        .setLngLat([terminal.lng, terminal.lat])
        .addTo(map);
    });
    terminalsAddedRef.current = true;
  }, [map, isMapLoaded, terminals]);

  // 6. Update route styling for active scenario
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
          map.setPaintProperty(layerId, "line-dasharray", [1, 0]);
        }
      }
    });
  }, [map, isMapLoaded, routes, activeScenario]);

  // 7. Update Bus Markers
  useEffect(() => {
    if (!map || !isMapLoaded || routes.length === 0) return;
    buses.forEach((bus) => {
      if (bus.current_lng == null || bus.current_lat == null) return;
      const existingMarker = busMarkersRef.current[bus.id];
      const route = routes.find((r) => r.id === bus.route_id);
      if (existingMarker) {
        existingMarker.setLngLat([bus.current_lng, bus.current_lat]);
        const el = existingMarker.getElement();
        const arrow = el.querySelector(".bus-marker-arrow") as HTMLElement;
        if (arrow) arrow.style.transform = `rotate(${bus.bearing ?? 0}deg)`;
        const dot = el.querySelector(".bus-marker-dot") as HTMLElement;
        if (dot) {
          dot.style.backgroundColor = getBusColor(bus.status);
        }
        const existingPopup = busPopupsRef.current[bus.id];
        if (existingPopup) {
          const popupColor = getBusColor(bus.status);
          const routeLabel = displayRouteName(route?.name, bus.direction);
          existingPopup.setHTML(`
            <div class="p-3 text-xs bg-zinc-950 text-zinc-100 rounded-lg border border-zinc-800 shadow-xl max-w-[220px]">
              <div class="font-bold border-b border-zinc-800 pb-1 mb-2 text-sm text-amber-500">${bus.name}</div>
              <div class="space-y-1">
                <div><span class="text-zinc-500">Route:</span> ${routeLabel}</div>
                <div><span class="text-zinc-500">Speed:</span> ${bus.speed} km/h</div>
                <div><span class="text-zinc-500">Occupancy:</span> ${bus.occupancy}/${bus.capacity}</div>
                <div><span class="text-zinc-500">Status:</span> <span class="font-bold uppercase text-[10px]" style="color:${popupColor}">${bus.status}</span></div>
              </div>
            </div>
          `);
        }
      } else {
        const color = getBusColor(bus.status);
        const el = document.createElement("div");
        el.className = "cursor-pointer group";
        const dot = document.createElement("div");
        dot.className = "bus-marker-dot relative flex items-center justify-center h-4.5 w-4.5 rounded-full border border-black shadow-lg transition-all duration-300";
        dot.style.backgroundColor = color;
        const arrow = document.createElement("div");
        arrow.className = "bus-marker-arrow w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[7px] border-b-black -mt-[1px] transition-transform duration-300";
        arrow.style.transform = `rotate(${bus.bearing ?? 0}deg)`;
        dot.appendChild(arrow);
        el.appendChild(dot);
        const popupColor = getBusColor(bus.status);
        const routeLabel = displayRouteName(route?.name, bus.direction);
        const popup = new maplibregl.Popup({ offset: 12, closeButton: false }).setHTML(`
          <div class="p-3 text-xs bg-zinc-950 text-zinc-100 rounded-lg border border-zinc-800 shadow-xl max-w-[220px]">
            <div class="font-bold border-b border-zinc-800 pb-1 mb-2 text-sm text-amber-500">${bus.name}</div>
            <div class="space-y-1">
              <div><span class="text-zinc-500">Route:</span> ${routeLabel}</div>
              <div><span class="text-zinc-500">Speed:</span> ${bus.speed} km/h</div>
              <div><span class="text-zinc-500">Occupancy:</span> ${bus.occupancy}/${bus.capacity}</div>
              <div><span class="text-zinc-500">Status:</span> <span class="font-bold uppercase text-[10px]" style="color:${popupColor}">${bus.status}</span></div>
            </div>
          </div>
        `);
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([bus.current_lng, bus.current_lat])
          .setPopup(popup)
          .addTo(map);
        busPopupsRef.current[bus.id] = popup;
        el.addEventListener("mouseenter", () => popup.addTo(map));
        el.addEventListener("mouseleave", () => popup.remove());
        el.addEventListener("click", () => setSelectedRouteId(bus.route_id));
        busMarkersRef.current[bus.id] = marker;
      }
    });
    const activeIds = new Set(buses.map((b) => b.id));
    Object.keys(busMarkersRef.current).forEach((idStr) => {
      const id = parseInt(idStr, 10);
      if (!activeIds.has(id)) {
        busMarkersRef.current[id].remove();
        delete busMarkersRef.current[id];
        delete busPopupsRef.current[id];
      }
    });
  }, [map, isMapLoaded, buses, routes]);

  // 8. Update Incident Markers
  useEffect(() => {
    if (!map || !isMapLoaded) return;
    incidents.forEach((incident) => {
      if (incident.longitude == null || incident.latitude == null) return;
      const existingMarker = incidentMarkersRef.current[incident.id];
      let color = "#ef4444";
      if (incident.type === "Flood Warning") color = "#3b82f6";
      else if (incident.type === "Road Closure") color = "#71717a";
      else if (incident.type === "Weather Advisory") color = "#f97316";
      if (existingMarker) {
        existingMarker.setLngLat([incident.longitude, incident.latitude]);
      } else {
        const el = document.createElement("div");
        el.className = "cursor-pointer group transition-all duration-300";
        el.innerHTML = `
          <div style="position:relative;display:flex;align-items:center;justify-content:center;width:48px;height:48px;">
            <div style="position:absolute;width:48px;height:48px;border-radius:50%;background-color:${color};opacity:0.15;animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
            <div style="position:absolute;width:32px;height:32px;border-radius:50%;background-color:${color};opacity:0.25;animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;animation-delay:0.5s;"></div>
            <div style="position:absolute;width:20px;height:20px;border-radius:50%;background-color:${color};opacity:0.5;filter:blur(4px);"></div>
            <div style="position:relative;width:16px;height:16px;border-radius:50%;background-color:${color};border:2px solid rgba(0,0,0,0.6);box-shadow:0 0 0 2px ${color}66, 0 4px 12px ${color}99;display:flex;align-items:center;justify-content:center;">
              <div style="width:6px;height:6px;border-radius:50%;background:white;opacity:0.9;"></div>
            </div>
          </div>
        `;
        const popup = new maplibregl.Popup({ offset: 12, closeButton: false }).setHTML(`
          <div class="p-3 text-xs bg-zinc-950 text-zinc-100 rounded-lg border border-zinc-800 shadow-xl max-w-[200px]">
            <div class="font-bold border-b border-zinc-800 pb-1 mb-2 text-sm text-zinc-200">${incident.title}</div>
            <div class="space-y-1">
              <div><span class="text-zinc-500">Type:</span> ${incident.type}</div>
              <div><span class="text-zinc-500">Severity:</span> <span class="font-bold uppercase text-[10px]" style="color:${color}">${incident.severity}</span></div>
              <div><span class="text-zinc-500">Delay:</span> <span class="font-bold text-amber-500">${incident.estimated_delay_minutes} min</span></div>
              <div class="text-[10px] text-zinc-400 mt-1.5 border-t border-zinc-900 pt-1 leading-relaxed">${incident.description}</div>
            </div>
          </div>
        `);
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([incident.longitude, incident.latitude])
          .setPopup(popup)
          .addTo(map);
        el.addEventListener("mouseenter", () => popup.addTo(map));
        el.addEventListener("mouseleave", () => popup.remove());
        incidentMarkersRef.current[incident.id] = marker;
      }
    });
    const activeIds = new Set(incidents.map((i) => i.id));
    Object.keys(incidentMarkersRef.current).forEach((id) => {
      if (!activeIds.has(id)) {
        incidentMarkersRef.current[id].remove();
        delete incidentMarkersRef.current[id];
      }
    });
  }, [map, isMapLoaded, incidents]);

  const handleAddIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    const route = routes.find(r => r.id === incRouteId);
    if (!route || !route.waypoints || route.waypoints.length === 0) return;
    const midIdx = Math.floor(route.waypoints.length / 2);
    const midPoint = route.waypoints[midIdx];
    const parsedDuration = incDuration ? parseInt(incDuration, 10) : null;
    const body = {
      incident_type: incType,
      severity: incSeverity,
      title: `[Manual] ${incType} on ${route.name}`,
      description: `Custom ${incType.toLowerCase()} affecting ${route.name} corridor.`,
      lat: midPoint[0],
      lng: midPoint[1],
      affected_route_id: incRouteId,
      estimated_delay_min: incDelay,
      duration_minutes: parsedDuration && !isNaN(parsedDuration) ? parsedDuration : null,
    };
    try {
      await api.createIncident(body);
      setShowForm(false);
    } catch (err) {
      console.error("Failed to create incident:", err);
      alert("Failed to add incident. Make sure all fields are valid.");
    }
  };

  const handleDeleteIncident = async (id: string) => {
    try {
      await api.deleteIncident(id);
    } catch (err) {
      console.error("Failed to delete incident:", err);
    }
  };

  const activeBusesCount = buses.filter(b => {
    const s = b.status.toLowerCase().replace(/[\s_]/g, "_");
    return s !== "stopped";
  }).length || buses.length;

  return (
    <div className="flex flex-col h-full gap-4 text-zinc-100">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-black text-amber-500 tracking-tight">
            What-If Scenario Simulator
          </h1>
          <p className="text-xs text-zinc-400">
            Add and remove incidents to simulate disruptions across {routes.length} intercity corridors.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-[10px] text-zinc-400">
            <div className={`h-1.5 w-1.5 rounded-full inline-block mr-1.5 ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}></div>
            <span>{isConnected ? "Live GPS" : "Offline"}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Map & Side Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-[380px] overflow-hidden">
        {/* Map Container */}
        <div className="lg:col-span-2 flex flex-col bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden relative group">
          <div className="absolute top-3 left-3 z-10 bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded px-3 py-1.5 text-[10px] font-bold text-zinc-300 flex items-center gap-1.5 shadow-lg shadow-black/50">
            <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping"></div>
            <span>Mindanao Network • Scenario Map</span>
          </div>

          <div ref={mapContainerRef} className="w-full flex-1 min-h-[300px] h-full" />

          {scenarioActive && activeScenario && (
            <div className="absolute top-3 right-3 z-10">
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

          {/* Stats bar */}
          <div className="absolute bottom-3 left-3 z-10 flex gap-2">
            <div className="bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded px-4 py-2 flex flex-col shadow-lg shadow-black/50">
              <span className="text-[18px] font-black text-amber-500 leading-none">{buses.length || 50}</span>
              <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider mt-1">Active Units</span>
            </div>
            <div className="bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded px-4 py-2 flex flex-col shadow-lg shadow-black/50">
              <span className="text-[18px] font-black text-zinc-100 leading-none">{routes.length || 5}</span>
              <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider mt-1">Corridors</span>
            </div>
            <div className="bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded px-4 py-2 flex flex-col shadow-lg shadow-black/50">
              <span className="text-[18px] font-black text-red-500 leading-none">{incidents.length}</span>
              <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider mt-1">Incidents</span>
            </div>
          </div>
        </div>

        {/* Right Side Panel */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl flex flex-col overflow-hidden max-h-[500px] lg:max-h-none">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
            <div className="flex items-center gap-2">
              <TriangleAlert className="h-4 w-4 text-red-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">Incidents</span>
              <span className={`px-1.5 py-0.5 text-[9px] font-black rounded-full leading-none ${
                incidents.length > 0 ? "bg-red-500 text-white" : "bg-zinc-800 text-zinc-500"
              }`}>
                {incidents.length}
              </span>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1 text-[10px] font-bold text-amber-500 hover:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1 transition-all"
            >
              {showForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              {showForm ? "Cancel" : "Add"}
            </button>
          </div>

          {/* Add Incident Form */}
          {showForm && (
            <form onSubmit={handleAddIncident} className="p-3 border-b border-zinc-800 bg-zinc-900/30 space-y-2.5 shrink-0">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Type</label>
                  <select
                    value={incType}
                    onChange={(e) => setIncType(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50"
                  >
                    <option>Road Closure</option>
                    <option>Landslide</option>
                    <option>Flood Warning</option>
                    <option>Weather Advisory</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Severity</label>
                  <select
                    value={incSeverity}
                    onChange={(e) => setIncSeverity(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Corridor</label>
                  <select
                    value={incRouteId}
                    onChange={(e) => setIncRouteId(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50"
                  >
                    {routes.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Delay (min)</label>
                  <input
                    type="number"
                    value={incDelay}
                    onChange={(e) => setIncDelay(Number(e.target.value))}
                    min={1}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Duration (min, optional)</label>
                <input
                  type="text"
                  value={incDuration}
                  onChange={(e) => setIncDuration(e.target.value.replace(/\D/g, ""))}
                  placeholder="Permanent"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-bold rounded py-1.5 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add Incident
              </button>
            </form>
          )}

          {/* Incident List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {incidents.length === 0 && !showForm && (
              <div className="flex flex-col items-center justify-center p-8 text-center text-zinc-500 h-full">
                <AlertTriangle className="h-8 w-8 mb-2 opacity-50" />
                <span className="text-xs">No active incidents.</span>
                <span className="text-[10px] text-zinc-600 mt-1">Click "Add" to simulate a disruption.</span>
              </div>
            )}
            {incidents.map((incident) => {
              const incColor =
                incident.type === "Flood Warning" ? "#3b82f6" :
                incident.type === "Road Closure" ? "#71717a" :
                incident.type === "Weather Advisory" ? "#f97316" : "#ef4444";
              const routeName = incident.affected_routes?.[0] || "Unknown";
              const isManual = incident.title.startsWith("[Manual]");
              return (
                <div
                  key={incident.id}
                  className="p-2.5 rounded-lg border bg-zinc-900/40 border-zinc-900 hover:border-zinc-800 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: incColor }} />
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-zinc-200 truncate">{incident.title}</div>
                        <div className="text-[9px] text-zinc-500 mt-0.5">
                          {incident.type} · {incident.severity} · +{incident.estimated_delay_minutes} min
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[8px] text-zinc-600 font-medium">{routeName}</span>
                          {isManual && (
                            <span className="text-[8px] font-bold text-amber-500 bg-amber-500/10 px-1 rounded">MANUAL</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteIncident(incident.id)}
                      className="text-zinc-500 hover:text-red-400 transition-colors shrink-0 p-1"
                      title="Delete incident"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}