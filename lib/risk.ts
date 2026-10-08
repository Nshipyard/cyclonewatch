// CycloneWatch risk engine. Fully transparent: every score decomposes into the
// four components below, and the UI shows the math for each asset.
//
// For an asset at (lat, lon) and a storm:
//   d = minimum distance (km) from the asset to the storm's forecast track
//   w = max sustained wind (kt) at the closest forecast point
//   t = lead time (hours) from now to the closest forecast point (0 if now/past)
//
//   proximity = clamp(1 - d/600, 0, 1) * 50     (50 pts at 0 km, 0 beyond 600 km)
//   reach     = clamp(1 - d/1200, 0, 1)         (1 at 0 km, 0 beyond 1200 km)
//   wind      = clamp(w/130, 0, 1) * 30 * reach (30 pts at 130+ kt, scaled by reach)
//   urgency   = clamp(1 - t/120, 0, 1) * 20 * reach
//   coneBonus = 10 if the asset sits inside the forecast cone polygon, else 0
//
//   score = min(100, round(proximity + wind + urgency + coneBonus))
// Wind and urgency are scaled by reach so a distant storm cannot drive a high
// score on intensity or timing alone.
//
// Bands (cutoffs stated in the UI):
//   0-33   Watch    (blue)   Monitor. Review your hurricane plan.
//   34-66  Prepare  (amber)  Secure assets, confirm insurance, plan movements.
//   67-100 Act      (red)    Execute your storm plan now.
import {
  distToPolylineKm,
  haversineKm,
  interpolateTrack,
  pointInPolygon,
} from "./geo";
import type {
  RiskBand,
  RiskResult,
  StormData,
  TimelineEntry,
} from "./types";

export const BAND_CUTOFFS = { watchMax: 33, prepareMax: 66 };

export const BAND_META: Record<
  RiskBand,
  { label: string; color: string; softBg: string; action: string }
> = {
  watch: {
    label: "Watch",
    color: "#2563eb",
    softBg: "#eff6ff",
    action:
      "Monitor. Review your hurricane plan and check this page again in 24 hours.",
  },
  prepare: {
    label: "Prepare",
    color: "#d97706",
    softBg: "#fffbeb",
    action:
      "Prepare. Secure assets, confirm insurance documents, and plan vessel or cargo movements within 48 hours.",
  },
  act: {
    label: "Act",
    color: "#dc2626",
    softBg: "#fef2f2",
    action:
      "Act now. Execute your storm plan: move vessels, protect cargo, and follow official evacuation guidance.",
  },
};

export function bandFor(score: number): RiskBand {
  if (score >= 67) return "act";
  if (score >= 34) return "prepare";
  return "watch";
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Risk of one storm to one asset. Returns null when the storm has no usable track. */
export function computeRisk(
  lat: number,
  lon: number,
  storm: StormData,
  nowMs: number,
): RiskResult | null {
  // Track points: current position at t=0 plus forecast points.
  const track: { time: number; lat: number; lon: number; windKt: number }[] = [
    {
      time: new Date(storm.advisoryTime).getTime() || nowMs,
      lat: storm.lat,
      lon: storm.lon,
      windKt: storm.intensityKt,
    },
    ...storm.forecast.map((p) => ({
      time: Date.parse(p.time),
      lat: p.lat,
      lon: p.lon,
      windKt: p.windKt,
    })),
  ].filter((p) => isFinite(p.time));
  if (track.length === 0) return null;

  const line: [number, number][] = track.map((p) => [p.lat, p.lon]);
  const d = distToPolylineKm(lat, lon, line);

  // Closest track point for wind + lead time.
  let best = track[0];
  let bestD = haversineKm(lat, lon, best.lat, best.lon);
  for (const p of track.slice(1)) {
    const dd = haversineKm(lat, lon, p.lat, p.lon);
    if (dd < bestD) {
      bestD = dd;
      best = p;
    }
  }

  const t = Math.max(0, (best.time - nowMs) / 3600000);
  const proximity = clamp01(1 - d / 600) * 50;
  const reach = clamp01(1 - d / 1200);
  const wind = clamp01(best.windKt / 130) * 30 * reach;
  const urgency = clamp01(1 - t / 120) * 20 * reach;
  const inCone = storm.cone.length >= 3 && pointInPolygon(lat, lon, storm.cone);
  const coneBonus = inCone ? 10 : 0;
  const score = Math.min(
    100,
    Math.round(proximity + wind + urgency + coneBonus),
  );

  return {
    score,
    band: bandFor(score),
    stormId: storm.id,
    stormName: storm.name,
    stormClassLabel: storm.classLabel,
    closestDistanceKm: d,
    closestWindKt: best.windKt,
    leadTimeHours: t,
    inCone,
    components: { proximity, wind, urgency, coneBonus },
    closestPoint: {
      lat: best.lat,
      lon: best.lon,
      time: new Date(best.time).toISOString(),
    },
  };
}

/** Worst risk across all storms (the one driving the asset's score). */
export function worstRisk(
  lat: number,
  lon: number,
  storms: StormData[],
  nowMs: number,
): RiskResult | null {
  let best: RiskResult | null = null;
  for (const s of storms) {
    const r = computeRisk(lat, lon, s, nowMs);
    if (r && (!best || r.score > best.score)) best = r;
  }
  return best;
}

/** Alert timeline: storm distance/wind at +24h, +48h, +72h and closest approach. */
export function buildTimeline(
  lat: number,
  lon: number,
  storm: StormData,
  nowMs: number,
): TimelineEntry[] {
  const track = [
    {
      time: new Date(storm.advisoryTime).getTime() || nowMs,
      lat: storm.lat,
      lon: storm.lon,
      windKt: storm.intensityKt,
    },
    ...storm.forecast.map((p) => ({
      time: Date.parse(p.time),
      lat: p.lat,
      lon: p.lon,
      windKt: p.windKt,
    })),
  ].filter((p) => isFinite(p.time));
  if (track.length === 0) return [];

  const lastTime = track[track.length - 1].time;
  const marks: { label: string; at: number }[] = [
    { label: "+24h", at: nowMs + 24 * 3600000 },
    { label: "+48h", at: nowMs + 48 * 3600000 },
    { label: "+72h", at: nowMs + 72 * 3600000 },
  ];
  const out: TimelineEntry[] = marks.map(({ label, at }) => {
    if (at > lastTime) {
      return {
        label,
        at: new Date(at).toISOString(),
        distanceKm: null,
        windKt: null,
        beyondForecast: true,
      };
    }
    const pos = interpolateTrack(track, at)!;
    return {
      label,
      at: new Date(at).toISOString(),
      distanceKm: haversineKm(lat, lon, pos.lat, pos.lon),
      windKt: pos.windKt,
      beyondForecast: false,
    };
  });

  // Closest approach within the forecast window.
  let ca = track[0];
  let caD = haversineKm(lat, lon, ca.lat, ca.lon);
  for (const p of track.slice(1)) {
    const dd = haversineKm(lat, lon, p.lat, p.lon);
    if (dd < caD) {
      caD = dd;
      ca = p;
    }
  }
  out.push({
    label: "Closest approach",
    at: new Date(ca.time).toISOString(),
    distanceKm: caD,
    windKt: ca.windKt,
    beyondForecast: false,
  });
  return out;
}
