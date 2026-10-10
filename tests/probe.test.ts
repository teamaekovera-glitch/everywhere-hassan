import { describe, expect, it } from 'vitest'
import { DEMO_DATA, at } from '../src/data'
import {
  makeDefaultConstraints,
  probeUnlock,
  searchFrom,
  toSearchInput,
  journeysFromLabels,
} from '../src/engine'
import type { Constraints, SearchInput } from '../src/engine'
import { initSimState, simReducer } from '../src/state/store'
import type { ProbePreview } from '../src/state/store'

/** Does destination `id` have a nondominated option under these constraints? */
function isReachable(c: Constraints, id: string): boolean {
  return journeysFromLabels(searchFrom(DEMO_DATA, toSearchInput(c)).get(id)).length > 0
}

/** Reachability under one relaxed constraint axis, in the probe's own units. */
function unlocksAt(
  c: Constraints,
  id: string,
  axis: 'budget' | 'deadline' | 'departure',
  delta: number,
): boolean {
  const input: SearchInput = toSearchInput(c)
  const relaxed: SearchInput =
    axis === 'budget'
      ? { ...input, budgetINR: input.budgetINR + delta }
      : axis === 'deadline'
        ? { ...input, deadline: input.deadline + delta * 60_000 }
        : { ...input, now: input.now - delta * 60_000 }
  return journeysFromLabels(searchFrom(DEMO_DATA, relaxed).get(id)).length > 0
}

describe('probe — the 18:30 collapse snapshot (Mangaluru)', () => {
  const c: Constraints = { ...makeDefaultConstraints(), now: at(18, 30) }

  it(' Mangaluru gets a finite time delta naming the expired express', () => {
    const probe = probeUnlock(DEMO_DATA, c, 'mangaluru')
    expect(probe).not.toBeNull()
    expect(probe!.reachableNow).toBe(false)
    // No future inbound to Mangaluru exists at 18:30 — money cannot buy back
    // an expired departure, and the budget sweep must refuse to invent one.
    expect(probe!.minExtraBudget).toBeNull()
    // The honest unlock is temporal: the 18:05 express left 25 minutes ago.
    expect(probe!.minExtraTime).toBe(25)
    expect(probe!.timeRelaxation).toBe('departure')
  })

  it('blames the 18:05 express via the exclusion sweep', () => {
    const probe = probeUnlock(DEMO_DATA, c, 'mangaluru')!
    expect(probe.blockingConnection).not.toBeNull()
    expect(probe.blockingConnection!.connectionId).toBe('TRN-16658-KZK-MGL')
    expect(probe.blockingConnection!.label).toMatch(/Mangaluru Express \(18:05\)/)
    expect(probe.blockingConnection!.label).toMatch(/departs Kozhikode 18:05/)
  })

  it('the cheapest unlocked itinerary is the direct express, at estimated fare', () => {
    const probe = probeUnlock(DEMO_DATA, c, 'mangaluru')!
    const j = probe.cheapestUnlockedItinerary
    expect(j).not.toBeNull()
    expect(j!.legs.map((l) => l.connId)).toEqual(['TRN-16658-KZK-MGL'])
    expect(j!.costINR).toBe(190)
    expect(j!.arriveAt).toBe(at(22, 40))
  })

  it('applying the delta in the store semantics — rewind with the window adjusted — really unlocks', () => {
    // The preview rewinds the clock and stretches availableHours so the
    // absolute deadline stays fixed — the same relaxation the engine probed.
    const previewed: Constraints = {
      ...c,
      now: c.now - 25 * 60_000,
      availableHours: c.availableHours + 25 / 60,
    }
    expect(isReachable(previewed, 'mangaluru')).toBe(true)
  })
})

