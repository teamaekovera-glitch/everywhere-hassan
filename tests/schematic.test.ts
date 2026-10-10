import { describe, expect, it } from 'vitest'
import { ACTIVITIES, DEMO_DATA, MEALS, SPOTS } from '../src/data'
import { DEFAULT_MIN_TRANSFER_MIN } from '../src/engine'
import { planDayTrips } from '../src/engine/planner'
import type { InterestId, PlannerInput, TripPlan } from '../src/engine/planner'
import { buildItinerary, plansToFieldResults, poiPin, schematicLegs, scaleBarKmFor } from '../src/components/tripPlan'
import {
  SCHEMATIC_TILE_FAILURE_THRESHOLD,
  nextFailureCount,
  shouldShowSchematic,
} from '../src/components/tripMapFallback'
import { PLANNER_CLOCK_MS } from '../src/state/planner'

/**
 * Node-env tests for the results/map presentation layer (no jsdom, per the
 * repo's test contract): the schematic-fallback trigger and its debouncing,
 * itinerary assembly, the feasible-trips field projection, and the schematic
 * geometry helpers. Leaflet rendering itself is verified by scripted browser
 * QA, not component tests (planner spec, verification table).
 */

/** A broad input guaranteed to yield plans on the demo dataset. */
function plannerInput(): PlannerInput {
  return {
    originId: 'kozhikode',
    now: PLANNER_CLOCK_MS,
    availableHours: 24,
    budgetINR: 10_000,
    minTransferMin: DEFAULT_MIN_TRANSFER_MIN,
    interests: [] as InterestId[],
  }
}

function plannerPlans(): TripPlan[] {
  return planDayTrips(DEMO_DATA, { activities: [...ACTIVITIES], meals: [...MEALS], spots: [...SPOTS] }, plannerInput())
}

describe('shouldShowSchematic', () => {
  it('stays on tiles below the failure threshold', () => {
    expect(shouldShowSchematic(0)).toBe(false)
    expect(shouldShowSchematic(1)).toBe(false)
    expect(shouldShowSchematic(SCHEMATIC_TILE_FAILURE_THRESHOLD - 1)).toBe(false)
  })

  it('switches to the schematic at the threshold and stays there', () => {
    expect(shouldShowSchematic(SCHEMATIC_TILE_FAILURE_THRESHOLD)).toBe(true)
    expect(shouldShowSchematic(SCHEMATIC_TILE_FAILURE_THRESHOLD + 50)).toBe(true)
    expect(shouldShowSchematic(Number.POSITIVE_INFINITY)).toBe(true)
  })

  it('treats negative or non-finite garbage as no schematic, not a crash', () => {
    expect(shouldShowSchematic(-1)).toBe(false)
    expect(shouldShowSchematic(Number.NaN)).toBe(false)
  })
})

describe('nextFailureCount (the debounce)', () => {
  it('accumulates consecutive tile errors', () => {
    expect(nextFailureCount(0, 'error')).toBe(1)
    expect(nextFailureCount(1, 'error')).toBe(2)
    expect(nextFailureCount(2, 'error')).toBe(3)
  })

  it('any successful tile load resets the count — one bad tile is not an outage', () => {
    expect(nextFailureCount(SCHEMATIC_TILE_FAILURE_THRESHOLD - 1, 'load')).toBe(0)
    expect(nextFailureCount(3, 'load')).toBe(0)
    expect(nextFailureCount(0, 'load')).toBe(0)
  })

  it('keeps counting past the threshold — the trigger is >=, not ==', () => {
    expect(nextFailureCount(SCHEMATIC_TILE_FAILURE_THRESHOLD + 10, 'error')).toBe(
      SCHEMATIC_TILE_FAILURE_THRESHOLD + 11,
    )
  })
})

