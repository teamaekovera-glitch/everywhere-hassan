import { describe, expect, it } from 'vitest'
import { DEMO_DATA, at } from '../src/data'
import {
  computeReachability,
  DEFAULT_MIN_TRANSFER_MIN,
  makeDefaultConstraints,
  summarizeResults,
} from '../src/engine'
import { SIM_WINDOW_END_MS, SIM_WINDOW_START_MS } from '../src/sim/clock'
import { initSimState, simReducer, TIMELAPSE_WARP_SPEED } from '../src/state/store'
import type { SimState } from '../src/state/store'
import { STORY_CHAPTERS } from '../src/state/story'

/**
 * Story mode invariants (upgrade spec):
 * - The tour is a mode flag over the live sim — chapters apply the EXISTING
 *   store actions, and every chapter's end state reproduces the recorded
 *   demo-beat snapshot (engine-true counts, not prose).
 * - Any manual core input exits story mode cleanly into the live sim at
 *   that exact state.
 * - The unlock chapter applies the probe's relaxation live: the field
 *   blooms from 11 to 12 when +₹120 returns Ooty.
 */

const DEMO = {
  originId: 'kozhikode',
  budgetINR: 2_000,
  availableHours: 24,
}

/** The recorded snapshot each chapter must land on (id, now, ₹, h, selection). */
const RECORDED: ReadonlyArray<{
  id: string
  nowMs: number
  budgetINR: number
  availableHours: number
  selectedId: string | null
  reachableCount: number
  totalJourneys: number
}> = [
  { id: 'dawn', nowMs: at(6, 0), budgetINR: 2_000, availableHours: 24, selectedId: null, reachableCount: 15, totalJourneys: 23 },
  { id: 'noon', nowMs: at(12, 0), budgetINR: 2_000, availableHours: 24, selectedId: 'bengaluru', reachableCount: 11, totalJourneys: 20 },
  { id: 'reveal', nowMs: at(12, 0), budgetINR: 4_000, availableHours: 24, selectedId: 'ooty', reachableCount: 13, totalJourneys: 22 },
  { id: 'squeeze', nowMs: at(12, 0), budgetINR: 1_200, availableHours: 24, selectedId: 'bengaluru', reachableCount: 10, totalJourneys: 19 },
  { id: 'shortday', nowMs: at(12, 0), budgetINR: 2_000, availableHours: 12, selectedId: 'bengaluru', reachableCount: 10, totalJourneys: 19 },
  { id: 'expiry', nowMs: at(18, 25), budgetINR: 2_000, availableHours: 24, selectedId: null, reachableCount: 1, totalJourneys: 1 },
  { id: 'survivors', nowMs: at(19, 0), budgetINR: 2_000, availableHours: 24, selectedId: 'bengaluru', reachableCount: 1, totalJourneys: 1 },
  { id: 'unlock', nowMs: at(12, 30), budgetINR: 2_000, availableHours: 24, selectedId: 'ooty', reachableCount: 11, totalJourneys: 20 },
  { id: 'reverse', nowMs: at(6, 0), budgetINR: 2_000, availableHours: 24, selectedId: null, reachableCount: 15, totalJourneys: 23 },
  { id: 'home', nowMs: at(12, 0), budgetINR: 2_000, availableHours: 24, selectedId: null, reachableCount: 11, totalJourneys: 20 },
]

/** Walk the tour: storyStart lands on chapter 0, each storyStep advances. */
function walkTo(chapterIndex: number): SimState {
  let state = simReducer(initSimState(), { type: 'storyStart' })
  for (let i = 0; i < chapterIndex; i++) state = simReducer(state, { type: 'storyStep', delta: 1 })
  return state
}

function engineSummary(state: SimState) {
  // The probe preview is a lens over the constraints (spec): the engine
  // truth the UI shows folds it in without mutating the baseline.
  const constraints = {
    originId: state.originId,
    now: state.clock.nowMs,
    budgetINR: state.probePreview?.budgetINR ?? state.budgetINR,
    availableHours: state.probePreview?.availableHours ?? state.availableHours,
    minTransferMin: state.minTransferMin,
  }
  return summarizeResults(computeReachability(DEMO_DATA, constraints))
}

