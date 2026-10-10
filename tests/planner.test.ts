import { describe, expect, it } from 'vitest'
import { at, loadTransportData } from '../src/data'
import type { Connection, Location, TransportData } from '../src/data'
import { MIN_TRIP_DWELL_MIN, planDayTrips } from '../src/engine/planner'
import type { InterestId, PoiActivity, PoiCatalog, PoiMeal, PlannerInput, TripPlan } from '../src/engine/planner'

/**
 * Planner fixtures are self-contained: fixture locations/connections feed the
 * same `loadTransportData` builder the engine tests use, and the POI catalog
 * is a plain injected object — no real catalog imports (they land in the data
 * PR; the engine must compile and test without them).
 */

const ORIGIN = 'kozhikode'

function fixtureData(
  connections: Connection[],
  names: Record<string, string> = {},
  extraIds: string[] = [],
): TransportData {
  const ids = new Set<string>([ORIGIN, ...extraIds])
  for (const c of connections) {
    ids.add(c.from)
    ids.add(c.to)
  }
  const locations: Location[] = [...ids].sort().map((id) => ({
    id,
    name: names[id] ?? id.toUpperCase(),
    region: 'Kerala',
    tags: [],
  }))
  return loadTransportData(locations, connections)
}

function leg(id: string, from: string, to: string, depart: number, arrive: number, costINR: number): Connection {
  return { id, from, to, mode: 'train', depart, arrive, costINR, label: `Service ${id}` }
}

function act(
  id: string,
  destinationId: string,
  title: string,
  category: InterestId,
  costINR: number,
  durationMin: number,
): PoiActivity {
  return { id, destinationId, title, category, costINR, durationMin, blurb: 'Synthetic estimate.' }
}

function meal(
  id: string,
  destinationId: string,
  name: string,
  costINR: number,
  windowStartMin: number,
  windowEndMin: number,
): PoiMeal {
  return { id, destinationId, name, costINR, windowStartMin, windowEndMin, blurb: 'Synthetic estimate.' }
}

function catalog(activities: PoiActivity[], meals: PoiMeal[]): PoiCatalog {
  return { activities, meals, spots: [] }
}

function plannerInput(overrides: Partial<PlannerInput> = {}): PlannerInput {
  return {
    originId: ORIGIN,
    now: at(8), // 08:00 IST
    availableHours: 12, // deadline 20:00 IST
    budgetINR: 1000,
    minTransferMin: 20,
    interests: [],
    ...overrides,
  }
}

function planFor(plans: TripPlan[], id: string): TripPlan {
  const plan = plans.find((p) => p.destinationId === id)
  expect(plan, `plan for '${id}'`).toBeDefined()
  return plan!
}

describe('dwell minimum — a there-and-back is not a trip', () => {
  // Kollam's only return leaves 60 min after arrival; Kochi's leaves exactly
  // the 90-minute minimum. The planner's shifted clock (arrival + 90) makes
  // Kollam's return unboardable — exactly where Explore's 60-minute rule
  // would still count the round trip.
  const data = fixtureData([
    leg('OUT-KLM', ORIGIN, 'kollam', at(8), at(17), 100),
    leg('RET-KLM', 'kollam', ORIGIN, at(18), at(19), 100),
    leg('OUT-KCH', ORIGIN, 'kochi', at(8), at(17), 100),
    leg('RET-KCH', 'kochi', ORIGIN, at(18, 30), at(19, 30), 100),
  ])
  const poi = catalog(
    [act('klm-view', 'kollam', 'Backwater view', 'nature', 50, 60), act('kch-fort', 'kochi', 'Fort walk', 'heritage', 50, 60)],
    [meal('klm-meal', 'kollam', 'Kerala sadhya', 200, 16 * 60, 20 * 60), meal('kch-meal', 'kochi', 'Harbour thali', 200, 16 * 60, 20 * 60)],
  )

  it('exports the 90-minute contract constant', () => {
    expect(MIN_TRIP_DWELL_MIN).toBe(90)
  })

  it('offers no plan when the dwell window is under 90 minutes', () => {
    const plans = planDayTrips(data, poi, plannerInput())
    expect(plans.find((p) => p.destinationId === 'kollam')).toBeUndefined()
  })

  it('accepts a dwell of exactly 90 minutes (boundary)', () => {
    const plans = planDayTrips(data, poi, plannerInput())
    const kochi = planFor(plans, 'kochi')
    expect(kochi.dwellMin).toBe(90)
  })

  it('derives the evening meal slot for a late dwell midpoint', () => {
    const plans = planDayTrips(data, poi, plannerInput())
    expect(planFor(plans, 'kochi').meal?.slot).toBe('evening') // midpoint 17:45
  })
})

