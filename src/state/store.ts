import { useEffect, useMemo, useReducer } from 'react'
import type { Dispatch } from 'react'
import { DEMO_DATA } from '../data'
import {
  clampAvailableHours,
  clampBudgetINR,
  computeReachability,
  DEFAULT_AVAILABLE_HOURS,
  DEFAULT_BUDGET_INR,
  DEFAULT_MIN_TRANSFER_MIN,
  DEFAULT_ORIGIN_ID,
  summarizeResults,
} from '../engine'
import type { Constraints, DestinationResult, ReachabilitySummary } from '../engine'
import { SIM_WINDOW_END_MS, clampToSimWindow, makeSimClockState, stepClock } from '../sim/clock'
import type { SimClockState } from '../sim/clock'
import { loadScenarios, parseScenario, persistScenarios, scenarioFromState, upsertByName } from './scenarios'
import type { SavedScenario } from './scenarios'

/**
 * The one store (spec): constraints, the deterministic clock, and selection.
 * Every downstream surface — field, timeline, stats, alerts, details — reads
 * the same engine snapshot; no panel computes its own truth.
 */

/** Clock granularity for scrubbing and playback: the engine stays honest —
 * departures flip at the exact snapped crossing, and snapping keeps the
 * scrubber stable under pointer jitter. */
const SNAP_MS = 15_000

export function snapToStep(ms: number): number {
  return Math.round(ms / SNAP_MS) * SNAP_MS
}

export interface SimState {
  clock: SimClockState
  originId: string
  budgetINR: number
  availableHours: number
  minTransferMin: number
  selectedId: string | null
  scenarios: SavedScenario[]
}

export type SimAction =
  | { type: 'tick'; dtMs: number }
  | { type: 'setNow'; ms: number }
  | { type: 'step'; minutes: number }
  | { type: 'togglePlay' }
  | { type: 'setSpeed'; multiplier: number }
  | { type: 'setOrigin'; id: string }
  | { type: 'setBudget'; inr: number }
  | { type: 'setAvailableHours'; hours: number }
  | { type: 'select'; id: string | null }
  | { type: 'saveScenario'; name: string }
  | { type: 'loadScenario'; name: string }
  | { type: 'deleteScenario'; name: string }
  | { type: 'reset' }

export function initSimState(): SimState {
  return {
    clock: makeSimClockState(),
    originId: DEFAULT_ORIGIN_ID,
    budgetINR: DEFAULT_BUDGET_INR,
    availableHours: DEFAULT_AVAILABLE_HOURS,
    minTransferMin: DEFAULT_MIN_TRANSFER_MIN,
    selectedId: null,
    scenarios: loadScenarios(),
  }
}

