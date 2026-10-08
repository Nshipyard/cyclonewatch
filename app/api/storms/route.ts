import { NextRequest } from "next/server";
import { buildDemoStorm, DEMO_NOTE } from "@/lib/demo";
import { getLiveStorms } from "@/lib/nhc";
import type { StormsResponse } from "@/lib/types";

/**
 * GET /api/storms?mode=auto|live|demo
 * auto (default): live NHC data when storms are active, otherwise the labeled
 * demo replay. live: only real data (mode "none" when quiet). demo: the replay.
 */
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("mode") ?? "auto";
  const now = new Date();

  if (mode === "demo") {
    const body: StormsResponse = {
      mode: "demo",
      storms: [buildDemoStorm(now.getTime())],
      updatedAt: now.toISOString(),
      source: "demo replay",
      note: DEMO_NOTE,
    };
    return Response.json(body);
  }

  const live = await getLiveStorms();
  if (live.length > 0) {
    const body: StormsResponse = {
      mode: "live",
      storms: live,
      updatedAt: now.toISOString(),
      source: "NOAA National Hurricane Center (public domain)",
    };
    return Response.json(body);
  }

  if (mode === "live") {
    const body: StormsResponse = {
      mode: "none",
      storms: [],
      updatedAt: now.toISOString(),
      source: "NOAA National Hurricane Center (public domain)",
      note: "No active tropical cyclones right now.",
    };
    return Response.json(body);
  }

  const body: StormsResponse = {
    mode: "demo",
    storms: [buildDemoStorm(now.getTime())],
    updatedAt: now.toISOString(),
    source: "demo replay",
    note:
      "No active tropical cyclones right now. Showing a labeled demo replay instead. " +
      DEMO_NOTE,
  };
  return Response.json(body);
}
