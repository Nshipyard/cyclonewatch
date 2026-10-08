"use client";

import { useMemo, useState } from "react";
import {
  buildTimeline,
  worstRisk,
  BAND_META,
} from "@/lib/risk";
import { formatHours, formatKm, formatUtc, timeUntil } from "@/lib/geo";
import type { Port, RiskResult, StormData, TimelineEntry } from "@/lib/types";

interface Props {
  storms: StormData[];
  ports: Port[];
  nowMs: number;
  onFocusPort: (port: Port) => void;
}

interface CardData {
  port: Port;
  risk: RiskResult | null;
  timeline: TimelineEntry[];
}

function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
      {entries.map((e) => (
        <div
          key={e.label}
          className="rounded-xl bg-neutral-50 px-3 py-2 text-xs"
        >
          <div className="font-semibold text-neutral-900">{e.label}</div>
          {e.beyondForecast ? (
            <div className="text-neutral-500">No NHC forecast point this far out</div>
          ) : (
            <>
              <div className="text-neutral-700">
                {e.distanceKm !== null ? formatKm(e.distanceKm) : "n/a"} away
              </div>
              <div className="text-neutral-500">
                {e.windKt !== null ? `${e.windKt} kt winds` : ""}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function WhyScore({ risk }: { risk: RiskResult }) {
  const c = risk.components;
  return (
    <details className="mt-3 rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
      <summary className="cursor-pointer font-semibold text-neutral-900">
        Why this score: {risk.score}/100
      </summary>
      <ul className="mt-2 space-y-1">
        <li>
          Proximity {c.proximity.toFixed(1)}/50: closest approach{" "}
          {formatKm(risk.closestDistanceKm)} from the forecast track.
        </li>
        <li>
          Wind {c.wind.toFixed(1)}/30: {risk.closestWindKt} kt max sustained wind
          at the closest forecast point, scaled by distance reach.
        </li>
        <li>
          Urgency {c.urgency.toFixed(1)}/20: closest approach{" "}
          {risk.leadTimeHours <= 0
            ? "is happening now"
            : `in ${formatHours(risk.leadTimeHours)}`}
          , scaled by distance reach.
        </li>
        <li>
          Cone bonus {c.coneBonus}/10:{" "}
          {risk.inCone
            ? "the asset sits inside the forecast cone of uncertainty."
            : "the asset is outside the forecast cone."}
        </li>
      </ul>
      <p className="mt-2 text-neutral-500">
        Formula: score = proximity + wind + urgency + cone bonus, capped at 100.
        Wind and urgency are scaled by reach (1 at 0 km, 0 beyond 1200 km) so a
        distant storm cannot score high on intensity or timing alone. Bands:
        0-33 Watch, 34-66 Prepare, 67-100 Act.
      </p>
    </details>
  );
}

export default function Watchlist({ storms, ports, nowMs, onFocusPort }: Props) {
  const [filter, setFilter] = useState<"all" | "prepare" | "act">("all");

  const cards = useMemo<CardData[]>(() => {
    const list = ports.map((port) => {
      const risk = worstRisk(port.lat, port.lon, storms, nowMs);
      const driving = risk
        ? storms.find((s) => s.id === risk.stormId)
        : undefined;
      const timeline = risk && driving ? buildTimeline(port.lat, port.lon, driving, nowMs) : [];
      return { port, risk, timeline };
    });
    list.sort((a, b) => (b.risk?.score ?? 0) - (a.risk?.score ?? 0));
    return list;
  }, [storms, ports, nowMs]);

  const visible = cards.filter((c) => {
    if (filter === "all") return true;
    if (!c.risk) return false;
    return filter === "act" ? c.risk.band === "act" : c.risk.band !== "watch";
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["all", "prepare", "act"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              filter === f
                ? "bg-neutral-900 text-white"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
            }`}
          >
            {f === "all" ? "All assets" : f === "prepare" ? "Prepare and Act" : "Act only"}
          </button>
        ))}
        <span className="ml-auto text-sm text-neutral-500">
          {visible.length} of {cards.length} assets shown, sorted by risk
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {visible.map(({ port, risk, timeline }) => {
          const band = risk ? risk.band : "watch";
          const meta = BAND_META[band];
          const score = risk ? risk.score : 0;
          return (
            <article
              key={port.name}
              className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-neutral-900">
                    {port.name}
                  </h3>
                  <p className="text-sm text-neutral-500">
                    {port.country} · {port.lat.toFixed(2)}, {port.lon.toFixed(2)}
                  </p>
                </div>
                <div
                  className="flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5"
                  style={{ backgroundColor: meta.softBg }}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: meta.color }}
                  />
                  <span
                    className="text-sm font-bold"
                    style={{ color: meta.color }}
                  >
                    {score}
                  </span>
                  <span className="text-xs font-medium text-neutral-600">
                    {meta.label}
                  </span>
                </div>
              </div>

              {risk && risk.closestDistanceKm <= 1200 ? (
                <>
                  <p className="mt-3 text-sm text-neutral-700">
                    {risk.stormClassLabel} {risk.stormName}: closest approach{" "}
                    {formatKm(risk.closestDistanceKm)},{" "}
                    {timeUntil(Date.parse(risk.closestPoint.time), nowMs)} (
                    {formatUtc(risk.closestPoint.time)}), winds{" "}
                    {risk.closestWindKt} kt.
                  </p>
                  <p className="mt-2 text-sm font-medium" style={{ color: meta.color }}>
                    {meta.action}
                  </p>
                  <Timeline entries={timeline} />
                  <WhyScore risk={risk} />
                </>
              ) : risk ? (
                <p className="mt-3 text-sm text-neutral-600">
                  No tropical cyclone within 1,200 km of this asset. Nearest
                  system: {risk.stormClassLabel} {risk.stormName},{" "}
                  {formatKm(risk.closestDistanceKm)} away.
                </p>
              ) : (
                <p className="mt-3 text-sm text-neutral-500">
                  No storm track data available for scoring right now.
                </p>
              )}

              <button
                onClick={() => onFocusPort(port)}
                className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                Show on map
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
