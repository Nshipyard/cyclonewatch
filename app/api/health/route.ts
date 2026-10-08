import { nhcReachable } from "@/lib/nhc";

/** GET /api/health */
export async function GET() {
  const nhc = await nhcReachable();
  return Response.json({
    ok: true,
    service: "cyclonewatch",
    version: "1.0.0",
    time: new Date().toISOString(),
    nhcReachable: nhc,
  });
}