export function simReducer(state: SimState, action: SimAction): SimState {
  switch (action.type) {
    case 'tick': {
      if (!state.clock.playing) return state
      const nowMs = clampToSimWindow(state.clock.nowMs + action.dtMs * state.clock.speedMultiplier)
      const endReached = nowMs >= SIM_WINDOW_END_MS
      return {
        ...state,
        clock: { ...state.clock, nowMs, playing: endReached ? false : state.clock.playing },
      }
    }
    case 'setNow':
      return { ...state, clock: { ...state.clock, nowMs: clampToSimWindow(snapToStep(action.ms)) } }
    case 'step':
      return { ...state, clock: { ...state.clock, nowMs: stepClock(state.clock.nowMs, action.minutes) } }
    case 'togglePlay':
      return { ...state, clock: { ...state.clock, playing: !state.clock.playing } }
    case 'setSpeed':
      return { ...state, clock: { ...state.clock, speedMultiplier: action.multiplier } }
    case 'setOrigin': {
      // Origins come from the bundled dataset only — an unknown id is a
      // caller bug, not a state change.
      if (!DEMO_DATA.locationById.has(action.id)) return state
      return {
        ...state,
        originId: action.id,
        // A selection equal to the new origin is meaningless — drop it.
        selectedId: state.selectedId === action.id ? null : state.selectedId,
      }
    }
    case 'setBudget':
      return { ...state, budgetINR: clampBudgetINR(action.inr) }
    case 'setAvailableHours':
      return { ...state, availableHours: clampAvailableHours(action.hours) }
    case 'select':
      return { ...state, selectedId: action.id }
    case 'saveScenario': {
      const scenario = scenarioFromState(action.name, {
        clockNowMs: state.clock.nowMs,
        speedMultiplier: state.clock.speedMultiplier,
        originId: state.originId,
        budgetINR: state.budgetINR,
        availableHours: state.availableHours,
        selectedId: state.selectedId,
      })
      // Empty or oversized name → nothing to save; scenarioFromState said no.
      if (!scenario) return state
      const scenarios = upsertByName(state.scenarios, scenario)
      persistScenarios(scenarios)
      return { ...state, scenarios }
    }
    case 'loadScenario': {
      const scenario = state.scenarios.find((s) => s.name === action.name)
      if (!scenario) return state
      // Re-validate on restore — the store never trusts non-engine-owned
      // state for engine inputs.
      const parsed = parseScenario(scenario)
      if (!parsed || !DEMO_DATA.locationById.has(parsed.originId)) return state
      return {
        ...state,
        // Constraints, clock position and selection restore together (spec);
        // playback pauses so the restored state is actually readable.
        clock: {
          nowMs: parsed.clockNowMs,
          playing: false,
          speedMultiplier: parsed.speedMultiplier,
        },
        originId: parsed.originId,
        budgetINR: parsed.budgetINR,
        availableHours: parsed.availableHours,
        selectedId: parsed.selectedId,
      }
    }
    case 'deleteScenario': {
      const scenarios = state.scenarios.filter((s) => s.name !== action.name)
      if (scenarios.length === state.scenarios.length) return state
      persistScenarios(scenarios)
      return { ...state, scenarios }
    }
    case 'reset':
      // Scenarios live in localStorage and survive a demo reset — the fresh
      // init re-reads them from storage so the list stays put.
      return initSimState()
  }
}

export interface Simulation {
  clock: SimClockState
  constraints: Constraints
  results: DestinationResult[]
  summary: ReachabilitySummary
  selectedId: string | null
  scenarios: SavedScenario[]
  dispatch: Dispatch<SimAction>
}

/**
 * The wired recompute pipeline. On every clock or constraint change the
 * engine recomputes from scratch with departures ≥ now — there is no cache,
 * so scrubbing backwards restores the earlier state exactly by construction.
 */
export function useSimulation(): Simulation {
  const [state, dispatch] = useReducer(simReducer, undefined, initSimState)

  // Playback advances the simulated clock by warp × elapsed real time.
  // Wall time only measures the delta between frames; the clock itself
  // remains an explicit engine parameter.
  useEffect(() => {
    if (!state.clock.playing) return
    let raf = 0
    let last = performance.now()
    const frame = (ts: number) => {
      const dt = Math.min(250, ts - last)
      last = ts
      dispatch({ type: 'tick', dtMs: dt })
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [state.clock.playing])

  const constraints = useMemo<Constraints>(
    () => ({
      originId: state.originId,
      now: state.clock.nowMs,
      availableHours: state.availableHours,
      budgetINR: state.budgetINR,
      minTransferMin: state.minTransferMin,
    }),
    [state.originId, state.clock.nowMs, state.availableHours, state.budgetINR, state.minTransferMin],
  )

  const results = useMemo(() => computeReachability(DEMO_DATA, constraints), [constraints])
  const summary = useMemo(() => summarizeResults(results), [results])

  return {
    clock: state.clock,
    constraints,
    results,
    summary,
    selectedId: state.selectedId,
    scenarios: state.scenarios,
    dispatch,
  }
}
