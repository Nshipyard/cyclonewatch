import { NextRequest } from "next/server";

const TILE_BASE =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile";

/**
 * GET /api/tiles/{z}/{x}/{y}.png
 * Same-origin proxy for Esri World Dark Gray basemap tiles (Esri, HERE,
 * Garmin, OpenStreetMap contributors; attribution retained on the map).
 * Keeps tile loading working for clients behind restrictive networks and
 * allows edge caching. Esri tile URLs use {z}/{y}/{x} ordering.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const parts = (await params).path;
  if (parts.length !== 3) {
    return new Response("Not found", { status: 404 });
  }
  const [z, x, yPng] = parts;
  const y = yPng.replace(/\.png$/, "");
  if (
    !/^\d{1,2}$/.test(z) || parseInt(z, 10) > 18 ||
    !/^\d+$/.test(x) || !/^\d+$/.test(y)
  ) {
    return new Response("Bad tile coordinates", { status: 400 });
  }
  try {
    const res = await fetch(`${TILE_BASE}/${z}/${y}/${x}`, {
      headers: {
        "User-Agent": "CycloneWatch/1.0 (open-source cyclone risk alerts)",
        Referer: "https://www.openstreetmap.org/",
      },
    });
    if (!res.ok) return new Response("Tile unavailable", { status: 502 });
    const buf = await res.arrayBuffer();
    return new Response(buf, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new Response("Tile unavailable", { status: 502 });
  }
}