describe('happy path — every leg, minute, and rupee accounted for', () => {
  const data = fixtureData(
    [leg('OUT-CBE', ORIGIN, 'coimbatore', at(8), at(10), 200), leg('RET-CBE', 'coimbatore', ORIGIN, at(18), at(20), 200)],
    { coimbatore: 'Coimbatore' },
  )
  const poi = catalog(
    [act('cb-food-walk', 'coimbatore', 'Street-food walk', 'food', 150, 90), act('cb-fort', 'coimbatore', 'Fort viewpoint', 'heritage', 100, 60)],
    [meal('cb-lunch', 'coimbatore', 'Annalakshmi thali', 300, 12 * 60, 15 * 60)],
  )
  const plans = planDayTrips(data, poi, plannerInput({ interests: ['food', 'heritage'] }))

  it('produces one ranked plan for the reachable destination', () => {
    expect(plans).toHaveLength(1)
    expect(plans[0]!.destinationId).toBe('coimbatore')
  })

  it('packs activities in the user’s interest order', () => {
    expect(plans[0]!.activities.map((a) => a.id)).toEqual(['cb-food-walk', 'cb-fort'])
  })

  it('places one meal inside its service window at the dwell midpoint', () => {
    const m = plans[0]!.meal
    expect(m?.id).toBe('cb-lunch')
    expect(m?.slot).toBe('lunch') // midpoint 14:00
  })

  it('accounts the full cost breakdown inside the budget', () => {
    const costs = plans[0]!.costs
    expect(costs.travelINR).toBe(400)
    expect(costs.activitiesINR).toBe(250)
    expect(costs.mealINR).toBe(300)
    expect(costs.totalINR).toBe(950)
    expect(costs.totalINR).toBeLessThanOrEqual(1000)
  })

  it('respects the clock: depart at the constraint, home before the deadline', () => {
    const plan = plans[0]!
    expect(plan.departAt).toBe(at(8))
    expect(plan.arriveBackAt).toBe(at(20))
    expect(plan.dwellMin).toBe(480)
    expect(plan.interestsMatched).toEqual(['food', 'heritage'])
  })
})

describe('interests selected, destination has none of them', () => {
  const data = fixtureData([
    leg('OUT-WYD', ORIGIN, 'wayanad', at(8), at(10), 150),
    leg('RET-WYD', 'wayanad', ORIGIN, at(18), at(19, 30), 150),
    leg('OUT-KSD', ORIGIN, 'kasaragod', at(8), at(10), 100),
    leg('RET-KSD', 'kasaragod', ORIGIN, at(18), at(19), 100),
  ])
  const poi = catalog(
    [act('wy-spice', 'wayanad', 'Spice garden', 'food', 100, 60)],
    [
      meal('wy-dinner', 'wayanad', 'Resort dinner', 250, 12 * 60, 15 * 60),
      // Kasaragod's only meal service misses the dwell midpoint (14:00).
      meal('ksd-meal', 'kasaragod', 'Coastal thali', 250, 12 * 60, 13 * 60),
    ],
  )

  it('offers a meal-only day when a meal fits', () => {
    const wayanad = planFor(planDayTrips(data, poi, plannerInput({ interests: ['nightlife'] })), 'wayanad')
    expect(wayanad.activities).toEqual([])
    expect(wayanad.meal?.id).toBe('wy-dinner')
    expect(wayanad.interestsMatched).toEqual([]) // food was not selected
    expect(wayanad.costs.totalINR).toBe(150 + 150 + 250)
  })

  it('offers no plan when nothing fits — not even the meal', () => {
    const plans = planDayTrips(data, poi, plannerInput({ interests: ['nightlife'] }))
    expect(plans.find((p) => p.destinationId === 'kasaragod')).toBeUndefined()
  })
})

