// Server-side NOAA NHC data layer.
// Sources (all free, no key):
// - https://www.nhc.noaa.gov/CurrentStorms.json      (active storm list)
// - https://www.nhc.noaa.gov/gis/kml/nhc_active.kml  (links to per-storm KMZ files)
// - https://www.nhc.noaa.gov/text/MIATCMAT4.shtml    (forecast advisory text, has <pre>)
// - https://www.nhc.noaa.gov/storm_graphics/api/...  (cone / track / wind-radii KMZ)
// - https://www.nhc.noaa.gov/gis/best_track/...      (past track KMZ)
// NHC data is US public domain.
import { unzipSync } from "fflate";
import type { ForecastPoint, Polygon, StormData } from "./types";

const NHC = "https://www.nhc.noaa.gov";
const CACHE_TTL_MS = 10 * 60 * 1000;

async function fetchWithTimeout(url: string, ms = 15000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: { "User-Agent": "CycloneWatch/1.0 (open-source cyclone risk alerts)" },
    });
  } finally {
    clearTimeout(t);
  }
}

interface ActiveStormJson {
  id: string;
  name: string;
  classification: string;
  intensity: string;
  pressure: string;
  latitudeNumeric: number;
  longitudeNumeric: number;
  movementDir: number;
  movementSpeed: number;
  lastUpdate: string;
  publicAdvisory?: { url?: string };
  forecastAdvisory?: { url?: string };
}

const CLASS_LABELS: Record<string, string> = {
  HU: "Hurricane",
  TY: "Typhoon",
  TS: "Tropical Storm",
  TD: "Tropical Depression",
  STS: "Subtropical Storm",
  EX: "Extratropical",
  LO: "Low",
};

function parseLatLon(latS: string, hemi: "N" | "S", lonS: string, lonHemi: "W" | "E") {
  const lat = parseFloat(latS) * (hemi === "S" ? -1 : 1);
  const lon = parseFloat(lonS) * (lonHemi === "W" ? -1 : 1);
  return { lat, lon };
}

const MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

interface TcmParsed {
  advisoryTimeMs: number;
  points: ForecastPoint[];
}

/** Parse the NHC forecast advisory (<pre>) text into forecast points. */
function parseTcm(pre: string): TcmParsed | null {
  const head = pre.match(/(\d{4}) UTC \w{3} (\w{3}) (\d{2}) (\d{4})/);
  if (!head) return null;
  const [, hhmm, monS, dayS, yearS] = head;
  const month = MONTHS[monS];
  const year = parseInt(yearS, 10);
  const day = parseInt(dayS, 10);
  const advisoryTimeMs = Date.UTC(
    year, month, day,
    parseInt(hhmm.slice(0, 2), 10),
    parseInt(hhmm.slice(2), 10),
  );

  const points: ForecastPoint[] = [];
  const re =
    /FORECAST VALID (\d{2})\/(\d{4})Z\s+([\d.]+)(N|S)\s+([\d.]+)(W|E)([\s\S]*?)(?=FORECAST VALID|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(pre)) !== null) {
    const [, vDayS, vHm, latS, latH, lonS, lonH, rest] = m;
    const vDay = parseInt(vDayS, 10);
    let vMonth = month;
    let vYear = year;
    if (vDay < day - 15) {
      vMonth = month + 1;
      if (vMonth > 11) { vMonth = 0; vYear += 1; }
    }
    const time = new Date(
      Date.UTC(
        vYear, vMonth, vDay,
        parseInt(vHm.slice(0, 2), 10),
        parseInt(vHm.slice(2), 10),
      ),
    ).toISOString();
    const { lat, lon } = parseLatLon(latS, latH as "N" | "S", lonS, lonH as "W" | "E");
    const w = rest.match(/MAX WIND\s+(\d+)\s*KT/);
    points.push({ time, lat, lon, windKt: w ? parseInt(w[1], 10) : 0 });
  }
  return { advisoryTimeMs, points };
}

function parseCoordString(s: string): [number, number][] {
  return s
    .trim()
    .split(/\s+/)
    .map((tok) => tok.split(","))
    .filter((p) => p.length >= 2)
    .map((p) => [parseFloat(p[1]), parseFloat(p[0])] as [number, number])
    .filter((p) => isFinite(p[0]) && isFinite(p[1]));
}

