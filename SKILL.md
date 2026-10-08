---
name: cyclonewatch
description: Query live tropical cyclone risk for any port, vessel position, or lat/lon. Use when the user asks about hurricane/typhoon/cyclone risk to assets, active storms, forecast cones, or storm conditions at a location.
---

# CycloneWatch Skill

CycloneWatch scores tropical cyclone risk 0-100 for any point on Earth, using
live NOAA National Hurricane Center forecasts (public domain) and Open-Meteo
conditions (CC-BY 4.0). It is an alerting layer, not a forecast model.

## When to use

- "Is my shipment at risk from the hurricane?"
- "Which ports are in the danger zone right now?"
- "What storms are active and where are they headed?"
- "Give me the risk score for 25.77, -80.17"

## API (no key, JSON)

Base URL: the deployed CycloneWatch origin (default `http://localhost:3000` in dev).

### List storms

`GET /api/storms?mode=auto`

Returns active storms (or a labeled Hurricane Milton demo replay when quiet)
with forecast tracks, cones of uncertainty, 34/50/64 kt wind extents, and past
tracks. Use `mode=live` to get real data only.

### Score a location

`GET /api/risk?lat=25.77&lon=-80.17`

Returns the 0-100 score, band (watch 0-33, prepare 34-66, act 67-100), the
driving storm, closest-approach distance/time/wind, the four score components
(proximity, wind, urgency, cone bonus), and live conditions (temperature, wind,
wave height).

### Health

`GET /api/health` - service status and NHC reachability.

## Answering pattern

1. Call `/api/risk` for the user's coordinates (or a port from the built-in
   list of 38 major container ports).
2. Report: score, band, driving storm, closest approach (distance, time, wind),
   and the recommended action for the band.
3. If score >= 67, say plainly: act now, and point to official NHC guidance.
4. Never present demo-mode data as live; the API flags `isDemo` and
   `stormMode: "demo"`.

## Example

User: "Is Houston at risk?"
Call: `GET /api/risk?lat=29.72&lon=-95.08`
Reply: "Port of Houston scores 74/100 (Act), driven by Hurricane Isaias:
closest approach 210 km in 31 hours with 95 kt winds. Recommendation: execute
your storm plan now. Source: NHC advisory 8A, 10 minutes ago."