describe('budget reconciliation drops lowest-priority activities', () => {
  const makeData = () =>
    fixtureData(
      [leg('OUT-MYS', ORIGIN, 'mysuru', at(8), at(9), 150), leg('RET-MYS', 'mysuru', ORIGIN, at(18), at(19), 150)],
      { mysuru: 'Mysuru' },
    )

  it('keeps the highest-priority activities and the meal', () => {
    const poi = catalog(
      [act('mys-food', 'mysuru', 'Mysuru food trail', 'food', 300, 60), act('mys-palace', 'mysuru', 'Palace grounds', 'heritage', 400, 60)],
      [meal('mys-lunch', 'mysuru', 'Mysuru thali', 300, 12 * 60, 15 * 60)],
    )
    const plans = planDayTrips(makeData(), poi, plannerInput({ interests: ['food', 'heritage'] }))
    const mysuru = planFor(plans, 'mysuru')
    expect(mysuru.activities.map((a) => a.id)).toEqual(['mys-food']) // heritage dropped
    expect(mysuru.meal?.id).toBe('mys-lunch') // meal survives, plan survives
    expect(mysuru.costs.totalINR).toBe(150 + 150 + 300 + 300)
    expect(mysuru.costs.totalINR).toBeLessThanOrEqual(1000)
  })

  it('falls all the way to meal-only when even one activity cannot fit', () => {
    const poi = catalog(
      [act('mys-food', 'mysuru', 'Mysuru food trail', 'food', 500, 60), act('mys-palace', 'mysuru', 'Palace grounds', 'heritage', 400, 60)],
      [meal('mys-lunch', 'mysuru', 'Mysuru thali', 300, 12 * 60, 15 * 60)],
    )
    const plans = planDayTrips(makeData(), poi, plannerInput({ interests: ['food', 'heritage'] }))
    const mysuru = planFor(plans, 'mysuru')
    expect(mysuru.activities).toEqual([])
    expect(mysuru.meal?.id).toBe('mys-lunch')
    expect(mysuru.costs.totalINR).toBe(150 + 150 + 300)
  })
})

describe('deadline discipline — no silent overrun', () => {
  // Gokarnam's only return lands at 21:00, past the 20:00 deadline; Kannur's
  // lands at 19:00. Same day, same budget — the overrun destination yields
  // nothing.
  const data = fixtureData([
    leg('OUT-GOK', ORIGIN, 'gokarnam', at(8), at(15), 100),
    leg('RET-GOK', 'gokarnam', ORIGIN, at(17), at(21), 100),
    leg('OUT-KNR', ORIGIN, 'kannur', at(8), at(12), 100),
    leg('RET-KNR', 'kannur', ORIGIN, at(17), at(19), 100),
  ])
  const poi = catalog(
    [act('gok-beach', 'gokarnam', 'Beach walk', 'nature', 50, 60), act('knr-fort', 'kannur', 'Fort stroll', 'heritage', 50, 60)],
    [meal('gok-meal', 'gokarnam', 'Beach shack thali', 200, 16 * 60, 20 * 60), meal('knr-meal', 'kannur', 'Ayurvedic thali', 200, 14 * 60, 15 * 60)],
  )

  it('drops the plan whose return misses the deadline, keeps the rest', () => {
    const plans = planDayTrips(data, poi, plannerInput())
    expect(plans.find((p) => p.destinationId === 'gokarnam')).toBeUndefined()
    expect(planFor(plans, 'kannur').arriveBackAt).toBe(at(19))
  })
})

