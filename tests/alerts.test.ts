import { describe, expect, it } from 'vitest'
import { DEMO_DATA, at } from '../src/data'
import type { Constraints } from '../src/engine'
import type { ConnectionImpact } from '../src/engine'
import { ALERT_WINDOW_MS, buildDepartureAlerts, describeImpact } from '../src/state/alerts'

function baseConstraints(overrides: Partial<Constraints> = {}): Constraints {
  return {
    originId: 'kozhikode',
    now: at(12),
    availableHours: 24,
    budgetINR: 2_000,
    minTransferMin: 20,
    ...overrides,
  }
}

function impact(overrides: Partial<ConnectionImpact> = {}): ConnectionImpact {
  return {
    connectionId: 'TRN-X',
    journeysRemoved: 2,
    destinationsLost: [{ locationId: 'mangaluru', optionsBefore: 1, optionsAfter: 0, optionsRemoved: 1, wasReachable: true, stillReachable: false }],
    destinationsAffected: [],
    survivors: [{ locationId: 'bengaluru', viaNode: 'coimbatore' }],
    ...overrides,
  }
}

/** The earliest timetable departure after 12:00 — keeps these tests off hardcoded dataset figures. */
function firstDepartureAfter(ms: number) {
  const upcoming = DEMO_DATA.connections
    .filter((c) => c.depart > ms)
    .sort((a, b) => a.depart - b.depart)
  expect(upcoming.length, 'a departure after the given time').toBeGreaterThan(0)
  return upcoming[0]!
}

describe('buildDepartureAlerts', () => {
  it('raises an alert for a departure inside the 30-minute window, with the computed delta', () => {
    const conn = firstDepartureAfter(at(12))
    const constraints = baseConstraints({ now: conn.depart - 20 * 60_000 })
    const alerts = buildDepartureAlerts(DEMO_DATA, constraints)

    const mine = alerts.find((a) => a.connectionId === conn.id)
    expect(mine).toBeDefined()
    expect(mine!.minutesUntil).toBe(20)
    expect(mine!.headline).toBe(`${conn.label} departs in 20 min`)
    // The detail is the engine's arithmetic, not prose invention.
    expect(mine!.detail).toMatch(new RegExp(`removes ${mine!.impact.journeysRemoved} journey option`))
  })

  it('stays silent outside the window and after the departure', () => {
    const conn = firstDepartureAfter(at(12) + ALERT_WINDOW_MS)
    const before = baseConstraints({ now: conn.depart - 31 * 60_000 })
    expect(buildDepartureAlerts(DEMO_DATA, before).some((a) => a.connectionId === conn.id)).toBe(false)

    const past = baseConstraints({ now: conn.depart + 5 * 60_000 })
    expect(buildDepartureAlerts(DEMO_DATA, past).some((a) => a.connectionId === conn.id)).toBe(false)
  })

  it('is deterministic for identical constraints', () => {
    const constraints = baseConstraints()
    expect(buildDepartureAlerts(DEMO_DATA, constraints)).toEqual(buildDepartureAlerts(DEMO_DATA, constraints))
  })

  it('orders the most disruptive departure first', () => {
    const constraints = baseConstraints()
    const alerts = buildDepartureAlerts(DEMO_DATA, constraints)
    const removals = alerts.map((a) => a.impact.journeysRemoved)
    expect([...removals].sort((a, b) => b - a)).toEqual(removals)
  })
})

describe('describeImpact', () => {
  it('names removals, stranded destinations, and survivors', () => {
    const text = describeImpact(DEMO_DATA, 'Mangaluru Express', impact())
    expect(text).toBe('Missing "Mangaluru Express" removes 2 journey options; Mangaluru becomes unreachable; Bengaluru stays reachable via Coimbatore.')
  })

  it('handles the zero-impact case honestly', () => {
    const text = describeImpact(DEMO_DATA, 'Local', impact({ journeysRemoved: 0, destinationsLost: [] }))
    expect(text).toBe('Missing "Local" removes no journey options — every affected destination keeps an alternate.')
  })

  it('keeps singular grammar for one removed option', () => {
    const text = describeImpact(DEMO_DATA, 'Late bus', impact({ journeysRemoved: 1 }))
    expect(text).toContain('removes 1 journey option;')
  })
})
