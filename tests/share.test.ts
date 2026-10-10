import { describe, expect, it } from 'vitest'
import { at } from '../src/data'
import { SIM_WINDOW_START_MS } from '../src/sim/clock'
import {
  buildShareUrl,
  decodeScenarioHash,
  encodeScenarioHash,
  sharedScenarioFromState,
} from '../src/state/share'
import { scenarioFromState } from '../src/state/scenarios'
import type { SavedScenario } from '../src/state/scenarios'

/**
 * Share-link invariants (upgrade spec): one serializer, two sinks — the
 * URL hash uses the SAME SavedScenario schema and validator as the
 * localStorage persistence. Round-trip must deep-equal including ₹
 * values; anything malformed degrades to null (defaults), never a crash.
 */

function aScenario(overrides: Partial<SavedScenario> = {}): SavedScenario {
  const base = scenarioFromState('Kochi weekend', {
    clockNowMs: at(14, 20),
    speedMultiplier: 4,
    originId: 'kozhikode',
    budgetINR: 2_120,
    availableHours: 18,
    selectedId: 'ooty',
  })
  expect(base).not.toBeNull()
  return { ...base!, ...overrides }
}

describe('share round-trip — snapshot → hash → parse deep-equals', () => {
  it('preserves every field including ₹ values', () => {
    const scenario = aScenario({ budgetINR: 2_120, clockNowMs: at(14, 20), selectedId: 'ooty' })
    const decoded = decodeScenarioHash(encodeScenarioHash(scenario))
    expect(decoded).toEqual(scenario)
    expect(decoded?.budgetINR).toBe(2_120)
    expect(decoded?.clockNowMs).toBe(at(14, 20))
  })

  it('accepts the hash with or without the leading #', () => {
    const encoded = encodeScenarioHash(aScenario())
    expect(decodeScenarioHash(encoded)).not.toBeNull()
    expect(decodeScenarioHash(`#${encoded}`)).not.toBeNull()
  })

  it('is URL-safe: no +, /, or = padding', () => {
    const encoded = encodeScenarioHash(aScenario({ selectedId: null }))
    expect(encoded.startsWith('s=')).toBe(true)
    const payload = encoded.slice(2)
    expect(payload).not.toMatch(/[+/=]/)
  })

  it('round-trips unicode names (₹, Devanagari, emoji)', () => {
    const scenario = aScenario({ name: '₹ weekend ₹२००० — 🚂' })
    expect(decodeScenarioHash(encodeScenarioHash(scenario))).toEqual(scenario)
  })

  it('buildShareUrl replaces any existing hash with the scenario hash', () => {
    const url = buildShareUrl('https://example.app/demo#s=oldjunk', aScenario())
    expect(url.startsWith('https://example.app/demo#s=')).toBe(true)
    expect(url).not.toContain('oldjunk')
    const decoded = decodeScenarioHash(`#${url.split('#')[1]}`)
    expect(decoded?.name).toBe('Kochi weekend')
  })
})

describe('malformed or stale hashes degrade silently to null', () => {
  it('rejects wrong prefixes, empty input, and junk', () => {
    expect(decodeScenarioHash('')).toBeNull()
    expect(decodeScenarioHash('#')).toBeNull()
    expect(decodeScenarioHash('x=abc')).toBeNull()
    expect(decodeScenarioHash('#x=abc')).toBeNull()
    expect(decodeScenarioHash('s=!!!not-base64!!!')).toBeNull()
    expect(decodeScenarioHash(`s=${btoa('plainly not json')}`)).toBeNull()
  })

  it('rejects structurally valid JSON that fails scenario validation', () => {
    const cases: unknown[] = [
      { name: 'no origin' },
      { name: 'unknown origin', clockNowMs: 0, speedMultiplier: 1, originId: 'mars', budgetINR: 100, availableHours: 4, selectedId: null },
      { name: 'bad budget', clockNowMs: 0, speedMultiplier: 1, originId: 'kozhikode', budgetINR: 'lots', availableHours: 4, selectedId: null },
    ]
    for (const raw of cases) {
      const encoded = encodeScenarioHash(raw as SavedScenario)
      expect(decodeScenarioHash(encoded), JSON.stringify(raw)).toBeNull()
    }
  })

  it('an unknown selection degrades to no selection instead of rejecting', () => {
    const raw = { name: 'stale selection', clockNowMs: at(12, 0), speedMultiplier: 1, originId: 'kozhikode', budgetINR: 2_000, availableHours: 24, selectedId: 'atlantis' }
    const decoded = decodeScenarioHash(encodeScenarioHash(raw as SavedScenario))
    expect(decoded).not.toBeNull()
    expect(decoded?.selectedId).toBeNull()
  })

  it('an invalid warp degrades to the default speed instead of rejecting', () => {
    // parseScenario defaults a non-positive speed to 1 — degradation, not
    // rejection; a shared link must never crash the loader.
    const raw = { name: 'bad speed', clockNowMs: 0, speedMultiplier: 0, originId: 'kozhikode', budgetINR: 100, availableHours: 4, selectedId: null }
    const decoded = decodeScenarioHash(encodeScenarioHash(raw as SavedScenario))
    expect(decoded).not.toBeNull()
    expect(decoded?.speedMultiplier).toBe(1)
  })

  it('a stale (out-of-window) clock clamps into the safe window instead of crashing', () => {
    const stale = aScenario({ clockNowMs: SIM_WINDOW_START_MS - 86_400_000 * 365 })
    const decoded = decodeScenarioHash(encodeScenarioHash(stale))
    expect(decoded).not.toBeNull()
    expect(decoded!.clockNowMs).toBe(SIM_WINDOW_START_MS)
  })

  it('rejects nameless and whitespace-only scenarios', () => {
    const encoded = encodeScenarioHash(aScenario({ name: '   ' }))
    expect(decodeScenarioHash(encoded)).toBeNull()
  })
})

describe('sharedScenarioFromState derives a self-identifying name', () => {
  it('names the scenario from origin and simulated clock', () => {
    const shared = sharedScenarioFromState({
      clockNowMs: at(9, 5),
      speedMultiplier: 1,
      originId: 'kozhikode',
      budgetINR: 2_000,
      availableHours: 24,
      selectedId: null,
    })
    expect(shared).not.toBeNull()
    expect(shared!.name).toContain('Kozhikode')
    expect(shared!.name).toContain('09:05')
    expect(shared!.budgetINR).toBe(2_000)
  })

  it('returns null for an unknown origin — no scenario, no crash', () => {
    const shared = sharedScenarioFromState({
      clockNowMs: at(9, 5),
      speedMultiplier: 1,
      originId: 'mars',
      budgetINR: 2_000,
      availableHours: 24,
      selectedId: null,
    })
    expect(shared).toBeNull()
  })

  it('keeps derived names within the scenario-name limit', () => {
    const shared = sharedScenarioFromState({
      clockNowMs: at(23, 59),
      speedMultiplier: 1,
      originId: 'kozhikode',
      budgetINR: 2_000,
      availableHours: 24,
      selectedId: null,
    })
    expect(shared!.name.length).toBeLessThanOrEqual(40)
  })
})
