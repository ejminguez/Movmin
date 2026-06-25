export interface Route {
  id: number;
  name: string;
  description: string | null;
  color: string;
  distance_km: number | null;
  waypoints?: number[][];
}

export interface Bus {
  id: number;
  route_id: number;
  name: string;
  license_plate: string | null;
  capacity: number;
  current_lat: number | null;
  current_lng: number | null;
  speed: number;
  occupancy: number;
  status: string;
  bearing?: number;
  last_updated: string;
}

export interface Terminal {
  id: number;
  name: string;
  lat: number;
  lng: number;
  route_id: number | null;
  terminal_type: string;
}

export interface ETAResponse {
  from_terminal: string;
  to_terminal: string;
  route_name: string;
  distance_km: number;
  avg_speed: number;
  base_time_min: number;
  traffic_delay_min: number;
  weather_delay_min: number;
  weather_condition: string;
  incident_delay_min: number;
  total_time_min: number;
}

export interface Incident {
  id: string;
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description: string | null;
  latitude: number;
  longitude: number;
  affected_routes: string[];
  estimated_delay_minutes: number;
  status: string;
  created_at: string;
  expires_at: string | null;
}

export interface AnalyticSnapshot {
  id: number;
  route_id: number;
  route_name: string;
  color: string;
  timestamp: string;
  avg_travel_time_min: number | null;
  avg_delay_min: number | null;
  on_time_performance: number | null;
  utilization: number | null;
  active_bus_count: number;
}

export interface RouteAnalyticsSummary {
  route_id: number;
  route_name: string;
  color: string;
  current_utilization: number;
  avg_utilization: number;
  current_delay_min: number;
  avg_delay_min: number;
  current_otp: number;
  avg_otp: number;
  snapshot_count: number;
}

export interface RouteSnapshotResponse {
  route_id: number;
  route_name: string;
  color: string;
  snapshots: AnalyticSnapshot[];
}
