import { describe, expect, it } from 'vitest'
import { at } from '../src/data'
import { scenarioFromState } from '../src/state/scenarios'
import type { ScenarioSource } from '../src/state/scenarios'
import { encodeScenarioHash } from '../src/state/share'
import { surfaceForHash } from '../src/state/surface'
import {
  initialPlannerState,
  plannerReducer,
  toggleInterest,
} from '../src/state/planner'
import type { InterestId, PlannerState } from '../src/state/planner'

/**
 * Shell invariants (planner spec): a valid `#s=` share link lands in
 * Explore from ANY surface — Home is the default landing, never a dead end
 * for a link; malformed/absent hashes degrade to Home. The planner form's
 * reducer is pure: chips toggle in selection-priority order, budget/hours
 * run the same clamps as Explore, and "Find my trips" stores a snapshot of
 * the draft without rewriting later edits.
 */

function encodedShareLink(overrides: Partial<ScenarioSource> = {}): string {
  const scenario = scenarioFromState('Kochi weekend', {
    clockNowMs: at(14, 20),
    speedMultiplier: 4,
    originId: 'kozhikode',
    budgetINR: 2_120,
    availableHours: 18,
    selectedId: 'ooty',
    ...overrides,
  })
  expect(scenario).not.toBeNull()
  return encodeScenarioHash(scenario!)
}

describe('deep links land in Explore from any surface', () => {
  it('a valid #s= link resolves to Explore even though the user was on Home', () => {
    // The deep-link-from-home case (spec): Home would otherwise be the
    // boot surface; a share link must restore Explore instead.
    expect(surfaceForHash(`#${encodedShareLink()}`)).toBe('explore')
    expect(surfaceForHash(encodedShareLink())).toBe('explore')
  })

  it('a malformed or absent hash degrades to Home, never a crash', () => {
    expect(surfaceForHash('')).toBe('home')
    expect(surfaceForHash('#')).toBe('home')
    expect(surfaceForHash('#x=junk')).toBe('home')
    expect(surfaceForHash('#s=!!!not-base64!!!')).toBe('home')
  })

  it('a hash that fails scenario validation also lands on Home', () => {
    // Same degrade-not-crash contract as the share suite: strict parse →
    // null → Home.
    const raw = { name: 'unknown origin', clockNowMs: 0, speedMultiplier: 1, originId: 'mars', budgetINR: 100, availableHours: 4, selectedId: null }
    expect(surfaceForHash(`#${encodeScenarioHash(raw as never)}`)).toBe('home')
  })
})

describe('planner interest chips toggle in selection-priority order', () => {
  it('toggling on appends — the first chip picked ranks highest', () => {
    expect(toggleInterest([], 'nature')).toEqual(['nature'])
    expect(toggleInterest(['nature'], 'food')).toEqual(['nature', 'food'])
    expect(toggleInterest(['nature', 'food'], 'heritage')).toEqual(['nature', 'food', 'heritage'])
  })

  it('toggling off removes and keeps the remaining order', () => {
    expect(toggleInterest(['nature', 'food', 'heritage'], 'food')).toEqual(['nature', 'heritage'])
    expect(toggleInterest(['nature'], 'nature')).toEqual([])
  })

  it('toggling never duplicates an interest', () => {
    const once = toggleInterest(['food'], 'food')
    expect(once).toEqual([])
    expect(toggleInterest(['food', 'heritage'], 'food')).toEqual(['heritage'])
  })
})

describe('planner form reducer', () => {
  function stateWith(draft: Partial<PlannerState['draft']>): PlannerState {
    const base = initialPlannerState()
    return { ...base, draft: { ...base.draft, ...draft } }
  }

  it('starts on the default constraints with no interests and nothing submitted', () => {
    const state = initialPlannerState()
    expect(state.draft.originId).toBe('kozhikode')
    expect(state.draft.budgetINR).toBe(2_000)
    expect(state.draft.availableHours).toBe(24)
    expect(state.draft.interests).toEqual([])
    expect(state.submitted).toBeNull()
  })

  it('ignores an origin outside the bundled dataset', () => {
    const state = stateWith({ originId: 'kozhikode' })
    expect(plannerReducer(state, { type: 'setOrigin', id: 'mars' })).toBe(state)
    expect(plannerReducer(state, { type: 'setOrigin', id: 'ooty' }).draft.originId).toBe('ooty')
  })

  it('clamps budget and hours to the Explore panel bounds', () => {
    const state = initialPlannerState()
    const budgeted = plannerReducer(state, { type: 'setBudget', inr: 99_999 })
    expect(budgeted.draft.budgetINR).toBe(10_000)
    const cheap = plannerReducer(state, { type: 'setBudget', inr: 5 })
    expect(cheap.draft.budgetINR).toBe(200)
    const long = plannerReducer(state, { type: 'setHours', hours: 100 })
    expect(long.draft.availableHours).toBe(48)
    const short = plannerReducer(state, { type: 'setHours', hours: 0 })
    expect(short.draft.availableHours).toBe(2)
  })

  it('submit stores a snapshot of the draft; later edits do not rewrite it', () => {
    let state: PlannerState = stateWith({ interests: ['food', 'heritage'], budgetINR: 4_000, availableHours: 12 })
    state = plannerReducer(state, { type: 'submit' })
    expect(state.submitted).toEqual({
      originId: 'kozhikode',
      budgetINR: 4_000,
      availableHours: 12,
      interests: ['food', 'heritage'],
    })
    // Keep editing after submit: the draft moves, the stored request stays.
    state = plannerReducer(state, { type: 'toggleInterest', interest: 'food' })
    state = plannerReducer(state, { type: 'setBudget', inr: 9_000 })
    expect(state.submitted?.budgetINR).toBe(4_000)
    expect(state.submitted?.interests).toEqual(['food', 'heritage'])
    expect(state.draft.budgetINR).toBe(9_000)
    expect(state.draft.interests).toEqual(['heritage'])
  })

  it('a submitted request is a copy — mutating the draft array cannot leak in', () => {
    const state = plannerReducer(stateWith({ interests: ['movies' as InterestId] }), { type: 'submit' })
    expect(state.submitted?.interests).toEqual(['movies'])
    const next = plannerReducer(state, { type: 'toggleInterest', interest: 'nature' })
    expect(state.submitted?.interests).toEqual(['movies'])
    expect(next.draft.interests).toEqual(['movies', 'nature'])
  })
})