/** Fetch a KMZ, unzip, return the first .kml document text. */
async function fetchKmzText(url: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    const files = unzipSync(buf);
    for (const name of Object.keys(files)) {
      if (name.toLowerCase().endsWith(".kml")) {
        return new TextDecoder().decode(files[name]);
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Longest coordinate ring in a KML doc (used for the cone polygon). */
function longestPolygon(kml: string): Polygon {
  const re = /<coordinates>([\s\S]*?)<\/coordinates>/g;
  let m: RegExpExecArray | null;
  let best: Polygon = [];
  while ((m = re.exec(kml)) !== null) {
    const pts = parseCoordString(m[1]);
    if (pts.length > best.length) best = pts;
  }
  return best;
}

/** Placemark name -> polygon for wind radii (names are "34", "50", "64"). */
function namedPolygons(kml: string): Record<string, Polygon> {
  const out: Record<string, Polygon> = {};
  const pmRe = /<Placemark>([\s\S]*?)<\/Placemark>/g;
  let pm: RegExpExecArray | null;
  while ((pm = pmRe.exec(kml)) !== null) {
    const body = pm[1];
    const nm = body.match(/<name>\s*(\d+)\s*<\/name>/);
    const cm = body.match(/<coordinates>([\s\S]*?)<\/coordinates>/);
    if (nm && cm) out[nm[1]] = parseCoordString(cm[1]);
  }
  return out;
}

/** Map NHC wallet folder id -> { atcfId, coneUrl, radiiUrl, bestTrackUrl } from nhc_active.kml */
function parseActiveKmlLinks(kml: string): Record<string, { atcfId: string; cone?: string; radii?: string }> {
  const out: Record<string, { atcfId: string; cone?: string; radii?: string }> = {};
  const folderRe = /<Folder id="([a-z0-9]+)">([\s\S]*?)<\/Folder>\s*<Folder id=/g;
  // Simpler: split on Folder ids
  const parts = kml.split(/<Folder id="/);
  for (const part of parts.slice(1)) {
    const id = part.slice(0, part.indexOf('"'));
    const atcf = part.match(/<Data name="atcfID">\s*<value>([A-Z0-9]+)<\/value>/);
    const cone = part.match(/<href>(https:\/\/www\.nhc\.noaa\.gov\/storm_graphics\/api\/[^<]*_CONE\.kmz)<\/href>/);
    const radii = part.match(/<href>(https:\/\/www\.nhc\.noaa\.gov\/storm_graphics\/api\/[^<]*initialradii[^<]*\.kmz)<\/href>/);
    if (atcf) {
      out[id] = {
        atcfId: atcf[1],
        cone: cone?.[1],
        radii: radii?.[1],
      };
    }
  }
  void folderRe;
  return out;
}

async function fetchTcm(s: ActiveStormJson): Promise<{
  forecast: ForecastPoint[];
  advisoryTime: string;
}> {
  const fallback = { forecast: [] as ForecastPoint[], advisoryTime: s.lastUpdate };
  if (!s.forecastAdvisory?.url) return fallback;
  try {
    const res = await fetchWithTimeout(s.forecastAdvisory.url);
    if (!res.ok) return fallback;
    const htmlText = await res.text();
    const pre = htmlText.match(/<pre>([\s\S]*?)<\/pre>/);
    if (!pre) return fallback;
    const parsed = parseTcm(pre[1]);
    if (!parsed || parsed.points.length === 0) return fallback;
    return {
      forecast: parsed.points,
      advisoryTime: new Date(parsed.advisoryTimeMs).toISOString(),
    };
  } catch {
    return fallback;
  }
}

async function fetchGeometry(
  entry: { cone?: string; radii?: string } | undefined,
  stormId: string,
): Promise<{
  cone: Polygon;
  windExtents: { kt34: Polygon; kt50: Polygon; kt64: Polygon };
  pastTrack: [number, number][];
}> {
  const windExtents = { kt34: [] as Polygon, kt50: [] as Polygon, kt64: [] as Polygon };
  let cone: Polygon = [];
  let pastTrack: [number, number][] = [];
  const jobs: Promise<void>[] = [];
  if (entry?.cone) {
    jobs.push(
      fetchKmzText(entry.cone).then((kml) => {
        if (kml) cone = longestPolygon(kml);
      }),
    );
  }
  if (entry?.radii) {
    jobs.push(
      fetchKmzText(entry.radii).then((kml) => {
        if (kml) {
          const named = namedPolygons(kml);
          if (named["34"]) windExtents.kt34 = named["34"];
          if (named["50"]) windExtents.kt50 = named["50"];
          if (named["64"]) windExtents.kt64 = named["64"];
        }
      }),
    );
  }
  jobs.push(
    fetchKmzText(`${NHC}/gis/best_track/${stormId.toLowerCase()}_best_track.kmz`).then(
      (kml) => {
        if (kml) pastTrack = longestPolygon(kml);
      },
    ),
  );
  await Promise.all(jobs);
  return { cone, windExtents, pastTrack };
}

async function buildStorm(
  s: ActiveStormJson,
  links: Record<string, { atcfId: string; cone?: string; radii?: string }>,
): Promise<StormData | null> {
  try {
    const entry = Object.values(links).find(
      (l) => l.atcfId === s.id.toUpperCase(),
    );
    const [tcm, geo] = await Promise.all([
      fetchTcm(s),
      fetchGeometry(entry, s.id),
    ]);
    const intensityKt = parseInt(s.intensity, 10) || 0;
    return {
      id: s.id.toLowerCase(),
      name: s.name,
      classification: s.classification,
      classLabel: CLASS_LABELS[s.classification] ?? s.classification,
      intensityKt,
      pressureMb:
        s.pressure && s.pressure !== "" ? parseInt(s.pressure, 10) || null : null,
      lat: s.latitudeNumeric,
      lon: s.longitudeNumeric,
      movement: `toward ${s.movementDir} degrees at ${s.movementSpeed} kt`,
      advisoryTime: tcm.advisoryTime,
      advisoryUrl: s.publicAdvisory?.url ?? `https://www.nhc.noaa.gov/`,
      forecast: tcm.forecast,
      cone: geo.cone,
      windExtents: geo.windExtents,
      pastTrack: geo.pastTrack,
      isDemo: false,
    };
  } catch {
    return null;
  }
}

let cache: { at: number; storms: StormData[] } | null = null;

export async function getLiveStorms(): Promise<StormData[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.storms;
  try {
    const [res, kmlRes] = await Promise.all([
      fetchWithTimeout(`${NHC}/CurrentStorms.json`),
      fetchWithTimeout(`${NHC}/gis/kml/nhc_active.kml`).catch(() => null),
    ]);
    if (!res.ok) throw new Error(`NHC status ${res.status}`);
    const data = (await res.json()) as { activeStorms?: ActiveStormJson[] };
    const list = data.activeStorms ?? [];
    const links =
      kmlRes && kmlRes.ok ? parseActiveKmlLinks(await kmlRes.text()) : {};
    const built = await Promise.all(list.map((s) => buildStorm(s, links)));
    const storms = built.filter((s): s is StormData => s !== null);
    cache = { at: Date.now(), storms };
    return storms;
  } catch {
    return cache?.storms ?? [];
  }
}

/** Quick NHC reachability probe for /api/health. */
export async function nhcReachable(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${NHC}/CurrentStorms.json`, 8000);
    return res.ok;
  } catch {
    return false;
  }
}

// ---------- OpenMeteo (CC-BY 4.0) ----------

export interface Conditions {
  temperatureC: number | null;
  windKph: number | null;
  weatherCode: number | null;
  weatherLabel: string;
  waveHeightM: number | null;
  time: string;
}

const WMO: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Depositing rime fog", 51: "Light drizzle", 53: "Moderate drizzle",
  55: "Dense drizzle", 56: "Light freezing drizzle", 57: "Dense freezing drizzle",
  61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
  66: "Light freezing rain", 67: "Heavy freezing rain",
  71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow", 77: "Snow grains",
  80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
  85: "Slight snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail",
};

async function fetchJson<T>(url: string, ms: number): Promise<T> {
  const res = await fetchWithTimeout(url, ms);
  if (!res.ok) throw new Error(`status ${res.status}`);
  return (await res.json()) as T;
}

interface WeatherPayload {
  current?: {
    time: string;
    temperature_2m: number;
    wind_speed_10m: number;
    weather_code: number;
  };
}

interface MarinePayload {
  current?: { wave_height: number };
}

export async function fetchConditions(lat: number, lon: number): Promise<Conditions | null> {
  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,wind_speed_10m,weather_code&timezone=auto`;
  const marineUrl =
    `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}` +
    `&current=wave_height&timezone=auto`;

  // Marine is a nice-to-have: one short attempt, launched in parallel, and it
  // can never fail the response.
  const marinePromise: Promise<number | null> = fetchJson<MarinePayload>(marineUrl, 5000)
    .then((mj) => mj.current?.wave_height ?? null)
    .catch(() => null);

  // Weather is essential: two bounded attempts (6s each). One slow upstream
  // call can no longer hold the API for 14 seconds.
  let weather: WeatherPayload | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const j = await fetchJson<WeatherPayload>(weatherUrl, 6000);
      if (j.current) {
        weather = j;
        break;
      }
    } catch {
      // Retry once, then give up on weather below.
    }
  }

  const waveHeightM = await marinePromise;
  const c = weather?.current;
  if (!c) return null;
  return {
    temperatureC: c.temperature_2m ?? null,
    windKph: c.wind_speed_10m ?? null,
    weatherCode: c.weather_code ?? null,
    weatherLabel: WMO[c.weather_code] ?? "Unknown",
    waveHeightM,
    time: c.time,
  };
}
