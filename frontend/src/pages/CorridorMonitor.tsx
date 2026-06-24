import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { api } from "@/lib/api";
import { useBusesWebSocket } from "@/hooks/useBusesWebSocket";
import type { Route, Terminal } from "@/types";
import { MapPin, Info, ArrowUpRight, CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";

interface CorridorStatus {
  route_id: number;
  route_name: string;
  color: string;
  active_bus_count: number;
  avg_speed: number;
  avg_delay_min: number;
  capacity_utilization: number;
  congestion_level: string;
}

export default function CorridorMonitor() {
  const { buses, isConnected } = useBusesWebSocket();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [corridors, setCorridors] = useState<CorridorStatus[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [lastSynced, setLastSynced] = useState<Date>(new Date());
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  
  const routesAddedRef = useRef<boolean>(false);
  const terminalsAddedRef = useRef<boolean>(false);
  const busMarkersRef = useRef<{ [id: number]: maplibregl.Marker }>({});

  // 1. Fetch initial data
  useEffect(() => {
    async function fetchData() {
      try {
        const [routesData, terminalsData, corridorsData] = await Promise.all([
          api.get<Route[]>("/api/routes"),
          api.get<Terminal[]>("/api/terminals"),
          api.get<CorridorStatus[]>("/api/corridors/status"),
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
        const corridorsData = await api.get<CorridorStatus[]>("/api/corridors/status");
        setCorridors(corridorsData);
        setLastSynced(new Date());
      } catch (err) {
        console.error("Error polling corridors status:", err);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

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

        // Custom Popup
        const popup = new maplibregl.Popup({ offset: 12, closeButton: false }).setHTML(`
          <div class="p-3 text-xs bg-zinc-950 text-zinc-100 rounded-lg border border-zinc-800 shadow-xl max-w-[200px]">
            <div class="font-bold border-b border-zinc-800 pb-1 mb-2 text-sm text-amber-500">${bus.name}</div>
            <div class="space-y-1">
              <div><span class="text-zinc-500">Route:</span> ${route?.name ?? "Unknown"}</div>
              <div><span class="text-zinc-500">Speed:</span> ${bus.speed} km/h</div>
              <div><span class="text-zinc-500">Occupancy:</span> ${bus.occupancy}/${bus.capacity}</div>
              <div><span class="text-zinc-500">Status:</span> <span class="font-bold ${bus.status === 'delayed' ? 'text-amber-500' : 'text-emerald-500'} uppercase text-[10px]">${bus.status}</span></div>
            </div>
          </div>
        `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([bus.current_lng, bus.current_lat])
          .setPopup(popup)
          .addTo(map);

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
      }
    });
  }, [map, isMapLoaded, buses, routes]);

  // Selected corridor details for focused view
  const focusedCorridor = corridors.find((c) => c.route_id === selectedRouteId);
  const focusedRoute = routes.find((r) => r.id === selectedRouteId);

  // Helper for status badge style
  function getStatusStyle(congestion: string) {
    switch (congestion) {
      case "Heavy Traffic":
        return "bg-red-950/80 border border-red-700 text-red-400";
      case "Moderate Traffic":
        return "bg-amber-950/80 border border-amber-700 text-amber-400";
      default:
        return "bg-emerald-950/80 border border-emerald-700 text-emerald-400";
    }
  }

  function getStatusLabel(congestion: string) {
    switch (congestion) {
      case "Heavy Traffic":
        return "CRITICAL";
      case "Moderate Traffic":
        return "DELAYED";
      default:
        return "ON-TIME";
    }
  }

  // Calculate total dynamic stats
  const activeBusesCount = buses.filter(b => b.status in ["active", "delayed"] || b.speed > 0).length || buses.length;
  const activeIncidentsCount = 0; // Seeding in phase 3

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
        <div className="flex items-center gap-2 self-start md:self-auto bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-[10px] text-zinc-400">
          <div className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}></div>
          <span>{isConnected ? "Connected to Live GPS Stream" : "GPS Connection Offline"}</span>
          <span className="text-zinc-600">|</span>
          <span>Synced {Math.max(0, Math.floor((new Date().getTime() - lastSynced.getTime()) / 1000))}s ago</span>
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

        {/* Right Corridor Panel */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl flex flex-col overflow-hidden max-h-[500px] lg:max-h-none">
          <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
            <h2 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
              Active Corridors
            </h2>
            <span className="text-[10px] font-mono bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded text-zinc-400">
              {corridors.length} of {routes.length}
            </span>
          </div>

          <div className="p-2 space-y-2 overflow-y-auto flex-1">
            {corridors.map((corridor) => {
              const isSelected = corridor.route_id === selectedRouteId;
              
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
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: corridor.color }}></div>
                      <span className="font-bold text-sm tracking-tight text-zinc-100">
                        {corridor.route_name}
                      </span>
                    </div>
                    <span className={`text-[9px] font-black tracking-wider px-2 py-0.5 rounded-full ${getStatusStyle(corridor.congestion_level)}`}>
                      {getStatusLabel(corridor.congestion_level)}
                    </span>
                  </div>

                  <div className="flex justify-between text-[10px] text-zinc-400 mb-1.5">
                    <span>CAP {corridor.capacity_utilization}%</span>
                    <span className={corridor.avg_delay_min > 0 ? "text-amber-500 font-semibold" : "text-emerald-500"}>
                      {corridor.avg_delay_min > 0 ? `+${corridor.avg_delay_min}m delay` : "+0m delay"}
                    </span>
                  </div>

                  {/* Horizontal Capacity Bar */}
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${corridor.capacity_utilization}%`,
                        backgroundColor: corridor.color
                      }}
                    />
                  </div>
                </div>
              );
            })}

            {corridors.length === 0 && (
              <div className="flex flex-col items-center justify-center p-8 text-center text-zinc-500 h-full">
                <Info className="h-8 w-8 mb-2 opacity-50" />
                <span className="text-xs">Loading corridor information...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Focus Panel */}
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
              </div>
              <h3 className="text-lg font-black text-zinc-100 mt-1 leading-tight">
                {focusedCorridor.route_name}
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1 max-w-3xl justify-items-stretch md:justify-items-center">
            <div className="text-left md:text-center border-l md:border-l-0 border-zinc-800 pl-3 md:pl-0">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                Capacity
              </span>
              <p className="text-sm font-black text-zinc-100 mt-0.5">
                {focusedCorridor.capacity_utilization}%
              </p>
            </div>
            
            <div className="text-left md:text-center border-l border-zinc-800 pl-3">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                Avg Delay
              </span>
              <p className={`text-sm font-black mt-0.5 ${focusedCorridor.avg_delay_min > 0 ? "text-amber-500" : "text-zinc-100"}`}>
                {focusedCorridor.avg_delay_min} min
              </p>
            </div>
            
            <div className="text-left md:text-center border-l border-zinc-800 pl-3">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                Active Units
              </span>
              <p className="text-sm font-black text-zinc-100 mt-0.5">
                {buses.filter(b => b.route_id === selectedRouteId).length} / 10
              </p>
            </div>
            
            <div className="text-left md:text-center border-l border-zinc-800 pl-3">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                ETA Confidence
              </span>
              <div className="flex items-center gap-1.5 mt-0.5 justify-start md:justify-center">
                {focusedCorridor.congestion_level === "Heavy Traffic" ? (
                  <>
                    <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-xs font-black text-red-400 uppercase">Low</span>
                  </>
                ) : focusedCorridor.congestion_level === "Moderate Traffic" ? (
                  <>
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs font-black text-amber-400 uppercase">Medium</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-xs font-black text-emerald-400 uppercase">High</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button className="flex items-center justify-center gap-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:text-white px-4 py-2.5 rounded-lg text-xs font-bold text-zinc-300 transition-colors shadow-sm self-stretch md:self-auto shrink-0">
            <span>Open Corridor</span>
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