describe('no interests selected — any activity or meal qualifies', () => {
  const data = fixtureData([
    leg('OUT-BEK', ORIGIN, 'bekal', at(8), at(10), 200),
    leg('RET-BEK', 'bekal', ORIGIN, at(18), at(20), 200),
    leg('OUT-WYD', ORIGIN, 'wayanad', at(8), at(10), 150),
    leg('RET-WYD', 'wayanad', ORIGIN, at(18), at(19, 30), 150),
  ])
  const poi = catalog(
    [
      act('bk-fort', 'bekal', 'Fort walk', 'heritage', 100, 60),
      act('bk-beach', 'bekal', 'Beach sunrise', 'nature', 0, 60),
      act('wy-view', 'wayanad', 'Valley view', 'nature', 50, 60),
    ],
    [
      meal('bk-meal', 'bekal', 'Beachside thali', 200, 12 * 60, 15 * 60),
      // Wayanad's meal service misses the dwell midpoint — activities-only day.
      meal('wy-meal', 'wayanad', 'Resort thali', 200, 12 * 60, 13 * 60),
    ],
  )

  it('packs free sights first (cost-effectiveness) with no interest filter', () => {
    const bekal = planFor(planDayTrips(data, poi, plannerInput()), 'bekal')
    expect(bekal.activities.map((a) => a.id)).toEqual(['bk-beach', 'bk-fort'])
    expect(bekal.meal?.id).toBe('bk-meal')
    expect(bekal.interestsMatched).toEqual([])
  })

  it('offers an activities-only day when the meal cannot fit', () => {
    const wayanad = planFor(planDayTrips(data, poi, plannerInput()), 'wayanad')
    expect(wayanad.activities.map((a) => a.id)).toEqual(['wy-view'])
    expect(wayanad.meal).toBeNull()
    expect(wayanad.costs.totalINR).toBe(150 + 150 + 50)
  })
})

