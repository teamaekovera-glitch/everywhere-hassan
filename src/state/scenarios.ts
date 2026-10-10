import { DEMO_DATA } from '../data'
import { clampAvailableHours, clampBudgetINR } from '../engine'
import { clampToSimWindow } from '../sim/clock'

/**
 * Named scenarios (spec): a saved scenario restores constraints, clock
 * position, and selection together. Serialization and validation are pure —
 * only the thin storage wrapper at the bottom touches localStorage, and it
 * surfaces (never swallows) read/write failures via console.error while
 * keeping the app booting offline.
 */

export interface SavedScenario {
  /** Scenario identity is its trimmed name — saving again overwrites. */
  name: string
  clockNowMs: number
  speedMultiplier: number
  originId: string
  budgetINR: number
  availableHours: number
  selectedId: string | null
}

export const SCENARIO_NAME_MAX = 40

export interface ScenarioSource {
  clockNowMs: number
  speedMultiplier: number
  originId: string
  budgetINR: number
  availableHours: number
  selectedId: string | null
}

/** Snapshot the current state under a (trimmed, non-empty) name. */
export function scenarioFromState(name: string, s: ScenarioSource): SavedScenario | null {
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > SCENARIO_NAME_MAX) return null
  if (!DEMO_DATA.locationById.has(s.originId)) return null
  return {
    name: trimmed,
    clockNowMs: s.clockNowMs,
    speedMultiplier: s.speedMultiplier,
    originId: s.originId,
    budgetINR: s.budgetINR,
    availableHours: s.availableHours,
    selectedId: s.selectedId,
  }
}

/**
 * Parse one stored scenario. Returns null for anything structurally wrong
 * (a corrupt entry is dropped, not fatal); numeric fields are clamped back
 * into their honest ranges so an old or edited entry can never push the
 * engine outside the slider bounds or the simulation window.
 */
export function parseScenario(raw: unknown): SavedScenario | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>

  const name = typeof r.name === 'string' ? r.name.trim() : ''
  if (!name || name.length > SCENARIO_NAME_MAX) return null

  const clockNowMs = typeof r.clockNowMs === 'number' && Number.isFinite(r.clockNowMs) ? r.clockNowMs : null
  if (clockNowMs === null) return null

  const speedMultiplier =
    typeof r.speedMultiplier === 'number' && Number.isFinite(r.speedMultiplier) && r.speedMultiplier > 0
      ? r.speedMultiplier
      : 1

  if (typeof r.originId !== 'string' || !DEMO_DATA.locationById.has(r.originId)) return null
  if (typeof r.budgetINR !== 'number' || !Number.isFinite(r.budgetINR)) return null
  if (typeof r.availableHours !== 'number' || !Number.isFinite(r.availableHours)) return null

  const selectedId =
    typeof r.selectedId === 'string' && DEMO_DATA.locationById.has(r.selectedId) ? r.selectedId : null

  return {
    name,
    clockNowMs: clampToSimWindow(clockNowMs),
    speedMultiplier,
    originId: r.originId,
    budgetINR: clampBudgetINR(r.budgetINR),
    availableHours: clampAvailableHours(r.availableHours),
    selectedId,
  }
}

/** Upsert by name — saving an existing name overwrites it, order preserved. */
export function upsertByName(scenarios: SavedScenario[], scenario: SavedScenario): SavedScenario[] {
  const existing = scenarios.findIndex((s) => s.name === scenario.name)
  if (existing === -1) return [...scenarios, scenario]
  return scenarios.map((s, i) => (i === existing ? scenario : s))
}

const STORAGE_KEY = 'everywhere.scenarios.v1'

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch (err) {
    console.error('everywhere: localStorage is unavailable', err)
    return null
  }
}

export function loadScenarios(storage: Storage | null = safeLocalStorage()): SavedScenario[] {
  if (!storage) return []
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) throw new TypeError('saved scenario store is not an array')
    const kept: SavedScenario[] = []
    let dropped = 0
    for (const item of parsed) {
      const scenario = parseScenario(item)
      if (scenario) kept.push(scenario)
      else dropped += 1
    }
    if (dropped > 0) console.error(`everywhere: dropped ${dropped} corrupt saved scenario(s)`)
    return kept
  } catch (err) {
    console.error('everywhere: could not read saved scenarios', err)
    return []
  }
}

export function persistScenarios(scenarios: SavedScenario[], storage: Storage | null = safeLocalStorage()): void {
  if (!storage) return
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(scenarios))
  } catch (err) {
    console.error('everywhere: could not save scenarios', err)
  }
}
