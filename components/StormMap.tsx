"use client";

import { useEffect, useRef } from "react";
import type L from "leaflet";
import "leaflet/dist/leaflet.css";
import { BAND_META } from "@/lib/risk";
import type { Port, RiskResult, StormData } from "@/lib/types";

interface Props {
  storms: StormData[];
  portRisks: { port: Port; risk: RiskResult | null }[];
  customLocation: { lat: number; lon: number; label: string } | null;
  selectedStormId: string | null;
  onStormSelect: (id: string | null) => void;
}

function toLatLng(poly: [number, number][]): [number, number][] {
  return poly;
}

export default function StormMap({
  storms,
  portRisks,
  customLocation,
  selectedStormId,
  onStormSelect,
}: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const cbRef = useRef(onStormSelect);
  useEffect(() => {
    cbRef.current = onStormSelect;
  }, [onStormSelect]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const leaflet = (await import("leaflet")).default;
      if (cancelled || !divRef.current || mapRef.current) return;
      const map = leaflet.map(divRef.current, {
        worldCopyJump: true,
        zoomControl: true,
      });
      mapRef.current = map;
      leaflet
        .tileLayer("/api/tiles/{z}/{x}/{y}.png", {
          attribution:
            "Esri, HERE, Garmin, &copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors",
          maxZoom: 12,
          minZoom: 2,
        })
        .addTo(map);
      layerRef.current = leaflet.layerGroup().addTo(map);
      map.setView([24, -60], 4);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const leaflet = (await import("leaflet")).default;
      const map = mapRef.current;
      const layer = layerRef.current;
      if (cancelled || !map || !layer) return;
      layer.clearLayers();

      const bounds: [number, number][] = [];

      storms.forEach((storm) => {
        const selected = selectedStormId === null || selectedStormId === storm.id;
        const dim = selected ? 1 : 0.35;

        // Cone of uncertainty
        if (storm.cone.length >= 3) {
          leaflet
            .polygon(toLatLng(storm.cone), {
              color: "#ffffff",
              weight: 1,
              opacity: 0.5 * dim,
              fillColor: "#ffffff",
              fillOpacity: 0.08 * dim,
            })
            .addTo(layer);
          storm.cone.forEach((p) => bounds.push(p));
        }

        // Forecast track
        const fc: [number, number][] = storm.forecast.map((p) => [p.lat, p.lon]);
        if (fc.length > 0) {
          leaflet
            .polyline([[storm.lat, storm.lon], ...fc], {
              color: "#ffffff",
              weight: 2,
              opacity: 0.9 * dim,
            })
            .addTo(layer);
          fc.forEach((p) => bounds.push(p));
          // Forecast points
          storm.forecast.forEach((p) => {
            leaflet
              .circleMarker([p.lat, p.lon], {
                radius: 3,
                color: "#0a0a0a",
                weight: 1,
                fillColor: "#ffffff",
                fillOpacity: 0.9 * dim,
              })
              .bindTooltip(
                `${storm.name}: ${p.windKt} kt at ${new Date(p.time).toUTCString().slice(5, 22)}`,
                { direction: "top" },
              )
              .addTo(layer);
          });
        }

        // Past track
        if (storm.pastTrack.length > 1) {
          leaflet
            .polyline(storm.pastTrack, {
              color: "#9ca3af",
              weight: 2,
              dashArray: "6 6",
              opacity: 0.8 * dim,
            })
            .addTo(layer);
        }

        // Wind extent rings
        const rings: { poly: [number, number][]; color: string; label: string }[] = [
          { poly: storm.windExtents.kt34, color: "#60a5fa", label: "34 kt" },
          { poly: storm.windExtents.kt50, color: "#f59e0b", label: "50 kt" },
          { poly: storm.windExtents.kt64, color: "#f87171", label: "64 kt" },
        ];
        rings.forEach(({ poly, color, label }) => {
          if (poly.length >= 3) {
            leaflet
              .polygon(poly, {
                color,
                weight: 1.5,
                opacity: 0.85 * dim,
                fill: false,
              })
              .bindTooltip(`${storm.name}: ${label} wind extent`, {
                direction: "top",
                sticky: true,
              })
              .addTo(layer);
          }
        });

        // Current position marker
        const icon = leaflet.divIcon({
          className: "",
          html: `<div style="width:30px;height:30px;border-radius:9999px;background:#dc2626;border:3px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:11px;box-shadow:0 2px 8px rgba(0,0,0,.5);opacity:${dim}">${storm.intensityKt}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });
        leaflet
          .marker([storm.lat, storm.lon], { icon })
          .bindTooltip(
            `<b>${storm.classLabel} ${storm.name}</b><br>${storm.intensityKt} kt, ${storm.pressureMb ?? "?"} mb<br>${storm.movement}${storm.isDemo ? "<br><i>Demo replay</i>" : ""}`,
            { direction: "top" },
          )
          .on("click", () => cbRef.current(storm.id))
          .addTo(layer);
        bounds.push([storm.lat, storm.lon]);
      });

      // Port markers colored by risk band
      portRisks.forEach(({ port, risk }) => {
        const band = risk ? risk.band : "watch";
        const meta = BAND_META[band];
        const score = risk ? risk.score : 0;
        leaflet
          .circleMarker([port.lat, port.lon], {
            radius: 5 + score / 14,
            color: "#0a0a0a",
            weight: 1.5,
            fillColor: meta.color,
            fillOpacity: 0.95,
          })
          .bindTooltip(
            `<b>${port.name}</b> (${port.country})<br>Risk ${score}/100, ${meta.label}${risk ? `<br>${risk.stormClassLabel} ${risk.stormName}` : ""}`,
            { direction: "top" },
          )
          .addTo(layer);
      });

      // Custom location marker
      if (customLocation) {
        const icon = leaflet.divIcon({
          className: "",
          html: `<div style="width:18px;height:18px;border-radius:9999px;background:#2563eb;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5)"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        leaflet
          .marker([customLocation.lat, customLocation.lon], { icon })
          .bindTooltip(`<b>${customLocation.label}</b>`, { direction: "top" })
          .addTo(layer);
        bounds.push([customLocation.lat, customLocation.lon]);
      }

      if (bounds.length > 0) {
        map.fitBounds(leaflet.latLngBounds(bounds), { padding: [30, 30] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storms, portRisks, customLocation, selectedStormId]);

  return (
    <div className="relative">
      <div ref={divRef} className="h-[420px] w-full md:h-[560px]" />
      <div className="absolute bottom-3 left-3 z-[500] rounded-xl bg-white/95 px-3 py-2 text-[11px] leading-5 text-neutral-800 shadow-lg backdrop-blur">
        <div className="font-semibold text-neutral-900">Legend</div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-600" /> Storm position (kt)
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-6 rounded bg-white ring-1 ring-neutral-400" /> Forecast cone
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-600" /> Watch 0-33
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-600" /> Prepare 34-66
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-600" /> Act 67-100
        </div>
      </div>
    </div>
  );
}