describe('ranking — deterministic across runs and machines', () => {
  // All six destinations share the same clocks and (unless noted) the same
  // fares, so each rank factor is isolated: Coimbatore matches both selected
  // interests; Wayanad out-utilizes Bekal; Mysuru undercuts Bekal on cost;
  // Kovalam and Varkala tie on every number and separate by name.
  const connections: Connection[] = [
    leg('OUT-CBE', ORIGIN, 'coimbatore', at(8), at(10), 200),
    leg('RET-CBE', 'coimbatore', ORIGIN, at(18), at(20), 200),
    leg('OUT-BEK', ORIGIN, 'bekal', at(8), at(10), 200),
    leg('RET-BEK', 'bekal', ORIGIN, at(18), at(20), 200),
    leg('OUT-WYD', ORIGIN, 'wayanad', at(8), at(10), 200),
    leg('RET-WYD', 'wayanad', ORIGIN, at(18), at(20), 200),
    leg('OUT-MYS', ORIGIN, 'mysuru', at(8), at(10), 200),
    leg('RET-MYS', 'mysuru', ORIGIN, at(18), at(20), 200),
    leg('OUT-KVL', ORIGIN, 'kovalam', at(8), at(10), 200),
    leg('RET-KVL', 'kovalam', ORIGIN, at(18), at(20), 200),
    leg('OUT-VKL', ORIGIN, 'varkala', at(8), at(10), 200),
    leg('RET-VKL', 'varkala', ORIGIN, at(18), at(20), 200),
  ]
  const names: Record<string, string> = {
    coimbatore: 'Coimbatore',
    bekal: 'Bekal',
    wayanad: 'Wayanad',
    mysuru: 'Mysuru',
    kovalam: 'Kovalam',
    varkala: 'Varkala',
  }
  const poi = catalog(
    [
      act('cb-food', 'coimbatore', 'Food street', 'food', 100, 60),
      act('cb-her', 'coimbatore', 'Mariamman temple', 'heritage', 100, 60),
      act('bk-food', 'bekal', 'Fort food trail', 'food', 100, 180),
      act('wy-food', 'wayanad', 'Plantation kitchen', 'food', 100, 240),
      act('mys-food', 'mysuru', 'Mysuru pak trail', 'food', 50, 180),
      act('kvl-food', 'kovalam', 'Lighthouse cafe crawl', 'food', 100, 60),
      act('vkl-food', 'varkala', 'Cliff cafe crawl', 'food', 100, 60),
    ],
    [
      meal('cb-meal', 'coimbatore', 'Annapoorna thali', 300, 12 * 60, 15 * 60),
      meal('bk-meal', 'bekal', 'Beach thali', 300, 12 * 60, 15 * 60),
      meal('wy-meal', 'wayanad', 'Plantation thali', 300, 12 * 60, 15 * 60),
      meal('mys-meal', 'mysuru', 'Grand thali', 300, 12 * 60, 15 * 60),
      meal('kvl-meal', 'kovalam', 'Coast thali', 300, 12 * 60, 15 * 60),
      meal('vkl-meal', 'varkala', 'Cliff thali', 300, 12 * 60, 15 * 60),
    ],
  )
  const input = plannerInput({ interests: ['food', 'heritage'] })
  const plans = planDayTrips(fixtureData(connections, names), poi, input)
  const rank = (id: string): number => plans.findIndex((p) => p.destinationId === id)

  it('ranks more distinct interests matched first, before anything else', () => {
    expect(rank('coimbatore')).toBeLessThan(rank('bekal'))
  })

  it('breaks interest ties by dwell utilization, even against the name order', () => {
    // Wayanad fills 240 of 480 minutes; Bekal only 180 — and 'Bekal' sorts first.
    expect(rank('wayanad')).toBeLessThan(rank('bekal'))
  })

  it('breaks utilization ties by lower total cost, even against the name order', () => {
    // Equal utilization (180/480), Mysuru ₹50 cheaper — and 'Mysuru' sorts after 'Bekal'.
    expect(rank('mysuru')).toBeLessThan(rank('bekal'))
  })

  it('breaks full ties by destination name', () => {
    expect(rank('kovalam')).toBeLessThan(rank('varkala'))
  })

  it('is deterministic: equal inputs produce deep-equal ranked output', () => {
    const again = planDayTrips(fixtureData(connections, names), poi, input)
    expect(again).toEqual(plans)
    expect(JSON.stringify(again)).toBe(JSON.stringify(plans))
  })
})

describe('breakfast slot derivation on an early clock', () => {
  const data = fixtureData([
    leg('OUT-TCR', ORIGIN, 'thrissur', at(6), at(8), 100),
    leg('RET-TCR', 'thrissur', ORIGIN, at(9, 30), at(11), 100),
  ])
  const poi = catalog(
    [act('tcr-her', 'thrissur', 'Temple visit', 'heritage', 50, 60)],
    [meal('tcr-meal', 'thrissur', 'Early thali', 200, 8 * 60, 10 * 60)],
  )

  it('slots a meal whose midpoint falls before 11:00 as breakfast', () => {
    const plan = planFor(planDayTrips(data, poi, plannerInput({ now: at(6), availableHours: 14 })), 'thrissur')
    expect(plan.dwellMin).toBe(90)
    expect(plan.meal?.slot).toBe('breakfast') // midpoint 08:45
  })
})