describe('story chapters — the ten recorded demo beats', () => {
  it('presents the required beats in demo order', () => {
    const ids = STORY_CHAPTERS.map((c) => c.id)
    // Required sequence (task mustHaves), as a subsequence.
    const required = ['dawn', 'noon', 'squeeze', 'expiry', 'survivors', 'unlock', 'reverse', 'home']
    let cursor = 0
    for (const id of required) {
      const at_ = ids.indexOf(id, cursor)
      expect(at_, `chapter '${id}' order`).toBeGreaterThanOrEqual(0)
      cursor = at_ + 1
    }
  })

  it.each(RECORDED.map((r, i) => [r.id, i, r] as const))(
    'chapter %s (#%i) lands on its recorded snapshot with engine-true counts',
    (_id, index, recorded) => {
      const state = walkTo(index)
      expect(state.story?.chapterIndex).toBe(index)
      expect(state.clock.nowMs).toBe(recorded.nowMs)
      expect(state.budgetINR).toBe(recorded.budgetINR)
      expect(state.availableHours).toBe(recorded.availableHours)
      expect(state.selectedId).toBe(recorded.selectedId)
      expect(state.originId).toBe(DEMO.originId)
      // Chapters pause ambient playback — snapshots hold still.
      expect(state.clock.playing).toBe(false)

      const summary = engineSummary(state)
      expect(summary.reachableCount).toBe(recorded.reachableCount)
      expect(summary.totalJourneys).toBe(recorded.totalJourneys)
    },
  )
})

describe('story chapters — beat-specific engine facts', () => {
  it('noon: Bengaluru is a ₹1,520 chain via Coimbatore', () => {
    const state = walkTo(1)
    const constraints = {
      originId: state.originId,
      now: state.clock.nowMs,
      budgetINR: state.budgetINR,
      availableHours: state.availableHours,
      minTransferMin: state.minTransferMin,
    }
    const blr = computeReachability(DEMO_DATA, constraints).find((r) => r.location.id === 'bengaluru')
    expect(blr?.reachable).toBe(true)
    expect(blr?.best?.costINR).toBe(1_520)
    expect(blr?.best?.legs.map((l) => l.to)).toContain('coimbatore')
  })

  it('expiry: Mangaluru ghosts and the field collapses to one survivor', () => {
    const state = walkTo(5)
    const constraints = {
      originId: state.originId,
      now: state.clock.nowMs,
      budgetINR: state.budgetINR,
      availableHours: state.availableHours,
      minTransferMin: state.minTransferMin,
    }
    const results = computeReachability(DEMO_DATA, constraints)
    const mgl = results.find((r) => r.location.id === 'mangaluru')
    expect(mgl?.reachable).toBe(false)
    expect(mgl?.journeys).toHaveLength(0)
    expect(summarizeResults(results).reachableCount).toBe(1)
  })

  it('survivors: Bengaluru rides the 20:30 overnight Volvo', () => {
    const state = walkTo(6)
    const constraints = {
      originId: state.originId,
      now: state.clock.nowMs,
      budgetINR: state.budgetINR,
      availableHours: state.availableHours,
      minTransferMin: state.minTransferMin,
    }
    const blr = computeReachability(DEMO_DATA, constraints).find((r) => r.location.id === 'bengaluru')
    expect(blr?.reachable).toBe(true)
    expect(blr?.best?.costINR).toBe(1_600)
    expect(blr?.best?.legs[0]?.connId).toBe('BUS-500-KZK-BLR')
  })
})