describe('probe — budget-blocked destinations at the default snapshot', () => {
  const c = makeDefaultConstraints()

  it('Ooty: ₹120 more, no time axis, blame inside the unlocked chain', () => {
    const probe = probeUnlock(DEMO_DATA, c, 'ooty')!
    expect(probe.reachableNow).toBe(false)
    expect(probe.minExtraBudget).toBe(120) // ₹2,000 budget vs ₹2,120 cheapest chain
    expect(probe.minExtraTime).toBeNull()
    expect(probe.timeRelaxation).toBeNull()
    expect(probe.cheapestUnlockedItinerary!.costINR).toBe(2120)
    // The blamed connection must be a leg of the unlocked chain — the probe
    // blames what the unlock actually depends on, never a bystander.
    const legIds = probe.cheapestUnlockedItinerary!.legs.map((l) => l.connId)
    expect(legIds).toContain(probe.blockingConnection!.connectionId)
  })

  it('₹2,119 budget still strands Ooty; ₹2,120 unlocks — the delta is exact', () => {
    expect(unlocksAt(c, 'ooty', 'budget', 120)).toBe(true)
    expect(unlocksAt(c, 'ooty', 'budget', 119)).toBe(false)
  })

  it('Bengaluru at the 12-hour beat: +90 min on the deadline, budget cannot help', () => {
    const short: Constraints = { ...c, availableHours: 12 }
    const probe = probeUnlock(DEMO_DATA, short, 'bengaluru')!
    expect(probe.minExtraBudget).toBeNull()
    expect(probe.minExtraTime).toBe(90) // Bengaluru Mail arrives 01:30 (+1d), 90 min past midnight
    expect(probe.timeRelaxation).toBe('deadline')
    expect(probe.cheapestUnlockedItinerary!.costINR).toBe(1520)
    expect(probe.blockingConnection).not.toBeNull()
  })
})

describe('probe — gating and hygiene', () => {
  const c = makeDefaultConstraints()

  it('already-reachable destinations never probe (null)', () => {
    expect(probeUnlock(DEMO_DATA, c, 'kannur')).toBeNull()
    expect(probeUnlock(DEMO_DATA, c, 'bengaluru')).toBeNull()
  })

  it('the origin never probes (null)', () => {
    expect(probeUnlock(DEMO_DATA, c, c.originId)).toBeNull()
  })

  it('an unknown destination id throws, like the rest of the engine', () => {
    expect(() => probeUnlock(DEMO_DATA, c, 'atlantis')).toThrow(/unknown destination/)
  })

  it('probing is deterministic: two calls deep-equal', () => {
    const late: Constraints = { ...makeDefaultConstraints(), now: at(18, 30) }
    expect(probeUnlock(DEMO_DATA, late, 'mangaluru')).toEqual(probeUnlock(DEMO_DATA, late, 'mangaluru'))
    expect(probeUnlock(DEMO_DATA, c, 'ooty')).toEqual(probeUnlock(DEMO_DATA, c, 'ooty'))
  })

  it('the probe never mutates the dataset or the caller constraints', () => {
    const snapshot = JSON.stringify({ data: DEMO_DATA.connections, c })
    probeUnlock(DEMO_DATA, { ...c, now: at(18, 30) }, 'mangaluru')
    expect(JSON.stringify({ data: DEMO_DATA.connections, c })).toBe(snapshot)
  })
})