describe('catalog contract', () => {
  const data = fixtureData(
    [leg('OUT-CBE', ORIGIN, 'coimbatore', at(8), at(10), 200), leg('RET-CBE', 'coimbatore', ORIGIN, at(18), at(20), 200)],
    { coimbatore: 'Coimbatore' },
  )

  it('returns no plans for an empty injected catalog (compiles without the data PR)', () => {
    expect(planDayTrips(data, catalog([], []), plannerInput())).toEqual([])
  })

  it('silently skips unreachable destinations', () => {
    const plans = planDayTrips(data, catalog([], []), plannerInput())
    expect(plans.find((p) => p.destinationId === 'leo')).toBeUndefined()
  })
})

describe('invariants over every produced plan', () => {
  const connections: Connection[] = [
    leg('OUT-CBE', ORIGIN, 'coimbatore', at(8), at(10), 200),
    leg('RET-CBE', 'coimbatore', ORIGIN, at(18), at(20), 200),
    leg('OUT-WYD', ORIGIN, 'wayanad', at(8), at(10), 150),
    leg('RET-WYD', 'wayanad', ORIGIN, at(18), at(19, 30), 150),
    leg('OUT-GOK', ORIGIN, 'gokarnam', at(8), at(15), 100),
    leg('RET-GOK', 'gokarnam', ORIGIN, at(17), at(21), 100),
    leg('OUT-KLM', ORIGIN, 'kollam', at(8), at(17), 100),
    leg('RET-KLM', 'kollam', ORIGIN, at(18), at(19), 100),
  ]
  const names: Record<string, string> = { coimbatore: 'Coimbatore', wayanad: 'Wayanad' }
  const poi = catalog(
    [
      act('cb-food', 'coimbatore', 'Food street', 'food', 100, 60),
      act('cb-her', 'coimbatore', 'Mariamman temple', 'heritage', 100, 60),
      act('wy-view', 'wayanad', 'Valley view', 'nature', 50, 60),
      act('gok-beach', 'gokarnam', 'Beach walk', 'nature', 50, 60),
      act('klm-view', 'kollam', 'Backwater view', 'nature', 50, 60),
    ],
    [
      meal('cb-meal', 'coimbatore', 'Annapoorna thali', 300, 12 * 60, 15 * 60),
      meal('wy-meal', 'wayanad', 'Plantation thali', 200, 12 * 60, 15 * 60),
      meal('gok-meal', 'gokarnam', 'Beach thali', 200, 16 * 60, 20 * 60),
      meal('klm-meal', 'kollam', 'Backwater thali', 200, 16 * 60, 20 * 60),
    ],
  )

  const interests: InterestId[] = ['food', 'heritage', 'nature']
  const input = plannerInput({ interests, budgetINR: 1000 })
  const plans = planDayTrips(fixtureData(connections, names), poi, input)

  it('only offers plans that satisfy every spec invariant', () => {
    expect(plans.length).toBeGreaterThanOrEqual(2)
    for (const plan of plans) {
      const { travelINR, activitiesINR, mealINR, totalINR } = plan.costs
      expect(travelINR + activitiesINR + mealINR).toBe(totalINR)
      expect(totalINR).toBeLessThanOrEqual(input.budgetINR)
      expect(plan.dwellMin).toBeGreaterThanOrEqual(MIN_TRIP_DWELL_MIN)
      expect(plan.departAt).toBeGreaterThanOrEqual(input.now)
      expect(plan.arriveBackAt).toBeLessThanOrEqual(at(20)) // the deadline
      expect(plan.activities.length + (plan.meal ? 1 : 0)).toBeGreaterThanOrEqual(1)
      // Matched interests are distinct, drawn from the selection, in user order.
      const matched = plan.interestsMatched
      expect(new Set(matched).size).toBe(matched.length)
      for (const m of matched) expect(interests).toContain(m)
      const order = matched.map((m) => interests.indexOf(m))
      expect([...order].sort((a, b) => a - b)).toEqual(order)
      expect(travelINR).toBe(plan.outbound.costINR + plan.returnJourney.costINR)
    }
  })
})
