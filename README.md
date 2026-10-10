# EVERYWHERE — the Day-Trip Planner

A client-side engine that answers one question — **what is still possible from here, today, on this budget, within this window?** — and turns the answer into full day trips: travel out, see the sights, eat well, and be home on time. Every leg, minute, and rupee accounted for, with a real route map and real photos of every place.

The original simulator — the abstract, living Possibility Field — is still here as **Explore**.

> Honest by design. Timetables, fares, activity ideas, and meal suggestions are **synthetic estimates, labelled as such everywhere they appear**. Destination coordinates are real geography; the schedule that connects them is not. Photography is real, licensed from Wikimedia Commons contributors, and credited in-app, offline.

## The three surfaces

| Surface | What it does |
|---|---|
| **Home** (light) | The day-trip promise, a strip of real destination photos, and the two doors: **Plan my day** and **Explore the field**. |
| **Planner → Results → Trip detail** (light) | Pick an origin, a budget (₹200–₹10,000), a time window (2–48 h), and interests — food, heritage, nightlife, adventure, shopping, nature, movies, in priority order — and get ranked round-trip plans: route summary, full cost breakdown, and the interests each plan matches. Selecting a plan reveals the minute-by-minute itinerary, the route map, and the destination's photos and famous spots. |
| **Explore** (dark) | Today's Possibility Field exactly as shipped: the bloom/thin/grey field, story mode, time-lapse, unlock probe, scenarios, and share links. `#s=` share links restore Explore from any surface. |

A there-and-back is not a trip: every offered plan includes **at least 90 minutes on the ground** with at least one activity or meal actually fitted inside the stay. Connectivity alone never qualifies.

## Setup

```bash
npm ci          # or: npm install
npm test        # vitest — engine, planner, dataset validator, clock, alerts, scenarios
npm run build   # production bundle in dist/
npm run dev     # dev server, then open the printed localhost URL
```

Node 20+ recommended.

## Offline, stated precisely

**Everything runs fully offline except the route map's OpenStreetMap tiles, which load only when online.** No API keys, no backend, no accounts, no tracking. The map is the one networked surface: when tiles are unreachable, it swaps to a schematic route drawn from the app's own data — the plan stays fully usable, with a Retry button. Photo credits render offline. The bundled images, engine, timetable, and planner never touch the network.

The route map uses Leaflet over OpenStreetMap raster tiles with visible attribution ("© OpenStreetMap contributors"), viewport-based tile loading, and no prefetch — per the OSM tile usage policy.

## How the planner works

The planner is a layer **above** the reachability engine — the search core is never modified by it:

1. **Outbound** — one multilabel Pareto search from the origin (budget- and deadline-pruned, transfer-gated) picks the best outbound journey per destination.
2. **Return window** — for each reachable destination, the search re-runs *from that destination* with the clock advanced by the minimum dwell and the budget reduced by the outbound cost. All nondominated returns are kept as candidate dwell lengths.
3. **Pack the dwell** — outbound/return pairs are scored for dwell utilization; the stay is packed with interest-matched activities (user priority first), then one meal whose service window covers the dwell midpoint and fits the remaining budget. Dwell under 90 minutes, or nothing that fits → no plan. Costs are dropped from the plan (never from honesty) until the total fits.
4. **Rank** — distinct interests matched (weighted by user priority), then dwell utilization, then lower total cost, then destination name. Deterministic: the same inputs give the same ranked list on every machine.

## Photos and credits

Destination and famous-spot photographs are real, pulled from Wikimedia Commons at build time (a local script, `scripts/fetch-photos.mjs` — run manually, never in CI), resized, and bundled with the app. Every photo ships inseparably from its attribution record — creator, license, and source page — rendered in the **Image credits** panel at the foot of the trip-detail surface, reachable offline. Only clear licenses (CC0, PD, CC BY, CC BY-SA) are accepted. A destination without an acceptable photo falls back to generated artwork; a spot without one falls back to a monogram tile.

## Data provenance

