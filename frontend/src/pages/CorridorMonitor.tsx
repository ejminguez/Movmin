import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { api } from "@/lib/api";
import { useBusesWebSocket } from "@/hooks/useBusesWebSocket";
import type { Route, Terminal, Incident, CorridorStatusResponse, BusETAResponse } from "@/types";
import {
  MapPin, Info, ArrowUpRight, CheckCircle2, AlertTriangle, AlertCircle, Clock, TriangleAlert,
} from "lucide-react";
import ETAPanel from "@/components/ETAPanel";
import IncidentFeedPanel from "@/components/IncidentFeedPanel";
import IncidentDetailCard from "@/components/IncidentDetailCard";

export default function CorridorMonitor() {
  const { buses, incidents, isConnected } = useBusesWebSocket();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [corridors, setCorridors] = useState<CorridorStatusResponse[]>([]);
  const [busEtas, setBusEtas] = useState<Record<number, BusETAResponse>>({});
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"corridors" | "incidents">("corridors");
  const [lastSynced, setLastSynced] = useState<Date>(new Date());
  const [showEtaPanel, setShowEtaPanel] = useState(false);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  
  const routesAddedRef = useRef<boolean>(false);
  const terminalsAddedRef = useRef<boolean>(false);
  const busMarkersRef = useRef<{ [id: number]: maplibregl.Marker }>({});
  const busPopupsRef = useRef<{ [id: number]: maplibregl.Popup }>({});
  const incidentMarkersRef = useRef<{ [id: string]: maplibregl.Marker }>({});

  // 1. Fetch initial data
  useEffect(() => {
    async function fetchData() {
      try {
        const [routesData, terminalsData, corridorsData] = await Promise.all([
          api.get<Route[]>("/api/routes"),
          api.get<Terminal[]>("/api/terminals"),
          api.get<CorridorStatusResponse[]>("/api/corridors/status"),
        ]);
        setRoutes(routesData);
        setTerminals(terminalsData);
        setCorridors(corridorsData);
        if (corridorsData.length > 0) {
          setSelectedRouteId(corridorsData[0].route_id);
        }
        setLastSynced(new Date());
      } catch (err) {
        console.error("Error fetching initial data:", err);
      }
    }
    fetchData();
  }, []);

  // 2. Poll corridors status periodically (every 5 seconds)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const corridorsData = await api.get<CorridorStatusResponse[]>("/api/corridors/status");
        setCorridors(corridorsData);
        setLastSynced(new Date());
      } catch (err) {
        console.error("Error polling corridors status:", err);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // 2.5 Fetch bus ETAs periodically — centralized, no client-side ETA calculation
  useEffect(() => {
    const fetchBusEtas = async () => {
      const etaMap: Record<number, BusETAResponse> = {};
      const batchSize = 10;
      const busIds = buses.filter(b => b.speed > 0).map(b => b.id);
      for (let i = 0; i < busIds.length; i += batchSize) {
        const batch = busIds.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(id => api.get<BusETAResponse>(`/api/eta/bus/${id}`))
        );
        results.forEach((r, idx) => {
          if (r.status === "fulfilled" && r.value) {
            etaMap[batch[idx]] = r.value;
          }
        });
      }
      setBusEtas(etaMap);
    };
    fetchBusEtas();
    const interval = setInterval(fetchBusEtas, 10000);
    return () => clearInterval(interval);
  }, [buses.length]);

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

    mapInstance.on("load", () => {
      setIsMapLoaded(true);
    });

    setMap(mapInstance);

    return () => {
      mapInstance.remove();
    };
  }, []);

  // 4. Draw route lines when routes and map are ready
  useEffect(() => {
    if (!map || !isMapLoaded || routes.length === 0 || routesAddedRef.current) return;

    routes.forEach((route) => {
      if (!route.waypoints || route.waypoints.length === 0) return;

      const coords = route.waypoints.map((w: number[]) => [w[1], w[0]]); // [lng, lat]

      // Add route source
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

      // Add route line layer
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
          "line-opacity": 0.7,
        },
      });

      // Add a wider transparent layer for easier clicking
      map.addLayer({
        id: `route-click-layer-${route.id}`,
        type: "line",
        source: `route-${route.id}`,
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "transparent",
          "line-width": 15,
        },
      });

      // Click handler
      map.on("click", `route-click-layer-${route.id}`, () => {
        setSelectedRouteId(route.id);
      });

      // Pointer cursor on hover
      map.on("mouseenter", `route-click-layer-${route.id}`, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", `route-click-layer-${route.id}`, () => {
        map.getCanvas().style.cursor = "";
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

  // 6. Update Bus Markers dynamically via WebSockets
  useEffect(() => {
    if (!map || !isMapLoaded || routes.length === 0) return;

    buses.forEach((bus) => {
      if (bus.current_lng == null || bus.current_lat == null) return;

      const existingMarker = busMarkersRef.current[bus.id];
      const route = routes.find((r) => r.id === bus.route_id);

      if (existingMarker) {
        // Update position
        existingMarker.setLngLat([bus.current_lng, bus.current_lat]);
        
        // Update rotation
        const el = existingMarker.getElement();
        const arrow = el.querySelector(".bus-marker-arrow") as HTMLElement;
        if (arrow) {
          arrow.style.transform = `rotate(${bus.bearing ?? 0}deg)`;
        }
        
        // Update color and animations
        const dot = el.querySelector(".bus-marker-dot") as HTMLElement;
        if (dot) {
          if (bus.status === "delayed") {
            dot.className = "bus-marker-dot relative flex items-center justify-center h-4 w-4 rounded-full bg-amber-500 border border-black shadow shadow-black transition-all duration-300";
          } else {
            dot.className = "bus-marker-dot relative flex items-center justify-center h-4 w-4 rounded-full bg-emerald-500 border border-black shadow shadow-black transition-all duration-300";
          }
          dot.style.backgroundColor = bus.status === "delayed" ? "#f59e0b" : "#10b981";
        }

        // Update popup content dynamically
        const existingPopup = busPopupsRef.current[bus.id];
        if (existingPopup) {
          const busEta = getBusETA(bus.id);
          const statusColor = busEta?.status === "ON TIME" ? "text-emerald-500" : busEta?.status === "MINOR DELAY" ? "text-amber-500" : busEta?.status === "DELAYED" || busEta?.status === "SEVERELY DELAYED" ? "text-red-500" : "text-emerald-500";
          existingPopup.setHTML(`
            <div class="p-3 text-xs bg-zinc-950 text-zinc-100 rounded-lg border border-zinc-800 shadow-xl max-w-[220px]">
              <div class="font-bold border-b border-zinc-800 pb-1 mb-2 text-sm text-amber-500">${bus.name}</div>
              <div class="space-y-1">
                <div><span class="text-zinc-500">Route:</span> ${route?.name ?? "Unknown"}</div>
                <div><span class="text-zinc-500">Speed:</span> ${bus.speed} km/h</div>
                <div><span class="text-zinc-500">Occupancy:</span> ${bus.occupancy}/${bus.capacity}</div>
                <div><span class="text-zinc-500">Status:</span> <span class="font-bold uppercase text-[10px] ${statusColor}">${busEta?.status ?? bus.status}</span></div>
                ${busEta ? `<div class="border-t border-zinc-800 pt-1 mt-1.5"><span class="text-zinc-500">ETA to ${busEta.terminal_name.replace(" Terminal", "")}:</span> <span class="font-bold text-amber-500">${Math.round(busEta.total_time_min)} min</span></div>` : ""}
              </div>
            </div>
          `);
        }
      } else {
        // Create new DOM element for bus marker
        const el = document.createElement("div");
        el.className = "cursor-pointer group";

        const dot = document.createElement("div");
        dot.className = `bus-marker-dot relative flex items-center justify-center h-4.5 w-4.5 rounded-full border border-black shadow-lg transition-all duration-300`;
        dot.style.backgroundColor = bus.status === "delayed" ? "#f59e0b" : "#10b981";

        const arrow = document.createElement("div");
        arrow.className = "bus-marker-arrow w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[7px] border-b-black -mt-[1px] transition-transform duration-300";
        arrow.style.transform = `rotate(${bus.bearing ?? 0}deg)`;

        dot.appendChild(arrow);
        el.appendChild(dot);

        // Custom Popup — uses centralized ETA from API
        const busEta = getBusETA(bus.id);
        const statusColor = busEta?.status === "ON TIME" ? "text-emerald-500" : busEta?.status === "MINOR DELAY" ? "text-amber-500" : busEta?.status === "DELAYED" || busEta?.status === "SEVERELY DELAYED" ? "text-red-500" : "text-emerald-500";
        const popup = new maplibregl.Popup({ offset: 12, closeButton: false }).setHTML(`
          <div class="p-3 text-xs bg-zinc-950 text-zinc-100 rounded-lg border border-zinc-800 shadow-xl max-w-[220px]">
            <div class="font-bold border-b border-zinc-800 pb-1 mb-2 text-sm text-amber-500">${bus.name}</div>
            <div class="space-y-1">
              <div><span class="text-zinc-500">Route:</span> ${route?.name ?? "Unknown"}</div>
              <div><span class="text-zinc-500">Speed:</span> ${bus.speed} km/h</div>
              <div><span class="text-zinc-500">Occupancy:</span> ${bus.occupancy}/${bus.capacity}</div>
              <div><span class="text-zinc-500">Status:</span> <span class="font-bold uppercase text-[10px] ${statusColor}">${busEta?.status ?? bus.status}</span></div>
              ${busEta ? `<div class="border-t border-zinc-800 pt-1 mt-1.5"><span class="text-zinc-500">ETA to ${busEta.terminal_name.replace(" Terminal", "")}:</span> <span class="font-bold text-amber-500">${Math.round(busEta.total_time_min)} min</span></div>` : ""}
            </div>
          </div>
        `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([bus.current_lng, bus.current_lat])
          .setPopup(popup)
          .addTo(map);

        busPopupsRef.current[bus.id] = popup;

        // Open popup on hover
        el.addEventListener("mouseenter", () => popup.addTo(map));
        el.addEventListener("mouseleave", () => popup.remove());

        // Select route on click
        el.addEventListener("click", () => {
          setSelectedRouteId(bus.route_id);
        });

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
        delete busPopupsRef.current[id];
      }
    });
  }, [map, isMapLoaded, buses, routes, terminals]);

  // 6.5. Update Incident Markers dynamically
  useEffect(() => {
    if (!map || !isMapLoaded) return;

    incidents.forEach((incident) => {
      if (incident.longitude == null || incident.latitude == null) return;

      const existingMarker = incidentMarkersRef.current[incident.id];
      const isSelected = incident.id === selectedIncidentId;

      // Choose color based on incident type
      let color = "#ef4444"; // Landslide -> Red (default)
      if (incident.type === "Flood Warning") color = "#3b82f6"; // Blue
      else if (incident.type === "Road Closure") color = "#71717a"; // Gray
      else if (incident.type === "Weather Advisory") color = "#f97316"; // Orange

      if (existingMarker) {
        // Update position if needed
        existingMarker.setLngLat([incident.longitude, incident.latitude]);
        
        // Update selection highlight ring
        const el = existingMarker.getElement();
        const outerPulse = el.querySelector(".incident-pulse") as HTMLElement;
        if (outerPulse) {
          outerPulse.style.display = isSelected ? "block" : "none";
        }
      } else {
        // Create new DOM element for incident marker
        const el = document.createElement("div");
        el.className = "cursor-pointer group transition-all duration-300";

        el.innerHTML = `
          <div style="position:relative;display:flex;align-items:center;justify-content:center;width:48px;height:48px;">

            <!-- Outermost slow pulse ring -->
            <div style="
              position:absolute;
              width:48px; height:48px;
              border-radius:50%;
              background-color:${color};
              opacity:0.15;
              animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;
            "></div>

            <!-- Middle pulse ring (offset delay) -->
            <div style="
              position:absolute;
              width:32px; height:32px;
              border-radius:50%;
              background-color:${color};
              opacity:0.25;
              animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;
              animation-delay:0.5s;
            "></div>

            <!-- Selection spinner ring (only visible when selected) -->
            <div class="incident-pulse" style="
              position:absolute;
              width:40px; height:40px;
              border-radius:50%;
              border:2px dashed white;
              opacity:0.8;
              animation:spin 3s linear infinite;
              display:${isSelected ? "block" : "none"};
            "></div>

            <!-- Solid glow backdrop -->
            <div style="
              position:absolute;
              width:20px; height:20px;
              border-radius:50%;
              background-color:${color};
              opacity:0.5;
              filter:blur(4px);
            "></div>

            <!-- Center dot -->
            <div style="
              position:relative;
              width:16px; height:16px;
              border-radius:50%;
              background-color:${color};
              border:2px solid rgba(0,0,0,0.6);
              box-shadow:0 0 0 2px ${color}66, 0 4px 12px ${color}99;
              display:flex; align-items:center; justify-content:center;
            ">
              <div style="width:6px;height:6px;border-radius:50%;background:white;opacity:0.9;"></div>
            </div>
          </div>
        `;

        // Custom Popup
        const popup = new maplibregl.Popup({ offset: 12, closeButton: false }).setHTML(`
          <div class="p-3 text-xs bg-zinc-950 text-zinc-100 rounded-lg border border-zinc-800 shadow-xl max-w-[200px]">
            <div class="font-bold border-b border-zinc-800 pb-1 mb-2 text-sm text-zinc-200">${incident.title}</div>
            <div class="space-y-1">
              <div><span class="text-zinc-500">Type:</span> ${incident.type}</div>
              <div><span class="text-zinc-500">Severity:</span> <span class="font-bold uppercase text-[10px]" style="color: ${color}">${incident.severity}</span></div>
              <div><span class="text-zinc-500">Delay:</span> <span class="font-bold text-amber-500">${incident.estimated_delay_minutes} min</span></div>
              <div class="text-[10px] text-zinc-400 mt-1.5 border-t border-zinc-900 pt-1 leading-relaxed">${incident.description}</div>
            </div>
          </div>
        `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([incident.longitude, incident.latitude])
          .setPopup(popup)
          .addTo(map);

        // Open popup on hover
        el.addEventListener("mouseenter", () => popup.addTo(map));
        el.addEventListener("mouseleave", () => popup.remove());

        // Select incident on click
        el.addEventListener("click", () => {
          setSelectedIncidentId(incident.id);
          setShowEtaPanel(false); // Close ETA panel to prevent overlays
          map.easeTo({ center: [incident.longitude, incident.latitude], zoom: 9.5, duration: 500 });
        });

        incidentMarkersRef.current[incident.id] = marker;
      }
    });

    // Cleanup stale/expired incident markers
    const activeIds = new Set(incidents.map((i) => i.id));
    Object.keys(incidentMarkersRef.current).forEach((id) => {
      if (!activeIds.has(id)) {
        incidentMarkersRef.current[id].remove();
        delete incidentMarkersRef.current[id];
      }
    });
  }, [map, isMapLoaded, incidents, selectedIncidentId]);

  // Selected corridor details for focused view
  const focusedCorridor = corridors.find((c) => c.route_id === selectedRouteId);
  const focusedRoute = routes.find((r) => r.id === selectedRouteId);

  // Helper for status badge style — uses centralized incident-aware status
  function getStatusStyle(status: string) {
    switch (status) {
      case "SEVERELY DELAYED":
      case "SERVICE DISRUPTED":
        return "bg-red-950/80 border border-red-700 text-red-400";
      case "DELAYED":
      case "REROUTING":
        return "bg-amber-950/80 border border-amber-700 text-amber-400";
      case "MINOR DELAY":
        return "bg-yellow-950/80 border border-yellow-700 text-yellow-400";
      default:
        return "bg-emerald-950/80 border border-emerald-700 text-emerald-400";
    }
  }

  function getBusETA(busId: number): BusETAResponse | null {
    return busEtas[busId] ?? null;
  }

  // Calculate total dynamic stats
  const activeBusesCount = buses.filter(b => b.status in ["active", "delayed"] || b.speed > 0).length || buses.length;
  const activeIncidentsCount = incidents.length;
  const selectedIncident = incidents.find((i) => i.id === selectedIncidentId) || null;

  return (
    <div className="flex flex-col h-full gap-4 text-zinc-100">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-black text-amber-500 tracking-tight">
            Real-Time Corridor Monitoring
          </h1>
          <p className="text-xs text-zinc-400">
            Live position of {activeBusesCount} units across {routes.length} active intercity corridors.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => setShowEtaPanel(!showEtaPanel)}
            className={`flex items-center gap-1.5 border rounded-md px-3 py-1.5 text-[10px] font-bold transition-all ${
              showEtaPanel
                ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Clock className="h-3 w-3" />
            <span>ETA</span>
          </button>
          <div className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-[10px] text-zinc-400">
            <div className={`h-1.5 w-1.5 rounded-full inline-block mr-1.5 ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}></div>
            <span>{isConnected ? "Live GPS" : "Offline"}</span>
            <span className="text-zinc-600 ml-1.5 mr-1.5">|</span>
            <span>{Math.max(0, Math.floor((new Date().getTime() - lastSynced.getTime()) / 1000))}s ago</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Map & Corridor Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-[380px] overflow-hidden">
        {/* Map Container */}
        <div className="lg:col-span-2 flex flex-col bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden relative group">
          <div className="absolute top-3 left-3 z-10 bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded px-3 py-1.5 text-[10px] font-bold text-zinc-300 flex items-center gap-1.5 shadow-lg shadow-black/50">
            <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping"></div>
            <span>Mindanao Network • Live Map</span>
          </div>

          <div ref={mapContainerRef} className="w-full flex-1 min-h-[300px] h-full" />

          {showEtaPanel && (
            <div className="absolute top-3 right-3 z-20">
              <ETAPanel terminals={terminals} onClose={() => setShowEtaPanel(false)} />
            </div>
          )}

          {selectedIncident && (
            <div className="absolute top-3 right-3 z-20">
              <IncidentDetailCard
                incident={selectedIncident}
                onClose={() => setSelectedIncidentId(null)}
              />
            </div>
          )}

          {/* Stats Bar overlayed on map bottom */}
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
              <span className="text-[18px] font-black text-red-500 leading-none">{activeIncidentsCount}</span>
              <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider mt-1">Incidents</span>
            </div>
          </div>
        </div>

        {/* Right Corridor & Incident Panel */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl flex flex-col overflow-hidden max-h-[500px] lg:max-h-none">
          {/* Tabs Header */}
          <div className="flex border-b border-zinc-800 bg-zinc-900/50 shrink-0">
            <button
              onClick={() => setActiveTab("corridors")}
              className={`flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider transition-all duration-200 border-b-2 ${
                activeTab === "corridors"
                  ? "border-amber-500 text-amber-500 bg-zinc-950/20"
                  : "border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40"
              }`}
            >
              Corridors ({corridors.length})
            </button>
            <button
              onClick={() => setActiveTab("incidents")}
              className={`flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider transition-all duration-200 border-b-2 flex items-center justify-center gap-1.5 ${
                activeTab === "incidents"
                  ? "border-amber-500 text-amber-500 bg-zinc-950/20"
                  : "border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40"
              }`}
            >
              <span>Incidents</span>
              <span className={`px-1.5 py-0.5 text-[9px] font-black rounded-full leading-none ${
                incidents.length > 0
                  ? "bg-red-500 text-white animate-pulse"
                  : "bg-zinc-850 text-zinc-500"
              }`}>
                {incidents.length}
              </span>
            </button>
          </div>

          <div className="p-2 space-y-2 overflow-y-auto flex-1 min-h-[300px]">
            {activeTab === "corridors" ? (
              <>
                {corridors.map((corridor) => {
                  const isSelected = corridor.route_id === selectedRouteId;
                  const hasIncidents = corridor.affected_incidents.length > 0;

                  return (
                    <div
                      key={corridor.route_id}
                      onClick={() => setSelectedRouteId(corridor.route_id)}
                      className={`p-3 rounded-lg border text-left cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? "bg-zinc-900 border-zinc-600 shadow-md"
                          : "bg-zinc-900/40 border-zinc-900 hover:border-zinc-800 hover:bg-zinc-900/60"
                      }`}
                    >
                      {/* Header: name + status badge */}
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: corridor.color }}></div>
                          <span className="font-bold text-sm tracking-tight text-zinc-100">
                            {corridor.route_name}
                          </span>
                        </div>
                        <span className={`text-[9px] font-black tracking-wider px-2 py-0.5 rounded-full ${getStatusStyle(corridor.status)}`}>
                          {corridor.status}
                        </span>
                      </div>

                      {/* ETA row */}
                      <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                        <span>CAP {corridor.capacity_utilization}%</span>
                        <span className="text-zinc-100 font-semibold">
                          ETA: {corridor.eta_min != null ? `${Math.round(corridor.eta_min)} min` : "—"}
                        </span>
                      </div>

                      {/* Delay row */}
                      <div className="flex justify-between text-[10px] text-zinc-400 mb-1.5">
                        <span>{corridor.active_bus_count} active units</span>
                        <span className={corridor.avg_delay_min > 0 ? "text-amber-500 font-semibold" : "text-emerald-500"}>
                          {corridor.avg_delay_min > 0 ? `+${Math.round(corridor.avg_delay_min)}m delay` : "On time"}
                        </span>
                      </div>

                      {/* Capacity bar */}
                      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-1.5">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${corridor.capacity_utilization}%`,
                            backgroundColor: corridor.color
                          }}
                        />
                      </div>

                      {/* Affected incidents */}
                      {hasIncidents && (
                        <div className="mt-1.5 space-y-0.5">
                          {corridor.affected_incidents.map((inc, idx) => (
                            <div key={idx} className="flex items-center gap-1 text-[9px] text-red-400">
                              <TriangleAlert className="h-2.5 w-2.5 shrink-0" />
                              <span>{inc.title}</span>
                              <span className="text-zinc-500 ml-auto">+{inc.estimated_delay_min}m</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {corridors.length === 0 && (
                  <div className="flex flex-col items-center justify-center p-8 text-center text-zinc-500 h-full">
                    <Info className="h-8 w-8 mb-2 opacity-50" />
                    <span className="text-xs">Loading corridor information...</span>
                  </div>
                )}
              </>
            ) : (
              <IncidentFeedPanel
                incidents={incidents}
                selectedIncidentId={selectedIncidentId}
                onSelectIncident={(incident) => {
                  setSelectedIncidentId(incident.id);
                  if (map) {
                    map.easeTo({ center: [incident.longitude, incident.latitude], zoom: 9.5, duration: 600 });
                  }
                  setShowEtaPanel(false); // Close ETA panel on selection
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Focus Panel — incident-aware ETA and status */}
      {focusedCorridor && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded p-2.5 flex items-center justify-center">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none">
                  Focus Corridor
                </span>
                <div className="h-1.5 w-1.5 rounded-full bg-zinc-700"></div>
                <span className="text-[10px] font-medium text-zinc-500 leading-none">
                  {focusedRoute?.distance_km} km
                </span>
                <span className={`text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded-full ${getStatusStyle(focusedCorridor.status)}`}>
                  {focusedCorridor.status}
                </span>
              </div>
              <h3 className="text-lg font-black text-zinc-100 mt-1 leading-tight">
                {focusedCorridor.route_name}
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1 max-w-3xl justify-items-stretch md:justify-items-center">
            <div className="text-left md:text-center border-l md:border-l-0 border-zinc-800 pl-3 md:pl-0">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                ETA
              </span>
              <p className="text-sm font-black text-zinc-100 mt-0.5">
                {focusedCorridor.eta_min != null ? `${Math.round(focusedCorridor.eta_min)} min` : "—"}
              </p>
            </div>

            <div className="text-left md:text-center border-l border-zinc-800 pl-3">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                Delay
              </span>
              <p className={`text-sm font-black mt-0.5 ${focusedCorridor.avg_delay_min > 0 ? "text-amber-500" : "text-zinc-100"}`}>
                {focusedCorridor.avg_delay_min > 0 ? `+${Math.round(focusedCorridor.avg_delay_min)} min` : "0 min"}
              </p>
            </div>

            <div className="text-left md:text-center border-l border-zinc-800 pl-3">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                Active Units
              </span>
              <p className="text-sm font-black text-zinc-100 mt-0.5">
                {buses.filter(b => b.route_id === selectedRouteId).length}
              </p>
            </div>

            <div className="text-left md:text-center border-l border-zinc-800 pl-3">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                Capacity
              </span>
              <p className="text-sm font-black text-zinc-100 mt-0.5">
                {focusedCorridor.capacity_utilization}%
              </p>
            </div>
          </div>

          {/* Affected incidents row in focus panel */}
          {focusedCorridor.affected_incidents.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-3 mt-2 md:border-t-0 md:pt-0 md:mt-0">
              {focusedCorridor.affected_incidents.map((inc, idx) => (
                <div key={idx} className="flex items-center gap-1 bg-red-950/40 border border-red-900/60 rounded px-2 py-1">
                  <TriangleAlert className="h-3 w-3 text-red-400 shrink-0" />
                  <span className="text-[10px] text-red-300 font-medium">{inc.title}</span>
                  <span className="text-[10px] text-red-400 font-bold">+{inc.estimated_delay_min}m</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
