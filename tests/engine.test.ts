import { describe, expect, it } from 'vitest'
import { DEMO_DATA, at, loadTransportData } from '../src/data'
import type { Connection, Location, TransportData } from '../src/data'
import {
  MIN_STAY_MINUTES,
  computeConnectionImpact,
  computeReachability,
  makeDefaultConstraints,
} from '../src/engine'
import type { Constraints } from '../src/engine'

/** Builds a validated dataset over nodes mentioned in the connections plus 'a'. */
function fixtureData(connections: Connection[]): TransportData {
  const ids = new Set<string>(['a', 'b', 'c'])
  for (const c of connections) {
    ids.add(c.from)
    ids.add(c.to)
  }
  const locations: Location[] = [...ids]
    .sort()
    .map((id) => ({ id, name: id.toUpperCase(), region: 'Kerala', tags: [], lat: 10.0, lon: 76.0 }))
  return loadTransportData(locations, connections)
}

function baseConstraints(overrides: Partial<Constraints> = {}): Constraints {
  return {
    originId: 'a',
    now: at(9),
    availableHours: 12,
    budgetINR: 1000,
    minTransferMin: 20,
    ...overrides,
  }
}

function resultFor(results: ReturnType<typeof computeReachability>, id: string) {
  const r = results.find((x) => x.location.id === id)
  expect(r, `result for '${id}'`).toBeDefined()
  return r!
}

describe('budget boundary', () => {
  const data = fixtureData([
    { id: 'DIR', label: 'Direct Bus', mode: 'bus', from: 'a', to: 'b', depart: at(10), arrive: at(11), costINR: 100 },
  ])

  it('exactly at the fare is reachable', () => {
    const results = computeReachability(data, baseConstraints({ budgetINR: 100 }))
    const b = resultFor(results, 'b')
    expect(b.reachable).toBe(true)
    expect(b.best?.costINR).toBe(100)
  })

  it('one rupee below the cheapest fare marks it unreachable with a cost reason', () => {
    const results = computeReachability(data, baseConstraints({ budgetINR: 99 }))
    const b = resultFor(results, 'b')
    expect(b.reachable).toBe(false)
    expect(b.journeys).toHaveLength(0)
    expect(b.reason).toMatch(/₹100/)
    expect(b.reason).toMatch(/budget/)
  })
})

describe('transfer feasibility (20-minute minimum)', () => {
  const data = fixtureData([
    { id: 'L1', label: 'Leg One', mode: 'bus', from: 'a', to: 'b', depart: at(10), arrive: at(10, 40), costINR: 50 },
    { id: 'L2-OK', label: 'Leg Two (20 min)', mode: 'train', from: 'b', to: 'c', depart: at(11), arrive: at(12), costINR: 50 },
  ])

  it('a 20-minute connection change is accepted (boundary)', () => {
    const results = computeReachability(data, baseConstraints())
    expect(resultFor(results, 'c').reachable).toBe(true)
  })

  it('a 5-minute connection change is rejected and explained', () => {
    const tight = fixtureData([
      { id: 'L1', label: 'Leg One', mode: 'bus', from: 'a', to: 'b', depart: at(10), arrive: at(10, 40), costINR: 50 },
      { id: 'L2-TIGHT', label: 'Leg Two (5 min)', mode: 'train', from: 'b', to: 'c', depart: at(10, 45), arrive: at(12), costINR: 50 },
    ])
    const results = computeReachability(tight, baseConstraints())
    const c = resultFor(results, 'c')
    expect(c.reachable).toBe(false)
    expect(c.reason).toMatch(/5 minutes/)
    expect(c.reason).toMatch(/20-minute minimum/)
  })
})

describe('nondominated alternatives (multilabel Pareto)', () => {
  const data = fixtureData([
    { id: 'FAST', label: 'Fast Train', mode: 'train', from: 'a', to: 'b', depart: at(10), arrive: at(11), costINR: 200 },
    { id: 'SLOW', label: 'Slow Bus', mode: 'bus', from: 'a', to: 'b', depart: at(10), arrive: at(13), costINR: 80 },
    { id: 'DOMINATED', label: 'Pricy Also-Fast', mode: 'bus', from: 'a', to: 'b', depart: at(10), arrive: at(11), costINR: 300 },
  ])

  it('keeps slower+cheaper alongside faster+pricier, drops the dominated one', () => {
    const b = resultFor(computeReachability(data, baseConstraints()), 'b')
    expect(b.journeys).toHaveLength(2)
    const ids = b.journeys.map((j) => j.legs[0]!.connId).sort()
    expect(ids).toEqual(['FAST', 'SLOW'])
  })

  it('best = cheapest, ties broken by earliest arrival', () => {
    const b = resultFor(computeReachability(data, baseConstraints()), 'b')
    expect(b.best?.costINR).toBe(80)
    expect(b.best?.legs[0]!.connId).toBe('SLOW')
  })

  it('a tighter budget correctly picks the slower+cheaper survivor', () => {
    const b = resultFor(computeReachability(data, baseConstraints({ budgetINR: 100 })), 'b')
    expect(b.reachable).toBe(true)
    expect(b.best?.legs[0]!.connId).toBe('SLOW')
  })
})

