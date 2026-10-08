"use client";

import { useState } from "react";
import { BAND_META, bandFor } from "@/lib/risk";
import { formatKm, formatHours } from "@/lib/geo";

interface RiskApiResult {
  point: { lat: number; lon: number };
  stormMode: string;
  stormsConsidered: { id: string; name: string; classLabel: string; isDemo: boolean }[];
  risk: {
    score: number;
    stormName: string;
    stormClassLabel: string;
    closestDistanceKm: number;
    closestWindKt: number;
    leadTimeHours: number;
    inCone: boolean;
    components: { proximity: number; wind: number; urgency: number; coneBonus: number };
  } | null;
  conditions: {
    temperatureC: number | null;
    windKph: number | null;
    weatherLabel: string;
    waveHeightM: number | null;
  } | null;
}

interface Props {
  onLocate: (lat: number, lon: number, label: string) => void;
}

const PRESETS = [
  { label: "Miami, USA", lat: 25.77, lon: -80.17 },
  { label: "Houston, USA", lat: 29.72, lon: -95.08 },
  { label: "Freeport, Bahamas", lat: 26.53, lon: -78.7 },
] as const;

interface GeocodeHit {
  name: string;
  country: string;
  admin1: string;
  lat: number;
  lon: number;
}

export default function LocationSearch({ onLocate }: Props) {
  const [lat, setLat] = useState("25.77");
  const [lon, setLon] = useState("-80.17");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RiskApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [place, setPlace] = useState("");
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  async function searchPlace(e: React.FormEvent) {
    e.preventDefault();
    const q = place.trim();
    if (q.length < 2) {
      setSearchError("Type at least 2 characters.");
      return;
    }
    setSearching(true);
    setSearchError(null);
    setHits([]);
    try {
      const res = await fetch(`/api/geocode?name=${encodeURIComponent(q)}&count=5`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Lookup returned ${res.status}`);
      const list = data.results as GeocodeHit[];
      setHits(list);
      if (list.length === 0) setSearchError(`No matches for "${q}". Try coordinates below.`);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Place lookup failed.");
    } finally {
      setSearching(false);
    }
  }

  function pickPlace(hit: GeocodeHit) {
    setLat(hit.lat.toFixed(2));
    setLon(hit.lon.toFixed(2));
    setHits([]);
    setPlace("");
    const label = [hit.name, hit.admin1, hit.country].filter(Boolean).join(", ");
    check(hit.lat, hit.lon, label);
  }

  async function check(la: number, lo: number, label: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/risk?lat=${encodeURIComponent(la)}&lon=${encodeURIComponent(lo)}`,
      );
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const data = (await res.json()) as RiskApiResult;
      setResult(data);
      onLocate(la, lo, label);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const la = parseFloat(lat);
    const lo = parseFloat(lon);
    if (!isFinite(la) || !isFinite(lo)) {
      setError("Enter valid numbers for latitude and longitude.");
      return;
    }
    check(la, lo, `${la.toFixed(2)}, ${lo.toFixed(2)}`);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not available in this browser.");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = pos.coords.latitude;
        const lo = pos.coords.longitude;
        setLat(la.toFixed(2));
        setLon(lo.toFixed(2));
        check(la, lo, "Your location");
      },
      () => {
        setLoading(false);
        setError("Could not get your location. Enter coordinates manually.");
      },
    );
  }

  const band = result?.risk ? bandFor(result.risk.score) : null;
  const meta = band ? BAND_META[band] : null;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
      <h3 className="text-lg font-semibold text-neutral-900">
        Check any location
      </h3>
      <p className="mt-1 text-sm text-neutral-500">
        Search a place by name, or enter coordinates, to get live conditions
        from Open-Meteo plus the cyclone risk score for that exact point.
      </p>

      <form onSubmit={searchPlace} className="mt-4 flex gap-2">
        <label className="flex-1">
          <span className="text-xs font-medium text-neutral-600">Place name</span>
          <input
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-blue-600 focus:outline-none"
            placeholder="e.g. New Orleans"
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={searching || loading}
            className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {searching ? "Searching..." : "Find"}
          </button>
        </div>
      </form>

      {searchError && (
        <p className="mt-2 text-sm text-red-700">{searchError}</p>
      )}

      {hits.length > 0 && (
        <ul className="mt-2 divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
          {hits.map((h, i) => (
            <li key={`${h.lat},${h.lon},${i}`}>
              <button
                type="button"
                onClick={() => pickPlace(h)}
                className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm hover:bg-neutral-50"
              >
                <span className="font-medium text-neutral-900">
                  {h.name}
                  <span className="ml-2 font-normal text-neutral-500">
                    {[h.admin1, h.country].filter(Boolean).join(", ")}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-neutral-400">
                  {h.lat.toFixed(2)}, {h.lon.toFixed(2)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-neutral-500">Try:</span>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            disabled={loading}
            onClick={() => {
              setLat(p.lat.toFixed(2));
              setLon(p.lon.toFixed(2));
              check(p.lat, p.lon, p.label);
            }}
            className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 transition-colors hover:border-blue-600 hover:text-blue-700 disabled:opacity-50"
          >
            {p.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label className="flex-1">
          <span className="text-xs font-medium text-neutral-600">Latitude</span>
          <input
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            inputMode="decimal"
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-blue-600 focus:outline-none"
            placeholder="25.77"
          />
        </label>
        <label className="flex-1">
          <span className="text-xs font-medium text-neutral-600">Longitude</span>
          <input
            value={lon}
            onChange={(e) => setLon(e.target.value)}
            inputMode="decimal"
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-blue-600 focus:outline-none"
            placeholder="-80.17"
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Checking..." : "Check risk"}
          </button>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={loading}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            Use my location
          </button>
        </div>
      </form>

      {error && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-4 rounded-2xl bg-neutral-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-neutral-900">
              {result.point.lat.toFixed(2)}, {result.point.lon.toFixed(2)}
              <span className="ml-2 font-normal text-neutral-500">
                {result.stormMode === "demo" ? "demo storm data" : "live storm data"}
              </span>
            </div>
            {result.risk && meta && (
              <div
                className="flex items-center gap-2 rounded-full px-3 py-1.5"
                style={{ backgroundColor: meta.softBg }}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: meta.color }}
                />
                <span className="text-sm font-bold" style={{ color: meta.color }}>
                  {result.risk.score}/100 {meta.label}
                </span>
              </div>
            )}
          </div>

          {result.conditions && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
              <div className="rounded-xl bg-white px-3 py-2">
                <div className="text-xs text-neutral-500">Conditions</div>
                <div className="font-medium text-neutral-900">
                  {result.conditions.weatherLabel}
                </div>
              </div>
              <div className="rounded-xl bg-white px-3 py-2">
                <div className="text-xs text-neutral-500">Temperature</div>
                <div className="font-medium text-neutral-900">
                  {result.conditions.temperatureC ?? "n/a"} C
                </div>
              </div>
              <div className="rounded-xl bg-white px-3 py-2">
                <div className="text-xs text-neutral-500">Wind</div>
                <div className="font-medium text-neutral-900">
                  {result.conditions.windKph ?? "n/a"} km/h
                </div>
              </div>
              <div className="rounded-xl bg-white px-3 py-2">
                <div className="text-xs text-neutral-500">Wave height</div>
                <div className="font-medium text-neutral-900">
                  {result.conditions.waveHeightM ?? "n/a"} m
                </div>
              </div>
            </div>
          )}

          {!result.conditions && (
            <p className="mt-3 text-sm text-neutral-500">
              Live conditions are unavailable right now. The risk score above is
              unaffected.
            </p>
          )}

          {result.risk ? (
            <div className="mt-3 text-sm text-neutral-700">
              {result.risk.closestDistanceKm > 1200 ? (
                <p>
                  No active NHC storm is within scoring range (1,200 km), so this
                  score reflects background conditions only. The nearest tracked
                  storm is {result.risk.stormClassLabel} {result.risk.stormName},{" "}
                  about {formatKm(result.risk.closestDistanceKm)} away.
                </p>
              ) : (
                <p>
                  Driven by {result.risk.stormClassLabel} {result.risk.stormName}:
                  closest approach {formatKm(result.risk.closestDistanceKm)},{" "}
                  {result.risk.leadTimeHours <= 0
                    ? "happening now"
                    : `in ${formatHours(result.risk.leadTimeHours)}`}
                  , winds {result.risk.closestWindKt} kt
                  {result.risk.inCone ? ", inside the forecast cone" : ""}.
                </p>
              )}
              <p className="mt-1 text-xs text-neutral-500">
                Score math: proximity{" "}
                {result.risk.components.proximity.toFixed(1)}/50 + wind{" "}
                {result.risk.components.wind.toFixed(1)}/30 + urgency{" "}
                {result.risk.components.urgency.toFixed(1)}/20 + cone bonus{" "}
                {result.risk.components.coneBonus}/10. Wind and urgency are
                scaled by distance reach.
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">
              No storm track data available for scoring right now.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
