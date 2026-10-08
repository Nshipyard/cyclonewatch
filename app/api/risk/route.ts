import { NextRequest } from "next/server";
import { buildDemoStorm } from "@/lib/demo";
import { fetchConditions, getLiveStorms } from "@/lib/nhc";
import { worstRisk } from "@/lib/risk";
import type { StormData } from "@/lib/types";

/**
 * GET /api/risk?lat=25.7&lon=-80.2&mode=auto|live|demo
 * Risk score for an arbitrary point plus live OpenMeteo conditions.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const lat = parseFloat(q.get("lat") ?? "");
  const lon = parseFloat(q.get("lon") ?? "");
  if (!isFinite(lat) || !isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return Response.json(
      { error: "Provide valid lat (-90..90) and lon (-180..180) query params." },
      { status: 400 },
    );
  }
  const mode = q.get("mode") ?? "auto";
  const nowMs = Date.now();

  let storms: StormData[];
  let stormMode: string;
  if (mode === "demo") {
    storms = [buildDemoStorm(nowMs)];
    stormMode = "demo";
  } else {
    const live = await getLiveStorms();
    if (live.length > 0) {
      storms = live;
      stormMode = "live";
    } else if (mode === "live") {
      storms = [];
      stormMode = "none";
    } else {
      storms = [buildDemoStorm(nowMs)];
      stormMode = "demo";
    }
  }

  const risk = worstRisk(lat, lon, storms, nowMs);
  const conditions = await fetchConditions(lat, lon);

  return Response.json({
    point: { lat, lon },
    stormMode,
    stormsConsidered: storms.map((s) => ({
      id: s.id,
      name: s.name,
      classLabel: s.classLabel,
      isDemo: s.isDemo,
    })),
    risk,
    conditions,
    formula:
      "score = proximity(0-50) + wind(0-30) + urgency(0-20) + coneBonus(0/10), capped at 100; " +
      "proximity = (1 - distanceKm/600) * 50; reach = max(0, 1 - distanceKm/1200); " +
      "wind = (windKt/130) * 30 * reach; urgency = (1 - leadTimeH/120) * 20 * reach. " +
      "Bands: 0-33 Watch, 34-66 Prepare, 67-100 Act.",
    updatedAt: new Date(nowMs).toISOString(),
  });
}
