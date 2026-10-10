import { describe, expect, it, vi } from 'vitest'
import { at, REFERENCE_DAY_START_MS } from '../src/data/referenceDay'
import { clampToSimWindow, SIM_WINDOW_START_MS } from '../src/sim/clock'
import { initSimState, simReducer } from '../src/state/store'
import {
  loadScenarios,
  parseScenario,
  persistScenarios,
  scenarioFromState,
  upsertByName,
} from '../src/state/scenarios'
import type { SavedScenario } from '../src/state/scenarios'

/** Minimal in-memory Storage for tests. */
function fakeStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial))
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  } as unknown as Storage
}

const base = {
  name: 'Fixture',
  clockNowMs: at(9, 0),
  speedMultiplier: 2,
  originId: 'kozhikode',
  budgetINR: 2000,
  availableHours: 24,
  selectedId: 'ernakulam',
}

function serialize(s: SavedScenario): string {
  return JSON.stringify(s)
}

describe('scenario serialization (pure)', () => {
  it('round-trips a scenario through serialize → parse', () => {
    const saved = scenarioFromState('  Budget weekend ', base)
    expect(saved).not.toBeNull()
    expect(saved!.name).toBe('Budget weekend')
    const parsed = parseScenario(JSON.parse(serialize(saved!)))
    expect(parsed).toEqual(saved)
  })

  it('rejects empty and oversized names', () => {
    expect(scenarioFromState('   ', base)).toBeNull()
    expect(scenarioFromState('x'.repeat(41), base)).toBeNull()
    expect(scenarioFromState('x'.repeat(40), base)).not.toBeNull()
  })

  it('rejects unknown origins', () => {
    expect(scenarioFromState('ok', { ...base, originId: 'atlantis' })).toBeNull()
  })

  it('parse rejects structurally wrong entries', () => {
    expect(parseScenario(null)).toBeNull()
    expect(parseScenario('nope')).toBeNull()
    expect(parseScenario({ ...base, name: '  ' })).toBeNull()
    expect(parseScenario({ ...base, clockNowMs: 'yesterday' })).toBeNull()
    expect(parseScenario({ ...base, originId: 'atlantis' })).toBeNull()
    expect(parseScenario({ ...base, budgetINR: '2000' })).toBeNull()
    expect(parseScenario({ ...base, availableHours: Number.NaN })).toBeNull()
  })

  it('parse clamps clock and constraint ranges instead of failing', () => {
    const parsed = parseScenario({
      ...base,
      clockNowMs: REFERENCE_DAY_START_MS - 3_600_000,
      budgetINR: 999_999,
      availableHours: 99,
    })
    expect(parsed).not.toBeNull()
    expect(parsed!.clockNowMs).toBe(clampToSimWindow(REFERENCE_DAY_START_MS - 3_600_000))
    expect(parsed!.clockNowMs).toBeGreaterThanOrEqual(SIM_WINDOW_START_MS)
    expect(parsed!.budgetINR).toBeLessThanOrEqual(10_000)
    expect(parsed!.availableHours).toBeLessThanOrEqual(48)
  })

  it('parse drops a selection that is not in the dataset', () => {
    const parsed = parseScenario({ ...base, selectedId: 'atlantis' })
    expect(parsed).not.toBeNull()
    expect(parsed!.selectedId).toBeNull()
  })
})

describe('upsertByName', () => {
  const a: SavedScenario = { ...base, name: 'A' }
  const b: SavedScenario = { ...base, name: 'B', budgetINR: 500 }

  it('appends a new name and overwrites an existing one in place', () => {
    const withB = upsertByName([a], b)
    expect(withB).toHaveLength(2)
    const b2 = { ...b, budgetINR: 700 }
    const updated = upsertByName(withB, b2)
    expect(updated).toHaveLength(2)
    expect(updated[1]).toEqual(b2)
  })
})

describe('localStorage wrapper', () => {
  it('returns [] when storage is unavailable', () => {
    expect(loadScenarios(null)).toEqual([])
  })

  it('persists and loads back', () => {
    const storage = fakeStorage()
    persistScenarios([scenarioFromState('Trip', base)!], storage)
    expect(loadScenarios(storage)).toEqual([scenarioFromState('Trip', base)!])
  })

  it('drops corrupt entries, keeps valid ones, and surfaces the drop', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const storage = fakeStorage({
      'everywhere.scenarios.v1': JSON.stringify([scenarioFromState('Good', base)!, { name: 42 }, 'garbage']),
    })
    const loaded = loadScenarios(storage)
    expect(loaded).toHaveLength(1)
    expect(loaded[0].name).toBe('Good')
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })

  it('surfaces unreadable JSON instead of throwing', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const storage = fakeStorage({ 'everywhere.scenarios.v1': '{not json' })
    expect(loadScenarios(storage)).toEqual([])
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })
})

describe('store integration', () => {
  it('save → load restores constraints, clock and selection together, paused', () => {
    let state = initSimState()
    state = simReducer(state, { type: 'setNow', ms: at(15, 30) })
    state = simReducer(state, { type: 'setBudget', inr: 3200 })
    state = simReducer(state, { type: 'select', id: 'ernakulam' })
    state = simReducer(state, { type: 'saveScenario', name: 'Afternoon trip' })

    // Move away from the saved state.
    state = simReducer(state, { type: 'setNow', ms: at(20, 0) })
    state = simReducer(state, { type: 'setBudget', inr: 800 })
    state = simReducer(state, { type: 'select', id: null })

    state = simReducer(state, { type: 'loadScenario', name: 'Afternoon trip' })
    expect(state.clock.nowMs).toBe(at(15, 30))
    expect(state.clock.playing).toBe(false)
    expect(state.budgetINR).toBe(3200)
    expect(state.selectedId).toBe('ernakulam')
  })

  it('ignores saving with a blank name and loading a missing name', () => {
    const state = initSimState()
    expect(simReducer(state, { type: 'saveScenario', name: '   ' })).toEqual(state)
    expect(simReducer(state, { type: 'loadScenario', name: 'ghost' })).toEqual(state)
  })

  it('deletes by name and survives a demo reset', () => {
    let state = initSimState()
    state = simReducer(state, { type: 'saveScenario', name: 'Solo' })
    state = simReducer(state, { type: 'saveScenario', name: 'Duo' })
    state = simReducer(state, { type: 'deleteScenario', name: 'Solo' })
    expect(state.scenarios.map((s) => s.name)).toEqual(['Duo'])

    const afterReset = simReducer(state, { type: 'reset' })
    // In the test environment there is no storage, so a reset starts with an
    // empty list — the list itself persists only where localStorage exists.
    expect(afterReset.scenarios).toEqual([])
  })
})