describe('missed departure with alternate preserved', () => {
  const data = fixtureData([
    { id: 'DIRECT', label: 'Direct Express', mode: 'train', from: 'a', to: 'b', depart: at(10), arrive: at(12), costINR: 500 },
    { id: 'CHAIN-1', label: 'First Hop', mode: 'bus', from: 'a', to: 'c', depart: at(10, 30), arrive: at(11), costINR: 100 },
    { id: 'CHAIN-2', label: 'Second Hop', mode: 'bus', from: 'c', to: 'b', depart: at(11, 30), arrive: at(13), costINR: 100 },
  ])

  it('before the departure both options exist', () => {
    const b = resultFor(computeReachability(data, baseConstraints({ now: at(9) })), 'b')
    expect(b.reachable).toBe(true)
    expect(b.journeys).toHaveLength(2)
  })

  it('clock past the departure removes its journeys; the alternate keeps b reachable', () => {
    const b = resultFor(computeReachability(data, baseConstraints({ now: at(10, 1) })), 'b')
    expect(b.reachable).toBe(true)
    expect(b.journeys).toHaveLength(1)
    const usedIds = b.journeys.flatMap((j) => j.legs.map((l) => l.connId))
    expect(usedIds).not.toContain('DIRECT')
    expect(usedIds).toEqual(['CHAIN-1', 'CHAIN-2'])
  })

  it('counterfactual exclusion of the direct reports the exact delta', () => {
    const impact = computeConnectionImpact(data, baseConstraints({ now: at(9) }), 'DIRECT')
    expect(impact.journeysRemoved).toBe(1)
    expect(impact.destinationsLost).toHaveLength(0)
    expect(impact.destinationsAffected.map((d) => d.locationId)).toEqual(['b'])
    expect(impact.survivors).toEqual([{ locationId: 'b', viaNode: 'c' }])
  })

  it('counterfactual exclusion of the chain strands nothing either — and unknown ids throw', () => {
    const impact = computeConnectionImpact(data, baseConstraints({ now: at(9) }), 'CHAIN-2')
    expect(impact.destinationsLost).toHaveLength(0)
    expect(() => computeConnectionImpact(data, baseConstraints({ now: at(9) }), 'NOPE')).toThrow(
      /unknown connection 'NOPE'/,
    )
  })
})

describe('round-trip honesty', () => {
  it('flags a day trip only when a return fits the same deadline and budget', () => {
    const data = fixtureData([
      { id: 'OUT', label: 'Out', mode: 'train', from: 'a', to: 'b', depart: at(10), arrive: at(11), costINR: 100 },
      { id: 'RET', label: 'Back', mode: 'train', from: 'b', to: 'a', depart: at(14), arrive: at(15), costINR: 100 },
    ])
    const b = resultFor(computeReachability(data, baseConstraints()), 'b')
    expect(b.reachable).toBe(true)
    expect(b.roundTrip).not.toBeNull()
    expect(b.roundTrip?.legs[0]!.connId).toBe('RET')
    expect(b.reason).toMatch(/Day trip possible/)
  })

  it(`respects the ${MIN_STAY_MINUTES}-minute minimum stay before the return boards`, () => {
    const data = fixtureData([
      { id: 'OUT', label: 'Out', mode: 'train', from: 'a', to: 'b', depart: at(10), arrive: at(11), costINR: 100 },
      { id: 'RET-EARLY', label: 'Too Soon', mode: 'train', from: 'b', to: 'a', depart: at(11, 30), arrive: at(12, 15), costINR: 50 },
      { id: 'RET-LATE', label: 'After Stay', mode: 'train', from: 'b', to: 'a', depart: at(14), arrive: at(15), costINR: 100 },
    ])
    const b = resultFor(computeReachability(data, baseConstraints()), 'b')
    expect(b.roundTrip?.legs[0]!.connId).toBe('RET-LATE')
  })

  it('one-way only when the return would land after the deadline', () => {
    const data = fixtureData([
      { id: 'OUT', label: 'Out', mode: 'train', from: 'a', to: 'b', depart: at(10), arrive: at(11), costINR: 100 },
      { id: 'RET-NIGHT', label: 'Back Late', mode: 'train', from: 'b', to: 'a', depart: at(22), arrive: at(23), costINR: 100 },
    ])
    const b = resultFor(computeReachability(data, baseConstraints({ availableHours: 6 })), 'b')
    expect(b.reachable).toBe(true)
    expect(b.roundTrip).toBeNull()
    expect(b.reason).toMatch(/No valid return/)
  })

  it('one-way only when the return would break the budget', () => {
    const data = fixtureData([
      { id: 'OUT', label: 'Out (₹900)', mode: 'train', from: 'a', to: 'b', depart: at(10), arrive: at(11), costINR: 900 },
      { id: 'RET', label: 'Back (₹200)', mode: 'train', from: 'b', to: 'a', depart: at(14), arrive: at(15), costINR: 200 },
    ])
    const b = resultFor(computeReachability(data, baseConstraints({ budgetINR: 1000 })), 'b')
    expect(b.reachable).toBe(true)
    expect(b.roundTrip).toBeNull()
  })
})

describe('determinism', () => {
  it('two runs over identical constraints deep-equal', () => {
    const a = computeReachability(DEMO_DATA, makeDefaultConstraints())
    const b = computeReachability(DEMO_DATA, makeDefaultConstraints())
    expect(JSON.stringify(b)).toBe(JSON.stringify(a))
  })
})