describe('buildItinerary', () => {
  const plans = plannerPlans()
  it('the demo dataset yields plans to test against', () => {
    expect(plans.length).toBeGreaterThan(0)
  })

  it('lays the day out: outbound legs, packed activities, meal, return legs — sorted', () => {
    const plan = plans[0]
    const entries = buildItinerary(plan, DEMO_DATA)

    // Sorted by start time, deterministically.
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i].startMs).toBeGreaterThanOrEqual(entries[i - 1].startMs)
    }
    // Every leg, activity, and meal is represented.
    expect(entries.filter((e) => e.kind === 'leg')).toHaveLength(
      plan.outbound.legs.length + plan.returnJourney.legs.length,
    )
    expect(entries.filter((e) => e.kind === 'activity')).toHaveLength(plan.activities.length)
    expect(entries.filter((e) => e.kind === 'meal')).toHaveLength(plan.meal ? 1 : 0)
    // First entry departs when the plan departs; the last ends back home.
    expect(entries[0].startMs).toBe(plan.departAt)
    expect(entries[entries.length - 1].endMs).toBe(plan.arriveBackAt)
  })

  it('places activities sequentially from the arrival minute', () => {
    const plan = plans[0]
    const entries = buildItinerary(plan, DEMO_DATA)
    const activityEntries = entries.filter((e) => e.kind === 'activity')
    let cursor = plan.outbound.arriveAt
    for (const entry of activityEntries) {
      expect(entry.startMs).toBe(cursor)
      cursor = entry.endMs as number
    }
  })

  it('puts the meal at the dwell midpoint the engine validated', () => {
    const plan = plans[0]
    const entries = buildItinerary(plan, DEMO_DATA)
    const meal = entries.find((e) => e.kind === 'meal')
    if (!plan.meal) {
      expect(meal).toBeUndefined()
      return
    }
    const midpoint = Math.floor((plan.outbound.arriveAt + plan.returnJourney.departAt) / 2)
    expect(meal?.startMs).toBe(midpoint)
  })

  it('resolves leg titles to location names, not raw ids', () => {
    const plan = plans[0]
    const entries = buildItinerary(plan, DEMO_DATA)
    for (const entry of entries.filter((e) => e.kind === 'leg')) {
      expect(entry.title).toMatch(/→/)
      expect(entry.title).not.toMatch(/undefined/)
    }
  })

  it('carries each entry’s cost from the plan', () => {
    const plan = plans[0]
    const entries = buildItinerary(plan, DEMO_DATA)
    const activityTotal = entries.filter((e) => e.kind === 'activity').reduce((sum, e) => sum + e.costINR, 0)
    expect(activityTotal).toBe(plan.costs.activitiesINR)
    const mealEntry = entries.find((e) => e.kind === 'meal')
    if (plan.meal) expect(mealEntry?.costINR).toBe(plan.costs.mealINR)
    else expect(mealEntry).toBeUndefined()
  })
})

describe('plansToFieldResults', () => {
  it('projects exactly the planned destinations — the graph shrinks to real plans', () => {
    const plans = plannerPlans()
    const results = plansToFieldResults(plans, DEMO_DATA)
    expect(results).toHaveLength(plans.length)
    // Order preserved — the ranked order drives the field too.
    expect(results.map((r) => r.location.id)).toEqual(plans.map((p) => p.destinationId))
    // No origin node, no ghosts: every result carries its plan.
    for (const result of results) {
      expect(result.location.id).not.toBe('kozhikode')
      expect(result.reachable).toBe(true)
      expect(result.roundTrip).not.toBeNull()
    }
  })
})

describe('schematicLegs', () => {
  it('captures both phases over the bundled coordinates with labels', () => {
    const plan = plannerPlans()[0]
    const legs = schematicLegs(plan, DEMO_DATA)
    expect(legs.some((l) => l.phase === 'outbound')).toBe(true)
    expect(legs.some((l) => l.phase === 'return')).toBe(true)
    for (const leg of legs) {
      expect(Number.isFinite(leg.from.lat)).toBe(true)
      expect(Number.isFinite(leg.to.lon)).toBe(true)
      expect(leg.label.length).toBeGreaterThan(0)
      expect(leg.arriveMs).toBeGreaterThan(leg.departMs)
      expect(leg.distanceKm).toBeGreaterThan(0)
    }
    // The outbound starts at the origin, the return ends there (same point).
    const origin = DEMO_DATA.locationById.get('kozhikode')
    expect(origin).toBeDefined()
    expect(legs[0].from).toEqual({ lat: origin?.lat, lon: origin?.lon })
    expect(legs[legs.length - 1].to).toEqual({ lat: origin?.lat, lon: origin?.lon })
  })
})

describe('poiPin', () => {
  it('is deterministic per id and honours the requested offset', () => {
    const centre = { lat: 11.25, lon: 75.78 }
    const a = poiPin(centre, 2, 'kozhikode-heritage-1')
    const b = poiPin(centre, 2, 'kozhikode-heritage-1')
    expect(a).toEqual(b)

    const c = poiPin(centre, 2, 'kozhikode-food-2')
    const km = haversineKm(centre, c)
    expect(Math.abs(km - 2)).toBeLessThan(0.5)
  })

  it('keeps distinct activities apart', () => {
    const centre = { lat: 11.25, lon: 75.78 }
    const a = poiPin(centre, 2, 'act-a')
    const b = poiPin(centre, 2, 'act-b')
    expect(a).not.toEqual(b)
  })
})

describe('scaleBarKmFor', () => {
  it('picks a readable round-number scale about a third of the route', () => {
    expect(scaleBarKmFor(3)).toBe(1)
    expect(scaleBarKmFor(7)).toBe(5)
    expect(scaleBarKmFor(13)).toBe(5)
    expect(scaleBarKmFor(27)).toBe(10)
    expect(scaleBarKmFor(60)).toBe(20)
    expect(scaleBarKmFor(120)).toBe(50)
  })

  it('degenerate distances still get a 1 km bar, not NaN', () => {
    expect(scaleBarKmFor(0)).toBe(1)
    expect(scaleBarKmFor(-5)).toBe(1)
    expect(scaleBarKmFor(Number.NaN)).toBe(1)
  })
})

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
