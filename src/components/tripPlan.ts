import { MINUTE_MS } from '../data/referenceDay'
import type { TransportData } from '../data/types'
import type { Leg } from '../engine/types'
import type { TripPlan } from '../engine/planner'
import type { DestinationResult } from '../engine/types'
import { stableAngle } from '../viz/layout'
import { formatDuration } from '../viz/format'
import { formatINR } from '../engine/format'

/**
 * Pure presentation helpers for the results surface (planner spec) — no
 * React, no DOM: the node-env tests import this module directly. The plans
 * themselves are computed once upstream (PlannerResults); everything here
 * projects that one snapshot, never re-derives engine truth.
 */

export interface GeoPoint {
  lat: number
  lon: number
}

/** One line of the full itinerary — a transport leg, a packed activity, or the meal. */
export type ItineraryEntry =
  | {
      kind: 'leg'
      id: string
      title: string
      mode: 'train' | 'bus' | 'ferry'
      /** Outbound or return phase — groups the timeline visually. */
      phase: 'outbound' | 'return'
      startMs: number
      endMs: number
      costINR: number
    }
  | {
      kind: 'activity'
      id: string
      title: string
      category: string
      startMs: number
      endMs: number
      costINR: number
      blurb: string
    }
  | {
      kind: 'meal'
      id: string
      title: string
      slot: 'breakfast' | 'lunch' | 'evening'
      /**
       * The engine places the meal by its service window covering the dwell
       * midpoint; the meal itself occupies no dwell minutes (no duration in
       * the catalog), so it is a point marker in the timeline.
       */
      startMs: number
      endMs: null
      costINR: number
      blurb: string
    }

const KIND_RANK: Record<ItineraryEntry['kind'], number> = { leg: 0, activity: 1, meal: 2 }

/**
 * The full itinerary leg-by-leg, every entry with its time and cost (spec):
 * outbound legs in order, activities packed sequentially from the arrival
 * minute (the engine packs them back-to-back from the dwell start), the meal
 * at the dwell midpoint the engine validated its service window against, and
 * the return legs. Sorted by start time — deterministic for equal inputs.
 */
