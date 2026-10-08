"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import Faq from "@/components/Faq";
import LocationSearch from "@/components/LocationSearch";
import Watchlist from "@/components/Watchlist";
import { PORTS } from "@/lib/ports";
import { worstRisk, BAND_META } from "@/lib/risk";
import { formatUtc } from "@/lib/geo";
import type { Port, StormData, StormsResponse } from "@/lib/types";

const StormMap = dynamic(() => import("@/components/StormMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] w-full items-center justify-center bg-neutral-950 text-sm text-neutral-400 md:h-[560px]">
      Loading map...
    </div>
  ),
});

type Mode = "auto" | "live" | "demo";

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <circle cx="14" cy="14" r="12.5" stroke="#2563eb" strokeWidth="2.5" />
      <path
        d="M14 14 L14 4 A10 10 0 0 1 22.7 9.3 Z"
        fill="#2563eb"
        opacity="0.9"
      />
      <circle cx="14" cy="14" r="3.2" fill="#dc2626" />
    </svg>
  );
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("auto");
  const [data, setData] = useState<StormsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStormId, setSelectedStormId] = useState<string | null>(null);
  const [customLocation, setCustomLocation] = useState<{
    lat: number;
    lon: number;
    label: string;
  } | null>(null);
  const [mapFocus, setMapFocus] = useState<Port | null>(null);
  const [nowMs, setNowMs] = useState(0);

  const setModeAndReload = useCallback((m: Mode) => {
    setMode(m);
    setLoading(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/storms?mode=${mode}`)
      .then((r) => r.json())
      .then((j: StormsResponse) => {
        if (cancelled) return;
        setData(j);
        setSelectedStormId(j.storms[0]?.id ?? null);
        setNowMs(Date.now());
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const storms: StormData[] = useMemo(() => data?.storms ?? [], [data]);

  const portRisks = useMemo(
    () =>
      nowMs > 0
        ? PORTS.map((port) => ({
            port,
            risk: worstRisk(port.lat, port.lon, storms, nowMs),
          }))
        : [],
    [storms, nowMs],
  );

  const actCount = portRisks.filter((p) => p.risk && p.risk.score >= 67).length;
  const prepareCount = portRisks.filter(
    (p) => p.risk && p.risk.score >= 34 && p.risk.score < 67,
  ).length;

  const handleLocate = useCallback((lat: number, lon: number, label: string) => {
    setCustomLocation({ lat, lon, label });
    document.getElementById("map")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleFocusPort = useCallback((port: Port) => {
    setMapFocus(port);
    document.getElementById("map")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const isLive = data?.mode === "live";
  const isDemo = data?.mode === "demo";

  return (
    <div className="min-h-screen bg-white text-neutral-900 antialiased">
      {/* Header */}
      <header className="sticky top-0 z-[1000] border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
          <a href="#top" className="flex items-center gap-2.5">
            <Logo />
            <span className="text-lg font-bold tracking-tight">
              CycloneWatch
            </span>
            {data && (
              <span
                className={`ml-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  isLive
                    ? "bg-red-50 text-red-700"
                    : isDemo
                      ? "bg-amber-50 text-amber-700"
                      : "bg-neutral-100 text-neutral-600"
                }`}
              >
                {isLive
                  ? `Live: ${storms.length} active`
                  : isDemo
                    ? "Demo replay"
                    : "No active storms"}
              </span>
            )}
          </a>
          <nav className="hidden items-center gap-6 text-sm font-medium text-neutral-600 md:flex">
            <a href="#map" className="hover:text-neutral-900">Risk map</a>
            <a href="#watchlist" className="hover:text-neutral-900">Watchlist</a>
            <a href="#model" className="hover:text-neutral-900">Risk model</a>
            <a href="#api" className="hover:text-neutral-900">API</a>
            <a href="#faq" className="hover:text-neutral-900">FAQ</a>
          </nav>
          <a
            href="#check"
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Check a location
          </a>
        </div>
      </header>

      <main id="top">
        {/* Hero */}
        <section className="mx-auto max-w-7xl px-4 pb-10 pt-12 md:px-6 md:pt-20">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
              Tropical cyclone risk alerts
            </p>
            <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              Know when a cyclone is coming for your assets.
            </h1>
            <p className="mt-5 text-lg leading-8 text-neutral-600">
              CycloneWatch turns official hurricane forecasts into a 0-100 risk
              score for every port, vessel route, and coastal facility you care
              about, with the math shown for every score. Built on NOAA
              National Hurricane Center data, refreshed every 10 minutes.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#map"
                className="rounded-xl bg-neutral-900 px-6 py-3 text-sm font-semibold text-white hover:bg-neutral-700"
              >
                View the live risk map
              </a>
              <a
                href="#watchlist"
                className="rounded-xl border border-neutral-300 px-6 py-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
              >
                Browse the port watchlist
              </a>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-4">
              <div className="rounded-2xl bg-neutral-50 p-4">
                <div className="text-2xl font-bold md:text-3xl">
                  {loading || nowMs === 0 ? "..." : storms.length}
                </div>
                <div className="mt-1 text-xs text-neutral-500 md:text-sm">
                  storms tracked
                </div>
              </div>
              <div className="rounded-2xl bg-neutral-50 p-4">
                <div className="text-2xl font-bold md:text-3xl">
                  {PORTS.length}
                </div>
                <div className="mt-1 text-xs text-neutral-500 md:text-sm">
                  ports scored
                </div>
              </div>
              <div className="rounded-2xl bg-neutral-50 p-4">
                <div className="text-2xl font-bold text-red-600 md:text-3xl">
                  {loading || nowMs === 0 ? "..." : actCount + prepareCount}
                </div>
                <div className="mt-1 text-xs text-neutral-500 md:text-sm">
                  at Prepare/Act
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Status + mode toggle */}
        <section className="border-y border-neutral-200 bg-neutral-50">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
            <div className="text-sm text-neutral-600">
              {data ? (
                <>
                  Data updated{" "}
                  <span className="font-medium text-neutral-900">
                    {formatUtc(data.updatedAt)}
                  </span>
                  {" "}· Source: {data.source}
                  {data.note && (
                    <span className="mt-1 block text-amber-700">{data.note}</span>
                  )}
                </>
              ) : (
                "Loading storm data..."
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-neutral-500">
                Data mode:
              </span>
              {(["auto", "live", "demo"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setModeAndReload(m)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize ${
                    mode === m
                      ? "bg-neutral-900 text-white"
                      : "bg-white text-neutral-600 ring-1 ring-neutral-300 hover:bg-neutral-100"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Map */}
        <section id="map" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-10 md:px-6 md:py-14">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                Live risk map
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                Forecast cones, wind extents, and every watched port colored by
                its risk band. Select a storm to focus it.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {storms.map((s) => (
                <button
                  key={s.id}
                  onClick={() =>
                    setSelectedStormId(selectedStormId === s.id ? null : s.id)
                  }
                  className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                    selectedStormId === s.id
                      ? "bg-neutral-900 text-white"
                      : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                  }`}
                >
                  {s.classLabel} {s.name} · {s.intensityKt} kt
                  {s.isDemo ? " (demo)" : ""}
                </button>
              ))}
            </div>
          </div>

          {data?.mode === "none" ? (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-10 text-center">
              <h3 className="text-xl font-semibold">
                No active tropical cyclones right now
              </h3>
              <p className="mx-auto mt-2 max-w-xl text-sm text-neutral-600">
                The Atlantic and Pacific basins are quiet. Switch to demo mode
                above to explore the interface with a labeled replay of
                Hurricane Milton (October 2024).
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl bg-neutral-950 shadow-xl ring-1 ring-neutral-900/10">
              {loading || !data ? (
                <div className="flex h-[420px] items-center justify-center text-sm text-neutral-400 md:h-[560px]">
                  Loading storm data...
                </div>
              ) : (
                <StormMap
                  storms={storms}
                  portRisks={portRisks}
                  customLocation={customLocation}
                  selectedStormId={selectedStormId}
                  onStormSelect={setSelectedStormId}
                />
              )}
            </div>
          )}
          {mapFocus && (
            <p className="mt-2 text-xs text-neutral-500">
              Centered view requested for {mapFocus.name}. Port markers show
              risk bands; click any marker for details.
            </p>
          )}
        </section>

        {/* Watchlist */}
        <section
          id="watchlist"
          className="scroll-mt-20 border-t border-neutral-200 bg-neutral-50"
        >
          <div className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              Port watchlist
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-neutral-500">
              {PORTS.length} major container ports, scored against every active
              storm and sorted by risk. Each card shows the math behind its
              score and an alert timeline.
            </p>
            <div className="mt-6">
              {data && nowMs > 0 ? (
                <Watchlist
                  storms={storms}
                  ports={PORTS}
                  nowMs={nowMs}
                  onFocusPort={handleFocusPort}
                />
              ) : (
                <p className="text-sm text-neutral-500">Loading...</p>
              )}
            </div>
          </div>
        </section>

        {/* Location check */}
        <section id="check" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-10 md:px-6 md:py-14">
          <div className="grid gap-8 md:grid-cols-5">
            <div className="md:col-span-2">
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                Check any location
              </h2>
              <p className="mt-3 text-sm leading-6 text-neutral-600">
                A vessel position, a warehouse, a coastal facility: enter its
                coordinates and get live conditions from Open-Meteo plus the
                cyclone risk score for that exact point, computed with the same
                transparent formula as the port watchlist.
              </p>
              <div className="mt-6 space-y-3">
                {(
                  [
                    ["Miami, USA", "25.77,-80.17"],
                    ["Houston, USA", "29.72,-95.08"],
                    ["Freeport, Bahamas", "26.53,-78.70"],
                  ] as const
                ).map(([label, coords]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-2.5 text-sm"
                  >
                    <span className="font-medium text-neutral-800">{label}</span>
                    <span className="text-neutral-400">{coords}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="md:col-span-3">
              <LocationSearch onLocate={handleLocate} />
            </div>
          </div>
        </section>

        {/* Risk model */}
        <section
          id="model"
          className="scroll-mt-20 border-t border-neutral-200 bg-neutral-50"
        >
          <div className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              How the risk score works
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
              No black box. For each asset and each storm, the score adds four
              components, capped at 100. Wind and urgency are scaled by reach
              (1 at 0 km, fading to 0 at 1200 km) so a distant storm cannot
              drive a high score. The worst storm drives the asset&apos;s
              score, and every card shows its own numbers.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-4">
              {[
                {
                  name: "Proximity",
                  pts: "0-50",
                  text: "(1 - distance to forecast track / 600 km) x 50. An asset on the track scores 50; beyond 600 km it scores 0.",
                },
                {
                  name: "Wind",
                  pts: "0-30",
                  text: "(max sustained wind at closest forecast point / 130 kt) x 30 x reach. A 130 kt major hurricane scores the full 30 at close range.",
                },
                {
                  name: "Urgency",
                  pts: "0-20",
                  text: "(1 - lead time / 120 h) x 20 x reach. Closest approach happening now scores 20; 120+ hours out scores 0.",
                },
                {
                  name: "Cone bonus",
                  pts: "0 or 10",
                  text: "10 points when the asset sits inside the official forecast cone of uncertainty, 0 when it does not.",
                },
              ].map((c) => (
                <div
                  key={c.name}
                  className="rounded-2xl border border-neutral-200 bg-white p-5"
                >
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-semibold text-neutral-900">{c.name}</h3>
                    <span className="text-sm font-bold text-blue-600">
                      {c.pts}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">
                    {c.text}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {(Object.keys(BAND_META) as (keyof typeof BAND_META)[]).map(
                (b) => {
                  const meta = BAND_META[b];
                  const range =
                    b === "watch" ? "0-33" : b === "prepare" ? "34-66" : "67-100";
                  return (
                    <div
                      key={b}
                      className="flex items-center gap-2 rounded-full px-4 py-2 text-sm"
                      style={{ backgroundColor: meta.softBg }}
                    >
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: meta.color }}
                      />
                      <span className="font-semibold" style={{ color: meta.color }}>
                        {meta.label} {range}:
                      </span>{" "}
                      <span className="text-neutral-600">{meta.action}</span>
                    </div>
                  );
                },
              )}
            </div>
          </div>
        </section>

        {/* API */}
        <section id="api" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-10 md:px-6 md:py-14">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            API for agents and systems
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
            Three endpoints, no key, JSON out. Poll /api/storms every 10
            minutes for the current picture; call /api/risk for any coordinate
            your fleet or facility cares about.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              {
                method: "GET",
                path: "/api/storms?mode=auto",
                text: "Active (or demo) storms with forecast tracks, cones of uncertainty, wind extents, and past tracks.",
              },
              {
                method: "GET",
                path: "/api/risk?lat=25.77&lon=-80.17",
                text: "Risk score for any point, with the component math, plus live Open-Meteo conditions.",
              },
              {
                method: "GET",
                path: "/api/health",
                text: "Service status and NHC reachability probe.",
              },
            ].map((e) => (
              <div
                key={e.path}
                className="rounded-2xl border border-neutral-200 bg-white p-5"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">
                    {e.method}
                  </span>
                  <code className="truncate text-sm font-medium text-neutral-900">
                    {e.path}
                  </code>
                </div>
                <p className="mt-2 text-sm leading-6 text-neutral-600">{e.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl bg-neutral-950 p-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Example response: /api/risk
            </p>
            <pre className="overflow-x-auto text-xs leading-5 text-neutral-200">
{`{
  "point": { "lat": 25.77, "lon": -80.17 },
  "stormMode": "live",
  "risk": {
    "score": 82,
    "band": "act",
    "stormName": "Isaias",
    "closestDistanceKm": 145,
    "closestWindKt": 95,
    "leadTimeHours": 31,
    "inCone": true,
    "components": { "proximity": 37.9, "wind": 21.9, "urgency": 14.8, "coneBonus": 10 }
  },
  "conditions": { "temperatureC": 29.7, "windKph": 29.6, "waveHeightM": 0.34 }
}`}
            </pre>
          </div>
        </section>

        {/* FAQ */}
        <section
          id="faq"
          className="scroll-mt-20 border-t border-neutral-200 bg-neutral-50"
        >
          <div className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14">
            <Faq />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200">
        <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <div className="flex items-center gap-2.5">
                <Logo />
                <span className="font-bold">CycloneWatch</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-neutral-500">
                Hyperlocal tropical cyclone risk alerts for shipping, insurance,
                and coastal communities. Open source, MIT licensed.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold">Data sources</h3>
              <ul className="mt-3 space-y-2 text-sm text-neutral-500">
                <li>Storm tracks and forecasts: NOAA National Hurricane Center (public domain)</li>
                <li>Weather and marine conditions: Open-Meteo (CC-BY 4.0)</li>
                <li>Map tiles: Esri World Dark Gray, HERE, Garmin, OpenStreetMap contributors</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold">Safety</h3>
              <p className="mt-3 text-sm leading-6 text-neutral-500">
                CycloneWatch is an alerting layer, not an official forecast.
                Always follow guidance from the National Hurricane Center and
                your national meteorological service.
              </p>
            </div>
          </div>
          <div className="mt-8 border-t border-neutral-200 pt-6 text-xs text-neutral-400">
            CycloneWatch 1.0.0 · MIT License · Not affiliated with NOAA or Google.
          </div>
        </div>
      </footer>
    </div>
  );
}