describe('the unlock chapter applies the probe relaxation live', () => {
  it('enters with Ooty ghosted, blooms to 12 reachable on +₹120', () => {
    const before = walkTo(7)
    const unlock = STORY_CHAPTERS[7]
    expect(unlock?.unlock).toBeDefined()
    expect(before.budgetINR).toBe(2_000)

    // Ghost state: at the enter snapshot Ooty is unreachable on budget.
    const beforeResults = computeReachability(DEMO_DATA, {
      originId: before.originId,
      now: before.clock.nowMs,
      budgetINR: before.budgetINR,
      availableHours: before.availableHours,
      minTransferMin: before.minTransferMin,
    })
    const ootyBefore = beforeResults.find((r) => r.location.id === 'ooty')
    expect(ootyBefore?.reachable).toBe(false)

    const after = simReducer(before, { type: 'storyUnlock' })
    expect(after.story?.unlockApplied).toBe(true)
    // The relaxation rides the probe panel's transient preview lens — the
    // baseline wallet stays ₹2,000; only the previewed constraint unlocks.
    expect(after.budgetINR).toBe(2_000)
    expect(after.probePreview?.budgetINR).toBe(2_120)
    expect(after.probePreview?.summary).toContain('₹120 more unlocks Ooty')

    const afterResults = computeReachability(DEMO_DATA, {
      originId: after.originId,
      now: after.clock.nowMs,
      budgetINR: after.probePreview?.budgetINR ?? after.budgetINR,
      availableHours: after.availableHours,
      minTransferMin: after.minTransferMin,
    })
    const ootyAfter = afterResults.find((r) => r.location.id === 'ooty')
    expect(ootyAfter?.reachable).toBe(true)
    expect(ootyAfter?.best?.costINR).toBe(2_120)
    const summary = summarizeResults(afterResults)
    expect(summary.reachableCount).toBe(12)
    expect(summary.totalJourneys).toBe(21)
  })

  it('storyUnlock is idempotent and a no-op on chapters without an unlock', () => {
    const state = walkTo(7)
    const once = simReducer(state, { type: 'storyUnlock' })
    const twice = simReducer(once, { type: 'storyUnlock' })
    expect(twice).toEqual(once)

    const dawn = walkTo(0)
    expect(simReducer(dawn, { type: 'storyUnlock' })).toEqual(dawn)
  })
})

describe('story mode is a mode flag, never a parallel world', () => {
  it('any manual core input exits story mode into the live sim at that state', () => {
    const manual: Parameters<typeof simReducer>[1][] = [
      { type: 'setBudget', inr: 3_000 },
      { type: 'select', id: 'kannur' },
      { type: 'setNow', ms: at(15, 45) },
      { type: 'setSpeed', multiplier: 4 },
      { type: 'reset' },
    ]
    for (const action of manual) {
      const inStory = walkTo(2)
      expect(inStory.story).not.toBeNull()
      const after = simReducer(inStory, action)
      expect(after.story, `manual ${action.type} exits story mode`).toBeNull()
    }
  })

  it('manual input keeps the state the interaction landed on', () => {
    const state = simReducer(walkTo(3), { type: 'setBudget', inr: 5_000 })
    expect(state.budgetINR).toBe(5_000)
    expect(state.clock.nowMs).toBe(at(12, 0))
    expect(state.selectedId).toBe('bengaluru')
  })

  it('storyStop keeps the sim exactly where the story left it', () => {
    const inStory = walkTo(6)
    const stopped = simReducer(inStory, { type: 'storyStop' })
    expect(stopped.story).toBeNull()
    expect(stopped.clock.nowMs).toBe(inStory.clock.nowMs)
    expect(stopped.budgetINR).toBe(inStory.budgetINR)
    expect(stopped.availableHours).toBe(inStory.availableHours)
    expect(stopped.selectedId).toBe(inStory.selectedId)
  })

  it('ambient ticks do not exit story mode; paused chapters do not advance', () => {
    const inStory = walkTo(1)
    const ticked = simReducer(inStory, { type: 'tick', dtMs: 1_000 })
    expect(ticked.story?.chapterIndex).toBe(1)
    expect(ticked.clock.nowMs).toBe(at(12, 0)) // paused — the snapshot holds
  })

  it('pause/resume toggles the driver without touching the sim', () => {
    const inStory = walkTo(0)
    const paused = simReducer(inStory, { type: 'storyToggle' })
    expect(paused.story?.playing).toBe(false)
    expect(paused.clock.nowMs).toBe(inStory.clock.nowMs)
    const resumed = simReducer(paused, { type: 'storyToggle' })
    expect(resumed.story?.playing).toBe(true)
  })

  it('stepping past the final chapter ends the story at the live sim', () => {
    const last = walkTo(STORY_CHAPTERS.length - 1)
    expect(last.story?.chapterIndex).toBe(STORY_CHAPTERS.length - 1)
    const ended = simReducer(last, { type: 'storyStep', delta: 1 })
    expect(ended.story).toBeNull()
    // The live sim remains at the final chapter's state.
    expect(ended.clock.nowMs).toBe(at(12, 0))
  })

  it('stepping backwards re-applies the earlier chapter exactly', () => {
    const atUnlock = walkTo(7)
    const back = simReducer(atUnlock, { type: 'storyStep', delta: -1 })
    expect(back.clock.nowMs).toBe(at(19, 0)) // survivors chapter again
    expect(back.selectedId).toBe('bengaluru')
  })
})

