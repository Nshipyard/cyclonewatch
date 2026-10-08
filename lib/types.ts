// Shared types for CycloneWatch.

export interface ForecastPoint {
  /** ISO timestamp (UTC) */
  time: string;
  lat: number;
  lon: number;
  /** Maximum sustained wind in knots at this forecast point */
  windKt: number;
}

/** Polygon as [lat, lon] pairs */
export type Polygon = [number, number][];

export interface StormData {
  id: string; // e.g. "al092026"
  name: string; // e.g. "Isaias"
  classification: string; // HU, TS, TD, etc.
  classLabel: string; // "Hurricane", "Tropical Storm", ...
  intensityKt: number;
  pressureMb: number | null;
  lat: number;
  lon: number;
  movement: string; // e.g. "ENE at 10 mph"
  advisoryTime: string; // ISO
  advisoryUrl: string;
  forecast: ForecastPoint[];
  cone: Polygon;
  windExtents: { kt34: Polygon; kt50: Polygon; kt64: Polygon };
  pastTrack: [number, number][];
  isDemo: boolean;
}

export type StormMode = "live" | "demo" | "none";

export interface StormsResponse {
  mode: StormMode;
  storms: StormData[];
  updatedAt: string;
  source: string;
  note?: string;
}

export interface RiskComponents {
  proximity: number; // 0-50
  wind: number; // 0-30
  urgency: number; // 0-20
  coneBonus: number; // 0 or 10
}

export type RiskBand = "watch" | "prepare" | "act";

export interface RiskResult {
  score: number; // 0-100
  band: RiskBand;
  stormId: string;
  stormName: string;
  stormClassLabel: string;
  closestDistanceKm: number;
  closestWindKt: number;
  leadTimeHours: number;
  inCone: boolean;
  components: RiskComponents;
  closestPoint: { lat: number; lon: number; time: string };
}

export interface TimelineEntry {
  label: string;
  at: string; // ISO
  distanceKm: number | null;
  windKt: number | null;
  beyondForecast: boolean;
}

export interface Port {
  name: string;
  country: string;
  lat: number;
  lon: number;
}