export function buildItinerary(plan: TripPlan, data: TransportData): ItineraryEntry[] {
  const entries: ItineraryEntry[] = []
  const legTitle = (leg: Leg): string =>
    `${data.locationById.get(leg.from)?.name ?? leg.from} → ${data.locationById.get(leg.to)?.name ?? leg.to}`

  for (const leg of plan.outbound.legs) {
    entries.push({
      kind: 'leg',
      id: leg.connId,
      title: legTitle(leg),
      mode: leg.mode,
      phase: 'outbound',
      startMs: leg.depart,
      endMs: leg.arrive,
      costINR: leg.costINR,
    })
  }

  // The dwell packing runs back-to-back from the arrival minute — replay the
  // same cursor to place each activity where the engine put it.
  let cursor = plan.outbound.arriveAt
  for (const activity of plan.activities) {
    const startMs = cursor
    cursor += activity.durationMin * MINUTE_MS
    entries.push({
      kind: 'activity',
      id: activity.id,
      title: activity.title,
      category: activity.category,
      startMs,
      endMs: cursor,
      costINR: activity.costINR,
      blurb: activity.blurb,
    })
  }

  if (plan.meal) {
    const midpointMs = Math.floor((plan.outbound.arriveAt + plan.returnJourney.departAt) / 2)
    entries.push({
      kind: 'meal',
      id: plan.meal.id,
      title: plan.meal.name,
      slot: plan.meal.slot,
      startMs: midpointMs,
      endMs: null,
      costINR: plan.meal.costINR,
      blurb: plan.meal.blurb,
    })
  }

  for (const leg of plan.returnJourney.legs) {
    entries.push({
      kind: 'leg',
      id: leg.connId,
      title: legTitle(leg),
      mode: leg.mode,
      phase: 'return',
      startMs: leg.depart,
      endMs: leg.arrive,
      costINR: leg.costINR,
    })
  }

  return entries.sort((a, b) => {
    if (a.startMs !== b.startMs) return a.startMs - b.startMs
    const byKind = KIND_RANK[a.kind] - KIND_RANK[b.kind]
    if (byKind !== 0) return byKind
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

/**
 * The field's input, projected from the ranked plans (spec: the results graph
 * shrinks to actual plans — only feasible-trip destinations render, ghosts
 * are not drawn here). Projection, not derivation: the journeys shown are the
 * plan's own outbound and return.
 */
export function plansToFieldResults(
  plans: readonly TripPlan[],
  data: TransportData,
): DestinationResult[] {
  const results: DestinationResult[] = []
  for (const plan of plans) {
    const location = data.locationById.get(plan.destinationId)
    if (!location) continue
    results.push({
      location,
      reachable: true,
      journeys: [plan.outbound, plan.returnJourney],
      best: plan.outbound,
      reason: '',
      roundTrip: plan.returnJourney,
      criticalConnId: null,
    })
  }
  return results
}

/**
 * Approximate POI pin for a synthetic estimate (spec: pins are placed near
 * the destination centre and never claim survey accuracy). The angle is the
 * same stable id-hash the field uses, so a pin never jumps between renders;
 * the radius is the catalog's straight-line distance, when it has one.
 */
export function poiPin(center: GeoPoint, distanceKm: number, id: string): GeoPoint {
  const angle = stableAngle(id)
  const KM_PER_DEG_LAT = 110.574
  const KM_PER_DEG_LON = 111.32 * Math.cos((center.lat * Math.PI) / 180)
  return {
    lat: center.lat + (distanceKm * Math.cos(angle)) / KM_PER_DEG_LAT,
    lon: center.lon + (distanceKm * Math.sin(angle)) / Math.max(0.2, KM_PER_DEG_LON),
  }
}

/** Great-circle kilometres — the schematic's distance scale and leg labels. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export interface SchematicLeg {
  id: string
  label: string
  mode: 'train' | 'bus' | 'ferry'
  phase: 'outbound' | 'return'
  departMs: number
  arriveMs: number
  costINR: number
  from: GeoPoint
  to: GeoPoint
  distanceKm: number
}

/**
 * The route geometry for the schematic (and the map polylines) — built from
 * the plan's own legs and the bundled coordinates, never from the basemap
 * (map resilience spec). Outbound legs in travel order, then the return.
 */
export function schematicLegs(plan: TripPlan, data: TransportData): SchematicLeg[] {
  const pointOf = (id: string): GeoPoint => {
    const loc = data.locationById.get(id)
    // Every dataset node carries validated coordinates; an unknown id can
    // only be a programming bug — fail loudly rather than draw a fake point.
    if (!loc) throw new Error(`schematicLegs: unknown location id "${id}"`)
    return { lat: loc.lat, lon: loc.lon }
  }
  const legOf = (
    leg: TripPlan['outbound']['legs'][number],
    phase: 'outbound' | 'return',
  ): SchematicLeg => {
    const from = pointOf(leg.from)
    const to = pointOf(leg.to)
    return {
      id: leg.connId,
      label: data.connectionById(leg.connId)?.label ?? leg.connId,
      mode: leg.mode,
      phase,
      departMs: leg.depart,
      arriveMs: leg.arrive,
      costINR: leg.costINR,
      from,
      to,
      distanceKm: haversineKm(from, to),
    }
  }
  return [
    ...plan.outbound.legs.map((leg) => legOf(leg, 'outbound')),
    ...plan.returnJourney.legs.map((leg) => legOf(leg, 'return')),
  ]
}

/** A round distance-scale length not larger than the route span. */
export function scaleBarKmFor(routeKm: number): number {
  if (!Number.isFinite(routeKm) || routeKm <= 0) return 1
  const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]
  const target = routeKm / 3
  for (const step of steps) {
    if (step >= target) return step
  }
  return steps[steps.length - 1]
}

export interface SchematicPoint {
  x: number
  y: number
}

/**
 * Equirectangular projection into a width×height box with padding —
 * aspect-preserving, deterministic. Pure so the SVG schematic renders the
 * same geometry the tests assert on.
 */
export function schematicLegLabelText(leg: SchematicLeg): string {
  return `${leg.label} · ${formatDuration((leg.arriveMs - leg.departMs) / 60_000)} · ${formatINR(leg.costINR)}`
}

export function schematicProjection(
  legs: readonly SchematicLeg[],
  width: number,
  height: number,
  pad = 56,
): (p: GeoPoint) => SchematicPoint {
  let minLat = Number.POSITIVE_INFINITY
  let maxLat = Number.NEGATIVE_INFINITY
  let minLon = Number.POSITIVE_INFINITY
  let maxLon = Number.NEGATIVE_INFINITY
  for (const leg of legs) {
    for (const p of [leg.from, leg.to]) {
      minLat = Math.min(minLat, p.lat)
      maxLat = Math.max(maxLat, p.lat)
      minLon = Math.min(minLon, p.lon)
      maxLon = Math.max(maxLon, p.lon)
    }
  }
  const midLat = (minLat + maxLat) / 2
  const spanX = Math.max(1e-6, (maxLon - minLon) * Math.cos((midLat * Math.PI) / 180))
  const spanY = Math.max(1e-6, maxLat - minLat)
  const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY)
  const offsetX = (width - spanX * scale) / 2
  const offsetY = (height + spanY * scale) / 2
  return (p: GeoPoint) => ({
    x: offsetX + (p.lon - minLon) * Math.cos((midLat * Math.PI) / 180) * scale,
    y: offsetY - (p.lat - minLat) * scale,
  })
}


/** ---- Schematic label layout (pure, node-testable) ---- */

/** The schematic's round-trip endpoint anchors, projected. The destination
 * is the LAST OUTBOUND leg's end — the far end of the trip. It is never an
 * intermediate stop on a multi-leg outbound, and never the final return
 * arrival (which is the origin again). Null only for an empty or
 * outbound-less leg list, which a real plan cannot produce. */
export function schematicEndpoints(
  legs: readonly SchematicLeg[],
  project: (p: GeoPoint) => SchematicPoint,
): { origin: SchematicPoint; destination: SchematicPoint } | null {
  const first = legs[0]
  if (!first) return null
  const lastOutbound = [...legs].reverse().find((leg) => leg.phase === 'outbound')
  if (!lastOutbound) return null
  return { origin: project(first.from), destination: project(lastOutbound.to) }
}

export interface SchematicLabelPlacement {
  x: number
  /** Text baseline y in SVG space. */
  y: number
}

/** Baseline gap between a stop and its name label. */
export const SCHEMATIC_STOP_GAP_PX = 14
/** Row pitch when same-side leg labels stack to avoid each other. */
export const SCHEMATIC_LABEL_ROW_PX = 16
/** First-row baseline offsets from the leg line: outbound above, return below. */
export const SCHEMATIC_LABEL_ABOVE_PX = 18
export const SCHEMATIC_LABEL_BELOW_PX = 26
const MAX_LABEL_ROWS = 6

/** Conservative text width for collision math (bold 12–13 px sans). The
 * layout needs a stable over-estimate, not typographic truth. */
export function estimateLabelWidthPx(text: string): number {
  return text.length * 7
}

/** The rectangle a label with this baseline and width occupies. Exported so
 * the non-overlap tests reconstruct exactly what the renderer draws. */
export function schematicLabelRect(x: number, baselineY: number, widthPx: number): {
  x1: number
  y1: number
  x2: number
  y2: number
} {
  return { x1: x - widthPx / 2, y1: baselineY - 11, x2: x + widthPx / 2, y2: baselineY + 3 }
}

export function schematicRectsOverlap(
  a: { x1: number; y1: number; x2: number; y2: number },
  b: { x1: number; y1: number; x2: number; y2: number },
): boolean {
  return a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2
}

export interface SchematicLabelLayout {
  origin: SchematicLabelPlacement
  destination: SchematicLabelPlacement
  /** Index-aligned with `legs` — label i belongs to leg i. */
  legLabels: SchematicLabelPlacement[]
}

/**
 * Collision-free label layout for the schematic route. Deterministic and
 * pure so the node-env tests assert exactly what the SVG draws:
 *
 * - Stop labels anchor at their coordinates (destination at the far end via
 *   schematicEndpoints) and are fixed obstacles.
 * - Leg labels sit at their segment midpoint, outbound above the line and
 *   return below — a round trip retracing the same segment can never put
 *   both labels on one side.
 * - Crowded same-side labels stack in rows away from the line until their
 *   rectangles stop intersecting anything already placed (rows capped;
 *   a label is never dropped, only crowded).
 */
export function schematicLabelLayout(
  legs: readonly SchematicLeg[],
  project: (p: GeoPoint) => SchematicPoint,
  originName: string,
  destinationName: string,
): SchematicLabelLayout | null {
  const endpoints = schematicEndpoints(legs, project)
  if (!endpoints) return null

  const origin = { x: endpoints.origin.x, y: endpoints.origin.y - SCHEMATIC_STOP_GAP_PX }
  const destination = { x: endpoints.destination.x, y: endpoints.destination.y - SCHEMATIC_STOP_GAP_PX }

  // Stops are placed first and never move; every leg label must clear them.
  const placed: ReturnType<typeof schematicLabelRect>[] = [
    schematicLabelRect(origin.x, origin.y, estimateLabelWidthPx(originName)),
    schematicLabelRect(destination.x, destination.y, estimateLabelWidthPx(destinationName)),
  ]

  const legLabels: SchematicLabelPlacement[] = legs.map((leg) => {
    const a = project(leg.from)
    const b = project(leg.to)
    const x = (a.x + b.x) / 2
    const midY = (a.y + b.y) / 2
    const side = leg.phase === 'outbound' ? -1 : 1
    const base = midY + side * (side < 0 ? SCHEMATIC_LABEL_ABOVE_PX : SCHEMATIC_LABEL_BELOW_PX)
    const width = estimateLabelWidthPx(schematicLegLabelText(leg))

    let y = base + side * (MAX_LABEL_ROWS - 1) * SCHEMATIC_LABEL_ROW_PX
    for (let row = 0; row < MAX_LABEL_ROWS; row++) {
      const candidate = base + side * row * SCHEMATIC_LABEL_ROW_PX
      const rect = schematicLabelRect(x, candidate, width)
      y = candidate
      if (!placed.some((p) => schematicRectsOverlap(rect, p))) break
    }
    placed.push(schematicLabelRect(x, y, width))
    return { x, y }
  })

  return { origin, destination, legLabels }
}
