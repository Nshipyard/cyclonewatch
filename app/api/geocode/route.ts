import { NextRequest } from "next/server";

/**
 * GET /api/geocode?name=miami&count=5
 * Keyless place-name lookup via the Open-Meteo geocoding API (CC-BY 4.0).
 * Returns up to `count` matches as { name, country, admin1, lat, lon }.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const name = (q.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 100) {
    return Response.json(
      { error: "Provide a place name of 2-100 characters." },
      { status: 400 },
    );
  }
  const count = Math.min(Math.max(parseInt(q.get("count") ?? "5", 10) || 5, 1), 10);
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=${count}&language=en&format=json`,
      {
        signal: ctrl.signal,
        cache: "no-store",
        headers: { "User-Agent": "CycloneWatch/1.0 (open-source cyclone risk alerts)" },
      },
    ).finally(() => clearTimeout(t));
    if (!res.ok) throw new Error(`geocoding status ${res.status}`);
    const j = (await res.json()) as {
      results?: {
        name: string;
        country?: string;
        admin1?: string;
        latitude: number;
        longitude: number;
      }[];
    };
    const results = (j.results ?? []).map((r) => ({
      name: r.name,
      country: r.country ?? "",
      admin1: r.admin1 ?? "",
      lat: r.latitude,
      lon: r.longitude,
    }));
    return Response.json({ query: name, results });
  } catch {
    return Response.json(
      { error: "Place lookup is unavailable right now. Try coordinates instead." },
      { status: 502 },
    );
  }
}