describe('full-day time-lapse', () => {
  it('starts at the window start in warp, remembering the previous speed', () => {
    const warped = simReducer(initSimState(), { type: 'timelapseStart' })
    expect(warped.timelapse).toEqual({ prevSpeedMultiplier: 1 })
    expect(warped.clock.nowMs).toBe(SIM_WINDOW_START_MS)
    expect(warped.clock.playing).toBe(true)
    expect(warped.clock.speedMultiplier).toBe(TIMELAPSE_WARP_SPEED)
  })

  it('replaces story mode and vice versa', () => {
    const inStory = walkTo(3)
    const warped = simReducer(inStory, { type: 'timelapseStart' })
    expect(warped.story).toBeNull()
    expect(warped.timelapse).not.toBeNull()
    const storied = simReducer(warped, { type: 'storyStart' })
    expect(storied.timelapse).toBeNull()
    expect(storied.story).not.toBeNull()
  })

  it('ends itself at the window edge, restoring the warp the user had', () => {
    let state = simReducer(initSimState(), { type: 'timelapseStart' })
    // Drive the clock to the very end of the window at warp speed.
    let guard = 0
    while (state.timelapse && state.clock.nowMs < SIM_WINDOW_END_MS && guard < 10_000) {
      state = simReducer(state, { type: 'tick', dtMs: 250 })
      guard += 1
    }
    expect(state.timelapse).toBeNull()
    expect(state.clock.playing).toBe(false)
    expect(state.clock.speedMultiplier).toBe(1)
    expect(state.clock.nowMs).toBe(SIM_WINDOW_END_MS)
  })

  it('manual input exits the time-lapse and restores the previous speed', () => {
    const warped = simReducer(initSimState(), { type: 'timelapseStart' })
    const exited = simReducer(warped, { type: 'setNow', ms: at(14, 0) })
    expect(exited.timelapse).toBeNull()
    expect(exited.clock.speedMultiplier).toBe(1)
    expect(exited.clock.nowMs).toBe(at(14, 0))
    expect(exited.clock.playing).toBe(false)
  })
})

describe('the tour never leaves the offline invariant behind', () => {
  it('chapters are plain store actions — no engine calls, no new machinery', () => {
    for (const chapter of STORY_CHAPTERS) {
      for (const action of [...chapter.enter, ...(chapter.unlock ?? [])]) {
        // `applyProbePreview` is a plain lens action — no engine call, no
        // saved-state mutation, so it stays inside the offline invariant.
        expect(['pause', 'setNow', 'setOrigin', 'setBudget', 'setAvailableHours', 'select', 'applyProbePreview']).toContain(
          action.type,
        )
      }
    }
  })
})

describe('default constraints remain untouched by the story module', () => {
  it('chapter defaults equal the engine defaults', () => {
    expect(DEMO.budgetINR).toBe(makeDefaultConstraints().budgetINR)
    expect(DEMO.availableHours).toBe(makeDefaultConstraints().availableHours)
    expect(initSimState().minTransferMin).toBe(DEFAULT_MIN_TRANSFER_MIN)
  })
})
