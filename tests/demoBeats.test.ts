import { describe, expect, it } from 'vitest'
import { DEMO_DATA, at } from '../src/data'
import {
  computeConnectionImpact,
  computeReachability,
  makeDefaultConstraints,
  summarizeResults,
} from '../src/engine'

/**
 * The ten signature-demo beats from the build spec, asserted against the
 * bundled dataset. Design targets (engineered into the timetable, per spec
 * "the dataset design that makes these beats coexist"):
 * - Default (Kozhikode, ₹2,000, 24 h, 12:00 IST): 11 reachable destinations,
 *   20 journey options (spec asks ~10 and ≥ 20).
 * - The 18:05 Mangaluru Express is Mangaluru's only remaining option and
 *   expires at the 18:25 scrub; Bengaluru survives the same evening on its
 *   20:30 direct overnight bus.
 * - Ooty (₹2,120) and Coorg (₹2,150) sit above the default budget and are
 *   revealed at ₹4,000.
 * - A 12-hour deadline (midnight) strands Bengaluru's overnight arrivals.
 */

function reachableIds(results: ReturnType<typeof computeReachability>): string[] {
  return results.filter((r) => r.reachable).map((r) => r.location.id)
}

function resultFor(results: ReturnType<typeof computeReachability>, id: string) {
  const r = results.find((x) => x.location.id === id)
  expect(r, `result for '${id}'`).toBeDefined()
  return r!
}

describe('beat 1 — load with defaults', () => {
  it('field blooms: 11 reachable destinations, ≥ 20 journey options, stats from the engine', () => {
    const results = computeReachability(DEMO_DATA, makeDefaultConstraints())
    const summary = summarizeResults(results)
    expect(summary.reachableCount).toBe(11)
    expect(summary.totalJourneys).toBeGreaterThanOrEqual(20)
    expect(summary.totalJourneys).toBe(20)
    expect(reachableIds(results)).toEqual([
      'thalassery',
      'kannur',
      'mangaluru',
      'wayanad',
      'bengaluru',
      'thrissur',
      'palakkad',
      'coimbatore',
      'ernakulam',
      'alappuzha',
      'kollam',
    ])
    expect(summary.cheapestFareINR).toBe(35) // Kannur Passenger → Thalassery
    expect(summary.roundTripCount).toBeGreaterThan(0)
  })
})

describe('beat 2 — select Bengaluru', () => {
  it('details show a transfer itinerary via Coimbatore with cost and arrival', () => {
    const blr = resultFor(computeReachability(DEMO_DATA, makeDefaultConstraints()), 'bengaluru')
    expect(blr.best).not.toBeNull()
    const best = blr.best!
    expect(best.transfers).toBeGreaterThanOrEqual(1)
    expect(best.legs.map((l) => l.to)).toContain('coimbatore')
    expect(best.costINR).toBe(1520) // 90 + 180 + 1250
    expect(best.legs[0]!.connId).toBe('TRN-16649-KZK-THR')
    expect(best.legs[2]!.connId).toBe('TRN-16545-CBE-BLR')
    expect(blr.criticalConnId).toBeNull() // no single loss strands it
  })
})

describe('beats 3–5 — the 18:05 express expiry, Mangaluru greys, Bengaluru survives', () => {
  const expressId = 'TRN-16658-KZK-MGL'

  it('beat 3: scrub to 18:25 — the express expires; before that it is boardable', () => {
    const at1750 = computeReachability(DEMO_DATA, {
      ...makeDefaultConstraints(),
      now: at(17, 50),
    })
    expect(resultFor(at1750, 'mangaluru').journeys.some((j) => j.legs.some((l) => l.connId === expressId))).toBe(true)

    const at1825 = computeReachability(DEMO_DATA, {
      ...makeDefaultConstraints(),
      now: at(18, 25),
    })
    for (const r of at1825) {
      for (const j of r.journeys) {
        for (const leg of j.legs) {
          expect(leg.connId, `${r.location.id} still uses the expired express`).not.toBe(expressId)
        }
      }
    }
  })

  it('beat 4: Mangaluru’s itinerary via that train greys — no alternate remains', () => {
    const mgl = resultFor(
      computeReachability(DEMO_DATA, { ...makeDefaultConstraints(), now: at(18, 25) }),
      'mangaluru',
    )
    expect(mgl.reachable).toBe(false)
    expect(mgl.journeys).toHaveLength(0)
    expect(mgl.reason).toMatch(/left Kozhikode at 18:05/)
  })

  it('beat 5: continue to 19:00 — Bengaluru never blanks via its alternate route', () => {
    for (const now of [at(18, 25), at(18, 45), at(19, 0)]) {
      const blr = resultFor(
        computeReachability(DEMO_DATA, { ...makeDefaultConstraints(), now }),
        'bengaluru',
      )
      expect(blr.reachable, `bengaluru at ${now}`).toBe(true)
      expect(blr.best?.legs[0]!.connId).toBe('BUS-500-KZK-BLR') // direct overnight
    }
    const at1900 = resultFor(
      computeReachability(DEMO_DATA, { ...makeDefaultConstraints(), now: at(19, 0) }),
      'bengaluru',
    )
    expect(at1900.journeys).toHaveLength(1)
  })

  it('the express is Mangaluru’s critical connection at the default clock', () => {
    const mgl = resultFor(computeReachability(DEMO_DATA, makeDefaultConstraints()), 'mangaluru')
    expect(mgl.criticalConnId).toBe(expressId)
  })

  it('the counterfactual alert arithmetic: excluding the express strands exactly Mangaluru', () => {
    const impact = computeConnectionImpact(DEMO_DATA, makeDefaultConstraints(), expressId)
    expect(impact.journeysRemoved).toBe(1)
    expect(impact.destinationsLost.map((d) => d.locationId)).toEqual(['mangaluru'])
    expect(impact.destinationsAffected).toHaveLength(1)
  })
})

