# EVERYWHERE — Reachability MVP

A client-side engine answers one question — **what is still possible from here, tonight, on this budget, within this window?** — and renders the answer as the Possibility Field: an abstract, living view of every destination a scheduled train, bus, or ferry can still reach, that blooms, thins, and greys out as your constraints move.

> The field is an **abstract reachability rendering, not a geographic map**. The interface says so at all times. Timetables and fares are **synthetic and clearly labelled** — this is a scientific instrument for possibility, not a booking funnel.

- Build spec: EVERYWHERE — Reachability MVP Build Spec (project blueprint)
- PR 1: reachability engine, synthetic dataset, unit tests *(merged)*
- PR 2: Possibility Field (Canvas 2D) + simulation timeline *(merged)*
- PR 3: interface, scenario persistence, offline proof, full README *(this one)*

## Setup

```bash
npm ci          # or: npm install
npm test        # vitest — engine, dataset validator, clock, alerts, scenarios
npm run build   # production bundle in dist/
npm run dev     # dev server, then open the printed localhost URL
```

Node 20+ recommended. Everything runs from the bundled dataset — **no API keys, no network access, no backend**. Once the page is loaded, the app works with the network fully disconnected.

## The two-minute demo (ten beats)

Defaults on load: **Kozhikode · ₹2,000 · 24 h · clock paused at 12:00 IST** on the simulated reference day (Saturday 2026-10-17, Asia/Kolkata). Each beat is a computed engine outcome, not an animation:

| # | Action | Expected computed outcome |
|---|--------|---------------------------|
| 1 | Load with defaults | Field blooms: ~10 reachable destinations, ≥ 20 journey options |
| 2 | Select Bengaluru | Details show the transfer itinerary (via Coimbatore) with cost, arrival, transfers |
| 3 | Scrub to 18:25 | The 18:05 Kozhikode → Mangaluru express expires; its alert clears |
| 4 | Watch Mangaluru | Its itinerary via that train greys; the destination survives only if an alternate route remains |
| 5 | Continue to 19:00 | Bengaluru survives the same expiry via its alternate route — the node never blanks |
| 6 | Budget ₹2,000 → ₹4,000 | New destinations emerge; stats recount |
| 7 | Time 24 h → 12 h | Field contracts; reasons name the broken constraint |
| 8 | Budget ₹4,000 → ₹1,200 | Budget-sensitive nodes drop; the field visibly thins |
| 9 | Scrub backwards | Expired departures restore; the earlier state returns deterministically |
| 10 | Reset demo | Exact initial state — same numbers, same field, no selection |

**The non-negotiable:** expiry is a recompute, never a fade. When a connection's departure passes the simulation clock, every journey using it is re-derived from the timetable; a destination turns grey only when no valid itinerary without that connection survives. Scrubbing backwards restores the earlier state exactly, because there is no cache — the engine recomputes from scratch on every change.

## Architecture

One immutable dataset, one pure engine, one deterministic clock. React consumes snapshots; the field consumes snapshots; no panel computes its own truth.

```
src/
  data/         Locations, connections, reference-day constants;
                a validator that refuses inconsistent timetables at load
  engine/       Multilabel Pareto search, itinerary assembly, human-readable
                reasons, round-trip search, counterfactuals, clamps/formatters
  sim/          Deterministic simulation clock: reference day, window, scrub,
                step, time-warp (no wall time, no randomness)
  state/        The one reducer store: constraints + clock + selection +
                saved scenarios (localStorage); departure-alert derivation
  viz/          Deterministic field layout + Canvas 2D renderer (particles,
                curves, glow, tweens) + shared formatters
  components/   Header, constraint panel, stats, timeline, details, alerts,
                destinations rail, scenarios
tests/          Vitest: engine properties, demo beats, dataset validator,
                clock determinism, alert counterfactuals, scenario persistence
```

Recompute pipeline: cursor/slider moves → store dispatch → engine recomputes with departures restricted to `≥ now` → one snapshot → field, stats, alerts, details, rail all re-render from it.

### Engine notes

- **Multilabel time-dependent search** keeps a nondominated Pareto set of `(arrival, cost)` labels per node — a slower-but-cheaper itinerary survives next to a faster-but-pricier one, so a tighter budget can still reveal a route.
- Departures are expanded in time order from per-node sorted timetables; budget and deadline prune branches; a minimum transfer time (20 min default) gates every connection change.
- **Round trips are a separate reverse search.** One-way reachability is the default claim; a "day trip" badge appears only when a valid return fits the same deadline.
- Alerts are engine-derived counterfactuals: for each imminent departure the app re-runs reachability with that connection excluded and reports the delta. Nothing is invented — you can see the arithmetic behind every warning.

## Data provenance

The timetable is **synthetic, internally consistent, and labelled as such in the interface** (stats panel provenance line, timeline caption "Simulated schedule — demo timetable", per-fare "estimated" labels, rail caption). Its shape mirrors real Kerala services — the Shoranur–Mangaluru rail corridor, KSRTC-style road services, the Kollam–Alappuzha ferry — but **the schedule and fares are not real and must not be read as real**.

The dataset sits behind one swappable module (`src/data`): the engine consumes locations and connections through a plain interface with stable ids, so a verified open-data import can replace it without touching the engine. A load-time validator refuses internally inconsistent timetables (depart < arrive, cost ≥ 0, unique ids).

## Limitations

- **Synthetic data only.** No real timetable ingestion; schedules and fares are invented to make the demo's behaviour legible.
- One simulated reference day; no calendars, no service disruptions, no seasonal variation.
- 18 locations across Kerala plus selected Karnataka / Tamil Nadu destinations — a demo-scale dataset.
- No booking, no accounts, no server; scenarios persist to `localStorage` only.
- The field is an abstract rendering — polar angles are a stable hash of the destination id, radii encode journey duration; it is not a projection of geography.
- Desktop-first; small screens get a usable stacked layout, not a native mobile experience.

## Stack

React + TypeScript + Vite · Canvas 2D field · Vitest · localStorage. ₹0 forever: no paid APIs, keys, backends, or tiles.
