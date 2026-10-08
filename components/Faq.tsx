"use client";

const ITEMS: { q: string; a: string }[] = [
  {
    q: "Where does the storm data come from?",
    a: "Live storm positions, forecast tracks, cones of uncertainty, and wind extents come from the NOAA National Hurricane Center (public domain), refreshed about every 10 minutes. Current weather and wave conditions come from Open-Meteo (CC-BY 4.0). CycloneWatch adds no new forecasting; it repackages official NHC forecasts into per-asset risk scores.",
  },
  {
    q: "Is this an official forecast?",
    a: "No. CycloneWatch is an alerting layer, not a forecast model. The underlying science references Google's open-sourced WeatherNext cyclone models, but this app's tracks come from NHC. Always follow official guidance from NHC and your national meteorological service.",
  },
  {
    q: "How is the 0-100 risk score computed?",
    a: "Four transparent components: proximity (up to 50 points, based on distance to the forecast track, zero beyond 600 km), wind (up to 30 points, scaled to 130 kt and to distance reach), urgency (up to 20 points, full marks when closest approach is now, zero at 120+ hours out, also scaled by reach), plus a 10-point bonus when the asset sits inside the forecast cone. Reach fades from 1 at 0 km to 0 at 1200 km, so a distant storm cannot score high. Every card shows its own math under 'Why this score'.",
  },
  {
    q: "What do Watch, Prepare, and Act mean?",
    a: "Watch (0-33, blue): monitor and review your hurricane plan. Prepare (34-66, amber): secure assets, confirm insurance documents, and plan vessel or cargo movements within 48 hours. Act (67-100, red): execute your storm plan now. The numeric cutoffs are fixed and shown on every card.",
  },
  {
    q: "What is demo mode?",
    a: "When no tropical cyclones are active, or when you toggle it manually, the app shows a labeled replay of Hurricane Milton (October 2024) built from published NHC facts. The track is simplified and times are shifted to today for illustration. Demo content is always badged and never mixed silently with live data.",
  },
  {
    q: "Can I use the data in my own systems?",
    a: "Yes. GET /api/storms returns the active (or demo) storms with tracks, cones, and wind extents as JSON. GET /api/risk?lat=..&lon=.. returns the risk score plus live Open-Meteo conditions for any point. See llms.txt and SKILL.md for agent-friendly documentation.",
  },
  {
    q: "What are the data licenses?",
    a: "NHC storm data is US public domain. Open-Meteo data is CC-BY 4.0 (attribute Open-Meteo.com). This app's code is MIT licensed.",
  },
];

export default function Faq() {
  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-2xl font-bold text-neutral-900 md:text-3xl">
        Frequently asked questions
      </h2>
      <div className="mt-6 space-y-3">
        {ITEMS.map((item) => (
          <details
            key={item.q}
            className="rounded-2xl border border-neutral-200 bg-white px-5 py-4"
          >
            <summary className="cursor-pointer text-[15px] font-semibold text-neutral-900">
              {item.q}
            </summary>
            <p className="mt-2 text-sm leading-6 text-neutral-600">{item.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
