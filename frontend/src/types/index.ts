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
  direction?: boolean;
  eta_min?: number | null;
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

export interface AffectedIncident {
  incident_type: string;
  severity: string;
  title: string;
  estimated_delay_min: number;
}

export interface CorridorStatusResponse {
  route_id: number;
  route_name: string;
  color: string;
  active_bus_count: number;
  avg_speed: number;
  avg_delay_min: number;
  capacity_utilization: number;
  congestion_level: string;
  status: string;
  eta_min: number | null;
  base_time_min: number | null;
  incident_delay_min: number | null;
  traffic_delay_min: number | null;
  weather_delay_min: number | null;
  weather_condition: string | null;
  affected_incidents: AffectedIncident[];
}

export interface BusETAResponse {
  bus_id: number;
  bus_name: string;
  terminal_id: number;
  terminal_name: string;
  distance_km: number;
  base_time_min: number;
  traffic_delay_min: number;
  weather_delay_min: number;
  incident_delay_min: number;
  total_time_min: number;
  status: string;
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

export interface ScenarioPreset {
  id: string;
  name: string;
  description: string;
  type: "route_closure" | "demand_surge" | "severe_weather" | "combined";
  parameters: Record<string, any>;
}

export interface ScenarioImpact {
  travel_time_delta_min: number;
  travel_time_delta_pct: number;
  congestion_delta_pct: number;
  occupancy_delta_pct: number;
  affected_buses: number;
  affected_passengers: number;
  alternative_route?: string;
}

export interface ScenarioInsight {
  text: string;
  type: "recommendation" | "alert" | "info";
  confidence: "high" | "medium" | "low";
  suggested_actions: string[];
}

export interface ScenarioResult {
  scenario_id: string;
  type: string;
  timestamp: string;
  impact: ScenarioImpact;
  before_snapshot: Record<string, any>;
  after_snapshot: Record<string, any>;
  insight: ScenarioInsight;
}

export interface DemandForecastHour {
  hour: number;
  predicted_demand: number;
  confidence: number;
  weather_impact: string | null;
}

export interface DemandForecast {
  route_id: number;
  route_name: string;
  color: string;
  forecast_date: string;
  generated_at: string;
  forecasts: DemandForecastHour[];
}

export interface DemandForecastAll {
  routes: DemandForecast[];
}

export interface DemandPeak {
  hour: number;
  demand: number;
  label: string;
}

export interface DemandInsight {
  route_id: number;
  route_name: string;
  color: string;
  daily_total: number;
  peak_hours: DemandPeak[];
  summary: string;
  recommendation: string;
  source: string;
}

export interface IncidentCreateRequest {
  incident_type: string;
  severity: string;
  title?: string;
  description?: string;
  lat: number;
  lng: number;
  affected_route_id: number;
  estimated_delay_min: number;
  duration_minutes?: number | null;
}

export interface ScenarioSimulateRequest {
  type: "route_closure" | "demand_surge" | "severe_weather" | "combined";
  route_id?: number;
  parameters: {
    duration_minutes?: number;
    demand_increase_pct?: number;
    weather_condition?: string;
    route_ids?: number[];
  };
}

export interface HeatmapFeatureProperties {
  municipality: string;
  density_score: number;
  demand_level: string;
  underserved: boolean;
  coverage_score: number;
  active_routes: number;
  bus_count: number;
  total_demand: number;
  average_wait_time: number;
  nearest_terminal_km: number;
  population: number;
  is_corridor?: boolean;
  color?: string;
}

export interface HeatmapGeoJSON {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    geometry: {
      type: "Point";
      coordinates: [number, number];
    };
    properties: HeatmapFeatureProperties;
  }[];
}

export interface MunicipalityDemand {
  municipality: string;
  lat: number;
  lng: number;
  total_demand: number;
  active_routes: number;
  bus_count: number;
  density_score: number;
  coverage_score: number;
  demand_level: string;
  average_wait_time: number;
  nearest_terminal_km: number;
  underserved: boolean;
  underserved_reason: string | null;
  population: number;
  incident_delay_min: number;
}

export interface UnderservedArea {
  municipality: string;
  density_score: number;
  coverage_score: number;
  reason: string;
  severity: string;
  average_wait_time: number;
  active_routes: number;
  population: number;
}

export interface TerminalRecommendation {
  municipality: string;
  lat: number;
  lng: number;
  priority: string;
  priority_score: number;
  reason: string;
  density_score: number;
  population: number;
  nearest_terminal_km: number;
  expected_impact: string;
}

export interface DemandHotspot {
  municipality: string;
  lat: number;
  lng: number;
  density_score: number;
  demand_level: string;
  underserved: boolean;
}

export interface DemandSummary {
  highest_demand_municipality: string;
  highest_demand_score: number;
  average_density_score: number;
  most_utilized_corridor: string;
  most_utilized_corridor_score: number;
  fastest_growing_area: string;
  underserved_count: number;
  terminal_recommendations_count: number;
  total_municipalities: number;
}

export interface AIInsight {
  municipality: string;
  reason: string;
  severity: string;
}

export interface AITerminalRec {
  location: string;
  reason: string;
  priority: string;
  expected_impact: string;
}

export interface AICorridorObs {
  corridor: string;
  score: number;
  level: string;
}

export interface PlanningInsights {
  summary: string;
  underserved_areas: AIInsight[];
  terminal_recommendations: AITerminalRec[];
  corridor_observations: AICorridorObs[];
  ai_generated: boolean;
  fallback: boolean;
}
