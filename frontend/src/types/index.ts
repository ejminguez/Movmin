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

export interface Incident {
  id: number;
  incident_type: string;
  severity: string;
  description: string | null;
  lat: number | null;
  lng: number | null;
  affected_route_id: number | null;
  estimated_delay_min: number;
  status: string;
  created_at: string;
}