describe('probe — transient preview in the store (spec: never mutates saved state)', () => {
  const preview: ProbePreview = {
    budgetINR: 2120,
    summary: 'Budget raised ₹2,000 → ₹2,120 (transient preview — not saved)',
  }

  it('applying a preview leaves every persisted field at baseline', () => {
    const s0 = initSimState()
    const s1 = simReducer(s0, { type: 'applyProbePreview', preview })
    expect(s1.probePreview).toEqual(preview)
    // The lens changes the recompute inputs, never the saved state.
    expect(s1.budgetINR).toBe(s0.budgetINR)
    expect(s1.availableHours).toBe(s0.availableHours)
    expect(s1.originId).toBe(s0.originId)
    expect(s1.clock).toEqual(s0.clock)
    expect(s1.selectedId).toBe(s0.selectedId)
    expect(s1.scenarios).toEqual(s0.scenarios)
  })

  it('any manual interaction exits the preview back to the live sim', () => {
    let s = simReducer(initSimState(), { type: 'applyProbePreview', preview })
    s = simReducer(s, { type: 'setBudget', inr: 3000 })
    expect(s.probePreview).toBeNull()
    expect(s.budgetINR).toBe(3000)

    s = simReducer(initSimState(), { type: 'applyProbePreview', preview })
    s = simReducer(s, { type: 'setNow', ms: at(14, 0) })
    expect(s.probePreview).toBeNull()

    s = simReducer(initSimState(), { type: 'applyProbePreview', preview })
    s = simReducer(s, { type: 'select', id: 'ooty' })
    expect(s.probePreview).toBeNull()
  })

  it('saving a scenario while a preview is active persists the baseline budget', () => {
    let s = simReducer(initSimState(), { type: 'applyProbePreview', preview })
    s = simReducer(s, { type: 'saveScenario', name: 'Baseline check' })
    const saved = s.scenarios.find((sc) => sc.name === 'Baseline check')
    expect(saved).not.toBeUndefined()
    expect(saved!.budgetINR).toBe(s.budgetINR) // baseline ₹2,000, never the previewed ₹2,120
  })

  it('clearProbePreview restores the exact baseline snapshot', () => {
    const s0 = initSimState()
    const s1 = simReducer(s0, { type: 'applyProbePreview', preview })
    const s2 = simReducer(s1, { type: 'clearProbePreview' })
    expect(s2.probePreview).toBeNull()
    expect(s2.budgetINR).toBe(s0.budgetINR)
    expect(s2.clock).toEqual(s0.clock)
    expect(s2.scenarios).toEqual(s0.scenarios)
    expect(s2.selectedId).toBe(s0.selectedId)
  })
})

describe('probe — monotonicity + minimality across snapshots (property)', () => {
  const snapshots: Constraints[] = [
    makeDefaultConstraints(),
    { ...makeDefaultConstraints(), now: at(18, 25) },
    { ...makeDefaultConstraints(), now: at(18, 30) },
    { ...makeDefaultConstraints(), availableHours: 12 },
    { ...makeDefaultConstraints(), budgetINR: 1200 },
  ]

  it('every finite delta unlocks; one unit less misses; extra slack still unlocks', () => {
    for (const c of snapshots) {
      const results = searchFrom(DEMO_DATA, toSearchInput(c))
      for (const loc of DEMO_DATA.locations) {
        if (loc.id === c.originId) continue
        const reachableNow = journeysFromLabels(results.get(loc.id)).length > 0
        const probe = probeUnlock(DEMO_DATA, c, loc.id)
        if (reachableNow) {
          expect(probe, `${loc.id} is reachable and must not probe`).toBeNull()
          continue
        }
        expect(probe, `${loc.id} is unreachable and must probe`).not.toBeNull()
        const p = probe!

        if (p.minExtraBudget !== null) {
          expect(unlocksAt(c, loc.id, 'budget', p.minExtraBudget), `${loc.id} budget Δ`).toBe(true)
          expect(unlocksAt(c, loc.id, 'budget', p.minExtraBudget - 1), `${loc.id} budget Δ−1`).toBe(false)
          expect(unlocksAt(c, loc.id, 'budget', p.minExtraBudget + 500), `${loc.id} budget Δ+500`).toBe(true)
        }
        if (p.minExtraTime !== null) {
          const axis = p.timeRelaxation === 'deadline' ? 'deadline' : 'departure'
          expect(unlocksAt(c, loc.id, axis, p.minExtraTime), `${loc.id} time Δ (${axis})`).toBe(true)
          expect(unlocksAt(c, loc.id, axis, p.minExtraTime - 1), `${loc.id} time Δ−1 (${axis})`).toBe(false)
          expect(unlocksAt(c, loc.id, axis, p.minExtraTime + 45), `${loc.id} time Δ+45 (${axis})`).toBe(true)
        }
      }
    }
  })
})
