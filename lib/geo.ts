// Geographic math helpers: haversine distance, segment distance, point-in-polygon.

const EARTH_KM = 6371;

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(a));
}

/** Distance from point P to segment AB, in km (equirectangular approx, fine at storm scale). */
export function distToSegmentKm(
  pLat: number,
  pLon: number,
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const kx = Math.cos(((pLat + aLat) / 2) * (Math.PI / 180));
  const px = pLon * kx;
  const py = pLat;
  const ax = aLon * kx;
  const ay = aLat;
  const bx = bLon * kx;
  const by = bLat;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 0) {
    t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  }
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  // convert degree deltas to km
  const dLatKm = (py - cy) * 111.32;
  const dLonKm = (px - cx) * 111.32;
  return Math.sqrt(dLatKm * dLatKm + dLonKm * dLonKm);
}

/** Minimum distance from a point to a polyline (array of [lat, lon]). */
export function distToPolylineKm(
  lat: number,
  lon: number,
  line: [number, number][],
): number {
  if (line.length === 0) return Infinity;
  if (line.length === 1) return haversineKm(lat, lon, line[0][0], line[0][1]);
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const d = distToSegmentKm(
      lat,
      lon,
      line[i][0],
      line[i][1],
      line[i + 1][0],
      line[i + 1][1],
    );
    if (d < best) best = d;
  }
  return best;
}

/** Ray-casting point-in-polygon for [lat, lon] polygons. */
export function pointInPolygon(
  lat: number,
  lon: number,
  poly: [number, number][],
): boolean {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i];
    const [yj, xj] = poly[j];
    if (
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** Minimum distance from a point to a polygon boundary. */
export function distToPolygonKm(
  lat: number,
  lon: number,
  poly: [number, number][],
): number {
  return distToPolylineKm(lat, lon, [...poly, poly[0]]);
}

/** Interpolate a position along a time-ordered track at a target timestamp. */
export function interpolateTrack(
  track: { time: number; lat: number; lon: number; windKt: number }[],
  targetMs: number,
): { lat: number; lon: number; windKt: number } | null {
  if (track.length === 0) return null;
  if (targetMs <= track[0].time)
    return { lat: track[0].lat, lon: track[0].lon, windKt: track[0].windKt };
  const last = track[track.length - 1];
  if (targetMs >= last.time)
    return { lat: last.lat, lon: last.lon, windKt: last.windKt };
  for (let i = 0; i < track.length - 1; i++) {
    const a = track[i];
    const b = track[i + 1];
    if (targetMs >= a.time && targetMs <= b.time) {
      const t = (targetMs - a.time) / (b.time - a.time);
      return {
        lat: a.lat + (b.lat - a.lat) * t,
        lon: a.lon + (b.lon - a.lon) * t,
        windKt: Math.round(a.windKt + (b.windKt - a.windKt) * t),
      };
    }
  }
  return null;
}

export function formatKm(km: number): string {
  if (!isFinite(km)) return "n/a";
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

export function formatHours(h: number): string {
  if (!isFinite(h)) return "n/a";
  if (h < 1) return "under 1 hour";
  return `${Math.round(h)} hours`;
}

/** "in 26 hours" / "Oct 9, 8:00 PM UTC" style helpers */
export function timeUntil(ms: number, nowMs: number): string {
  const h = (ms - nowMs) / 3600000;
  if (h <= 0) return "now";
  if (h < 48) return `in ${Math.round(h)} hours`;
  return `in ${Math.round(h / 24)} days`;
}

export function formatUtc(iso: string): string {
  const d = new Date(iso);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const hh = d.getUTCHours();
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${h12}:${String(d.getUTCMinutes()).padStart(2, "0")} ${ampm} UTC`;
}
