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
import { SIM_WINDOW_END_MS, SIM_WINDOW_START_MS, clampToSimWindow, makeSimClockState, stepClock } from '../sim/clock'
import type { SimClockState } from '../sim/clock'
import { loadScenarios, parseScenario, persistScenarios, scenarioFromState, upsertByName } from './scenarios'
import type { SavedScenario } from './scenarios'
import { STORY_CHAPTERS } from './story'

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
  /**
   * The unlock probe's transient preview (upgrade spec): constraint overrides
   * folded into the recompute so the field blooms without mutating any saved
   * state. Scenarios save the baseline fields, never this lens.
   */
  probePreview: ProbePreview | null
  /** Story mode (spec): a mode flag over the live sim, never a parallel world. */
  story: StoryRuntime | null
  /** Full-day time-lapse (spec): warp playback with a timestamp overlay. */
  timelapse: TimelapseRuntime | null
}

/** Where the story's playhead is. The sim state itself is the tour's state. */
export interface StoryRuntime {
  chapterIndex: number
  playing: boolean
  /** The unlock chapter shows the ghost first, then applies the unlock. */
  unlockApplied: boolean
}

export interface TimelapseRuntime {
  /** The warp select restores this on exit — time-lapse speed is its own. */
  prevSpeedMultiplier: number
}

export type SimCoreAction =
  | { type: 'tick'; dtMs: number }
  | { type: 'setNow'; ms: number }
  | { type: 'step'; minutes: number }
  | { type: 'togglePlay' }
  | { type: 'pause' }
  | { type: 'setSpeed'; multiplier: number }
  | { type: 'setOrigin'; id: string }
  | { type: 'setBudget'; inr: number }
  | { type: 'setAvailableHours'; hours: number }
  | { type: 'select'; id: string | null }
  | { type: 'applyProbePreview'; preview: ProbePreview }
  | { type: 'clearProbePreview' }
  | { type: 'saveScenario'; name: string }
  | { type: 'loadScenario'; name: string }
  | { type: 'loadShared'; scenario: SavedScenario }
  | { type: 'deleteScenario'; name: string }
  | { type: 'reset' }

export type SimAction =
  | SimCoreAction
  | { type: 'storyStart' }
  | { type: 'storyStop' }
  | { type: 'storyStep'; delta: 1 | -1 }
  | { type: 'storyToggle' }
  | { type: 'storyUnlock' }
  | { type: 'timelapseStart' }
  | { type: 'timelapseStop' }

export function initSimState(): SimState {
  return {
    clock: makeSimClockState(),
    originId: DEFAULT_ORIGIN_ID,
    budgetINR: DEFAULT_BUDGET_INR,
    availableHours: DEFAULT_AVAILABLE_HOURS,
    minTransferMin: DEFAULT_MIN_TRANSFER_MIN,
    selectedId: null,
    scenarios: loadScenarios(),
    probePreview: null,
    story: null,
    timelapse: null,
  }
}

/** Manual interactions exit the probe preview cleanly back to the live sim. */
function exitPreview(state: SimState): SimState {
  return state.probePreview === null ? state : { ...state, probePreview: null }
}

/**
 * Time-lapse warp (spec): high enough that the full 06:00 → 06:00 (+1d)
 * window plays in ~24 real seconds, reusing the plain tick pipeline —
 * no new engine calls.
 */
export const TIMELAPSE_WARP_SPEED = 60

/** Core actions that come from a user's hand — any of them leaves story
 * or time-lapse mode and lands in the live sim at that exact state.
 * `tick` is ambient playback, not a hand. */
const MANUAL_CORE_ACTIONS: ReadonlySet<SimCoreAction['type']> = new Set([
  'setNow',
  'step',
  'togglePlay',
  'pause',
  'setSpeed',
  'setOrigin',
  'setBudget',
  'setAvailableHours',
  'select',
  'saveScenario',
  'loadScenario',
  'loadShared',
  'deleteScenario',
  'reset',
])

/** Fold a chapter's snapshot actions through the core reducer, in order. */
function applyCoreActions(state: SimState, actions: readonly SimCoreAction[]): SimState {
  let next = state
  for (const core of actions) next = coreReducer(next, core)
  return next
}

/** Restore a parsed scenario: constraints, clock position and selection
 * together (spec); playback pauses so the restored state is readable. */
