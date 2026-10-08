// Demo replay: Hurricane Milton, October 2024.
// Simplified track built from published NHC facts (peak 180 mph / ~155 kt on Oct 7,
// landfall near Siesta Key, Florida on Oct 9 as a Category 3, exited near Cape
// Canaveral Oct 10). Positions are approximate and the track is simplified for
// illustration. This is NEVER presented as live data: the UI badges it as a demo.
import type { StormData } from "./types";

interface DemoPoint {
  time: string;
  lat: number;
  lon: number;
  windKt: number;
}

const MILTON_TRACK: DemoPoint[] = [
  { time: "2024-10-07T12:00:00Z", lat: 21.9, lon: -90.5, windKt: 90 },
  { time: "2024-10-08T00:00:00Z", lat: 22.1, lon: -89.2, windKt: 155 },
  { time: "2024-10-08T12:00:00Z", lat: 22.4, lon: -87.6, windKt: 145 },
  { time: "2024-10-09T00:00:00Z", lat: 23.0, lon: -85.8, windKt: 125 },
  { time: "2024-10-09T12:00:00Z", lat: 24.5, lon: -84.2, windKt: 110 },
  { time: "2024-10-09T18:00:00Z", lat: 26.0, lon: -83.0, windKt: 105 },
  { time: "2024-10-10T00:30:00Z", lat: 27.3, lon: -82.5, windKt: 105 },
  { time: "2024-10-10T12:00:00Z", lat: 28.2, lon: -80.6, windKt: 75 },
  { time: "2024-10-11T00:00:00Z", lat: 29.0, lon: -78.0, windKt: 60 },
];

/** Build the Milton replay with times shifted so the replay "now" matches real now. */
export function buildDemoStorm(nowMs: number): StormData {
  // Anchor: the replay's "current position" is the Oct 9 18:00Z point (approaching landfall).
  const anchor = Date.parse("2024-10-09T18:00:00Z");
  const shift = nowMs - anchor;
  const at = (iso: string) => new Date(Date.parse(iso) + shift).toISOString();

  const forecast = MILTON_TRACK.filter((p) => Date.parse(p.time) >= anchor).map(
    (p) => ({ time: at(p.time), lat: p.lat, lon: p.lon, windKt: p.windKt }),
  );
  const pastTrack: [number, number][] = MILTON_TRACK.filter(
    (p) => Date.parse(p.time) <= anchor,
  ).map((p) => [p.lat, p.lon]);

  const cur = MILTON_TRACK.find((p) => p.time === "2024-10-09T18:00:00Z")!;

  // Simplified cone: widen around the forecast track (illustrative only).
  const cone: [number, number][] = [];
  forecast.forEach((p, i) => {
    const spread = 0.6 + i * 0.9;
    cone.push([p.lat, p.lon - spread]);
  });
  [...forecast].reverse().forEach((p, i) => {
    const spread = 0.6 + (forecast.length - 1 - i) * 0.9;
    cone.push([p.lat, p.lon + spread]);
  });

  // Simplified circular wind extents around the current position (illustrative).
  const ring = (deg: number): [number, number][] => {
    const pts: [number, number][] = [];
    for (let a = 0; a < 360; a += 10) {
      const r = (a * Math.PI) / 180;
      pts.push([cur.lat + deg * Math.sin(r), cur.lon + deg * Math.cos(r)]);
    }
    return pts;
  };

  return {
    id: "demo-milton-2024",
    name: "Milton",
    classification: "HU",
    classLabel: "Hurricane",
    intensityKt: cur.windKt,
    pressureMb: 897,
    lat: cur.lat,
    lon: cur.lon,
    movement: "ENE at 14 mph",
    advisoryTime: at("2024-10-09T18:00:00Z"),
    advisoryUrl: "https://www.nhc.noaa.gov/archive/2024/MILTON.shtml",
    forecast,
    cone,
    windExtents: { kt34: ring(3.2), kt50: ring(1.8), kt64: ring(1.0) },
    pastTrack,
    isDemo: true,
  };
}

export const DEMO_NOTE =
  "Demo replay of Hurricane Milton (October 2024). Simplified track built from published NHC facts; times shifted to today for illustration. Not live data.";