describe('beat 6 — budget ₹2,000 → ₹4,000 reveals new destinations', () => {
  it('Ooty and Coorg emerge with the growth', () => {
    const base = resultFor(computeReachability(DEMO_DATA, makeDefaultConstraints()), 'ooty')
    expect(base.reachable).toBe(false)
    expect(base.reason).toMatch(/₹2,000 budget/)

    const rich = computeReachability(DEMO_DATA, { ...makeDefaultConstraints(), budgetINR: 4000 })
    expect(reachableIds(rich)).toHaveLength(13)
    const ooty = resultFor(rich, 'ooty')
    const coorg = resultFor(rich, 'coorg')
    expect(ooty.reachable).toBe(true)
    expect(ooty.best?.costINR).toBe(2120) // Ernad chain + Ooty Hill Bus
    expect(coorg.reachable).toBe(true)
    expect(coorg.best?.legs[0]!.connId).toBe('BUS-497-KZK-MDK')
    expect(ooty.roundTrip).toBeNull() // honest: one-way only
  })
})

describe('beat 7 — time 24 h → 12 h contracts the field', () => {
  it('long-duration nodes grey out with a deadline reason; short hops survive', () => {
    const short = computeReachability(DEMO_DATA, { ...makeDefaultConstraints(), availableHours: 12 })
    const blr = resultFor(short, 'bengaluru')
    expect(blr.reachable).toBe(false)
    expect(blr.reason).toMatch(/01:30 \(\+1d\)/)
    expect(blr.reason).toMatch(/deadline/)
    for (const id of ['kannur', 'thrissur', 'ernakulam']) {
      expect(resultFor(short, id).reachable, id).toBe(true)
    }
    expect(summarizeResults(short).reachableCount).toBe(10)
  })
})

describe('beat 8 — budget ₹1,200 thins the field', () => {
  it('budget-sensitive nodes drop with a cost reason', () => {
    const tight = computeReachability(DEMO_DATA, { ...makeDefaultConstraints(), budgetINR: 1200 })
    const blr = resultFor(tight, 'bengaluru')
    expect(blr.reachable).toBe(false)
    expect(blr.reason).toMatch(/₹1,520/)
    expect(blr.reason).toMatch(/budget/)
    for (const id of ['kannur', 'thrissur', 'ernakulam', 'kollam']) {
      expect(resultFor(tight, id).reachable, id).toBe(true)
    }
    expect(summarizeResults(tight).reachableCount).toBe(10)
  })
})

describe('beats 9–10 — scrubbing backwards restores exactly; reset is exact', () => {
  it('beat 9: recompute after scrubbing back deep-equals the earlier state', () => {
    const before = computeReachability(DEMO_DATA, makeDefaultConstraints())
    const later = computeReachability(DEMO_DATA, { ...makeDefaultConstraints(), now: at(18, 25) })
    expect(summarizeResults(later).reachableCount).toBeLessThan(summarizeResults(before).reachableCount)
    const restored = computeReachability(DEMO_DATA, makeDefaultConstraints())
    expect(JSON.stringify(restored)).toBe(JSON.stringify(before))
  })

  it('beat 10: reset reproduces the exact initial state, byte for byte', () => {
    const first = computeReachability(DEMO_DATA, makeDefaultConstraints())
    const reset = computeReachability(DEMO_DATA, makeDefaultConstraints())
    expect(reset).toEqual(first)
    expect(summarizeResults(reset)).toEqual({
      reachableCount: 11,
      totalJourneys: 20,
      roundTripCount: expect.any(Number),
      cheapestFareINR: 35,
    })
  })

  it('snapshot: default-scenario shape (id, reachable, journeys, round trip, critical conn)', () => {
    const results = computeReachability(DEMO_DATA, makeDefaultConstraints())
    expect(
      results.map((r) => ({
        id: r.location.id,
        reachable: r.reachable,
        options: r.journeys.length,
        dayTrip: r.roundTrip !== null,
        critical: r.criticalConnId,
      })),
    ).toMatchSnapshot()
  })
})