- **The timetable is synthetic, internally consistent, and labelled as such in the interface** (stats panel provenance line, timeline caption, per-fare "estimated" labels). Its shape mirrors real Kerala services — the Shoranur–Mangaluru rail corridor, KSRTC-style road services, the Kollam–Alappuzha ferry — but **the schedule and fares are not real and must not be read as real**.
- **Activities, meals, and famous spots are synthetic estimates too** — the same disclosure covers them (provenance caption on the results surface, "estimated" tags on every itinerary line, modal, and plan card). Activity pin positions on the map are approximate by design.
- **Coordinates are real geography** for the 18 demo locations, validated at load (bounding-box check); the validator refuses internally inconsistent data — all problems listed at once, at load.
- The dataset sits behind one swappable module (`src/data`): the engine consumes locations, connections, and the POI catalog through plain interfaces with stable ids, so a verified open-data import could replace them without touching the engine.

## Explore — the two-minute demo (ten beats)

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
  data/         Locations (with real coordinates), connections, POI catalogs
                (activities, meals, spots), photo credits; a validator that
                refuses inconsistent data at load
  engine/       Multilabel Pareto search, itinerary assembly, human-readable
                reasons, round-trip search, the day-trip planner (dwell
                packing + ranking), counterfactuals, clamps/formatters
  sim/          Deterministic simulation clock: reference day, window, scrub,
                step, time-warp (no wall time, no randomness)
  state/        The one reducer store: constraints + clock + selection +
                saved scenarios (localStorage); planner request state;
                departure-alert derivation
  viz/          Deterministic field layout + Canvas 2D renderer (particles,
                curves, glow, tweens) + shared formatters
  components/   App shell (home/planner/explore), light home, planner form,
                ranked results, trip detail, lazy route map + schematic
                fallback, destination modal, image credits; Explore's header,
                constraint panel, stats, timeline, details, alerts, rail
tests/          Vitest (node env): engine properties, planner invariants,
                demo beats, dataset validator, clock determinism, alert
                counterfactuals, scenario persistence, schematic geometry
```

Recompute pipeline: cursor/slider moves → store dispatch → engine recomputes with departures restricted to `≥ now` → one snapshot → field, stats, alerts, details, rail all re-render from it. Planner inputs persist for the session; planner requests are not shareable in v1 (Explore scenario links keep working unchanged).

### Engine notes

- **Multilabel time-dependent search** keeps a nondominated Pareto set of `(arrival, cost)` labels per node — a slower-but-cheaper itinerary survives next to a faster-but-pricier one, so a tighter budget can still reveal a route.
- Departures are expanded in time order from per-node sorted timetables; budget and deadline prune branches; a minimum transfer time (20 min default) gates every connection change.
- **Explore's round trips** (60-minute stay) are a separate reverse search. One-way reachability is the default claim; a "day trip" badge appears only when a valid return fits the same deadline. **The planner's** trips require their own stricter 90-minute dwell — the two constants live apart on purpose.
- Alerts are engine-derived counterfactuals: for each imminent departure the app re-runs reachability with that connection excluded and reports the delta. Nothing is invented — you can see the arithmetic behind every warning.

## Limitations

- **Synthetic schedule and POI data.** Timetable, fares, activities, meals, and spots are invented to make the demo's behaviour legible; coordinates and photographs are real.
- One simulated reference day; no calendars, no service disruptions, no seasonal variation.
- 18 locations across Kerala plus selected Karnataka / Tamil Nadu destinations — a demo-scale dataset.
- One destination per trip — no multi-stop chaining (the famous-spots grid covers variety *within* a destination). No booking, no accounts, no server; scenarios persist to `localStorage` only.
- Planner inputs are not shareable in v1; Explore scenario links are.
- The Explore field is an abstract rendering — polar angles are a stable hash of the destination id, radii encode journey duration; it is not a projection of geography. The results field likewise shows feasible plans, not geography.
- Map tiles need the network; everything else works offline. Small screens get a responsive stacked layout, not a native mobile experience.

## Stack

React + TypeScript + Vite · Canvas 2D field · Leaflet + OpenStreetMap tiles (lazy-loaded, schematic fallback) · Vitest · localStorage. ₹0 forever: no paid APIs, keys, or backends.