function restoreScenario(state: SimState, parsed: SavedScenario): SimState {
  return {
    ...state,
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

function isManualCoreAction(action: SimAction): action is SimCoreAction {
  // `tick` is ambient playback, not a hand — it rides along in any mode.
  return action.type !== 'tick' && MANUAL_CORE_ACTIONS.has(action.type as SimCoreAction['type'])
}

/**
 * The one reducer (spec). Mode actions drive story mode and the time-lapse;
 * any manual core action exits those modes cleanly into the live sim at
 * that exact state — the modes are flags, never a parallel world.
 */
export function simReducer(state: SimState, action: SimAction): SimState {
  if (state.story !== null || state.timelapse !== null) {
    if (action.type === 'tick') return coreReducer(state, action)
    if (isManualCoreAction(action)) {
      // Manual input: drop both modes, apply the action as-is. A
      // time-lapse in flight hands the speed back and pauses so the state
      // the user grabbed stays readable.
      const base = state.timelapse
        ? {
            ...state,
            story: null,
            timelapse: null,
            clock: { ...state.clock, playing: false, speedMultiplier: state.timelapse.prevSpeedMultiplier },
          }
        : { ...state, story: null, timelapse: null }
      return coreReducer(base, action)
    }
  }

  switch (action.type) {
    case 'storyStart': {
      const started = applyCoreActions({ ...state, timelapse: null }, STORY_CHAPTERS[0].enter)
      return { ...started, story: { chapterIndex: 0, playing: true, unlockApplied: false } }
    }
    case 'storyStop':
      // Exit keeps the sim exactly where the story left it (spec).
      return { ...state, story: null }
    case 'storyToggle': {
      if (!state.story) return state
      return { ...state, story: { ...state.story, playing: !state.story.playing } }
    }
    case 'storyStep': {
      if (!state.story) return state
      const nextIndex = state.story.chapterIndex + action.delta
      // Past the final chapter the story simply ends — the live sim remains.
      if (nextIndex >= STORY_CHAPTERS.length) return { ...state, story: null }
      const index = Math.max(0, nextIndex)
      const applied = applyCoreActions(state, STORY_CHAPTERS[index].enter)
      return { ...applied, story: { chapterIndex: index, playing: state.story.playing, unlockApplied: false } }
    }
    case 'storyUnlock': {
      const runtime = state.story
      if (!runtime) return state
      const chapter = STORY_CHAPTERS[runtime.chapterIndex]
      if (!chapter.unlock || runtime.unlockApplied) return state
      const applied = applyCoreActions(state, chapter.unlock)
      return { ...applied, story: { ...runtime, unlockApplied: true } }
    }
    case 'timelapseStart':
      return {
        ...state,
        story: null,
        timelapse: { prevSpeedMultiplier: state.clock.speedMultiplier },
        clock: { nowMs: SIM_WINDOW_START_MS, playing: true, speedMultiplier: TIMELAPSE_WARP_SPEED },
      }
    case 'timelapseStop':
      if (!state.timelapse) return state
      return {
        ...state,
        timelapse: null,
        clock: { ...state.clock, playing: false, speedMultiplier: state.timelapse.prevSpeedMultiplier },
      }
    default:
      return coreReducer(state, action)
  }
}

/**
 * The core sim reducer — constraints, the deterministic clock, selection,
 * scenarios. Pure over SimState; mode actions fold chapters through it.
 */
function coreReducer(state: SimState, action: SimCoreAction): SimState {
  switch (action.type) {
    case 'tick': {
      if (!state.clock.playing) return state
      const nowMs = clampToSimWindow(state.clock.nowMs + action.dtMs * state.clock.speedMultiplier)
      const endReached = nowMs >= SIM_WINDOW_END_MS
      if (!endReached) return { ...state, clock: { ...state.clock, nowMs } }
      // Time-lapse ends itself at the window edge and restores the warp
      // the user had before pressing play.
      if (state.timelapse) {
        return exitPreview({
          ...state,
          timelapse: null,
          clock: { ...state.clock, nowMs, playing: false, speedMultiplier: state.timelapse.prevSpeedMultiplier },
        })
      }
      return exitPreview({ ...state, clock: { ...state.clock, nowMs, playing: false } })
    }
    case 'pause':
      return { ...state, clock: { ...state.clock, playing: false } }
    case 'setNow':
      return exitPreview({
        ...state,
        clock: { ...state.clock, nowMs: clampToSimWindow(snapToStep(action.ms)) },
      })
    case 'step':
      return exitPreview({
        ...state,
        clock: { ...state.clock, nowMs: stepClock(state.clock.nowMs, action.minutes) },
      })
    case 'togglePlay':
      return exitPreview({ ...state, clock: { ...state.clock, playing: !state.clock.playing } })
    case 'setSpeed':
      return exitPreview({ ...state, clock: { ...state.clock, speedMultiplier: action.multiplier } })
    case 'setOrigin': {
      // Origins come from the bundled dataset only — an unknown id is a
      // caller bug, not a state change.
      if (!DEMO_DATA.locationById.has(action.id)) return state
      return exitPreview({
        ...state,
        originId: action.id,
        // A selection equal to the new origin is meaningless — drop it.
        selectedId: state.selectedId === action.id ? null : state.selectedId,
      })
    }
    case 'setBudget':
      return exitPreview({ ...state, budgetINR: clampBudgetINR(action.inr) })
    case 'setAvailableHours':
      return exitPreview({ ...state, availableHours: clampAvailableHours(action.hours) })
    case 'select':
      return exitPreview({ ...state, selectedId: action.id })
    case 'applyProbePreview':
      return { ...state, probePreview: action.preview }
    case 'clearProbePreview':
      return state.probePreview === null ? state : { ...state, probePreview: null }
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
      // Constraints, clock position and selection restore together (spec);
      // playback pauses so the restored state is actually readable.
      return exitPreview(restoreScenario(state, parsed))
    }
    case 'loadShared': {
      // A link is untrusted input like any other: the same strict parse
      // runs again before anything restores (defense in depth).
      const parsed = parseScenario(action.scenario)
      if (!parsed) return state
      return exitPreview(restoreScenario(state, parsed))
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
  probePreview: ProbePreview | null
  story: StoryRuntime | null
  timelapse: TimelapseRuntime | null
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
      // The probe preview's overrides fold in here — the whole field
      // recomputes from the relaxed snapshot while the lens is active.
      now: state.probePreview?.nowMs ?? state.clock.nowMs,
      availableHours: state.probePreview?.availableHours ?? state.availableHours,
      budgetINR: state.probePreview?.budgetINR ?? state.budgetINR,
      minTransferMin: state.minTransferMin,
    }),
    [
      state.originId,
      state.clock.nowMs,
      state.availableHours,
      state.budgetINR,
      state.minTransferMin,
      state.probePreview,
    ],
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
    probePreview: state.probePreview,
    story: state.story,
    timelapse: state.timelapse,
    dispatch,
  }
}
