import {
  BUDGET_MAX_INR,
  BUDGET_MIN_INR,
  DEFAULT_AVAILABLE_HOURS,
  DEFAULT_BUDGET_INR,
  DEFAULT_ORIGIN_ID,
  HOURS_MAX,
  HOURS_MIN,
  clampAvailableHours,
  clampBudgetINR,
} from '../engine/defaults'
import { DEMO_DATA } from '../data'

/**
 * Planner request state (planner spec). v1 keeps this as app state in the
 * shell — no share serialization, no engine calls. The results PR (next)
 * reads `submitted` and feeds it to `planDayTrips`; the shape below is the
 * contract both PRs share, so it is kept minimal and explicit.
 */

/** The seven interest categories, in their fixed display order. */
export type InterestId =
  | 'food'
  | 'heritage'
  | 'nightlife'
  | 'adventure'
  | 'shopping'
  | 'nature'
  | 'movies'

export const INTERESTS: readonly { id: InterestId; label: string }[] = [
  { id: 'food', label: 'Food' },
  { id: 'heritage', label: 'Heritage' },
  { id: 'nightlife', label: 'Nightlife' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'nature', label: 'Nature' },
  { id: 'movies', label: 'Movies' },
]

/** What the user asked for. `interests` is selection-ordered — the first
 * chip toggled ranks highest for activity packing (planner spec). */
export interface PlannerRequest {
  originId: string
  budgetINR: number
  availableHours: number
  interests: InterestId[]
}

export interface PlannerState {
  /** The live form values — persist across surface switches for the session. */
  draft: PlannerRequest
  /** The stored request from the last "Find my trips" — what the results
   * view will plan (null until the first submit). */
  submitted: PlannerRequest | null
}

export type PlannerAction =
  | { type: 'setOrigin'; id: string }
  | { type: 'setBudget'; inr: number }
  | { type: 'setHours'; hours: number }
  | { type: 'toggleInterest'; interest: InterestId }
  | { type: 'submit' }

/** Budget/time bounds mirror the Explore constraint panel (engine defaults). */
export const PLANNER_BUDGET_MIN = BUDGET_MIN_INR
export const PLANNER_BUDGET_MAX = BUDGET_MAX_INR
export const PLANNER_HOURS_MIN = HOURS_MIN
export const PLANNER_HOURS_MAX = HOURS_MAX

export function initialPlannerState(): PlannerState {
  return {
    draft: {
      originId: DEFAULT_ORIGIN_ID,
      budgetINR: DEFAULT_BUDGET_INR,
      availableHours: DEFAULT_AVAILABLE_HOURS,
      interests: [],
    },
    submitted: null,
  }
}

/**
 * Toggle a chip on (append at the end of the priority) or off (remove and
 * close the gap — remaining interests keep their relative order).
 */
export function toggleInterest(current: InterestId[], interest: InterestId): InterestId[] {
  if (current.includes(interest)) return current.filter((i) => i !== interest)
  return [...current, interest]
}

/**
 * The planner form's reducer — pure so the priority-order and submit rules
 * are unit-testable in the node env. Unknown origins are ignored (an id can
 * only come from the bundled dataset); budget and hours run the same clamps
 * the Explore panel uses.
 */
export function plannerReducer(state: PlannerState, action: PlannerAction): PlannerState {
  switch (action.type) {
    case 'setOrigin': {
      if (!DEMO_DATA.locationById.has(action.id)) return state
      return { ...state, draft: { ...state.draft, originId: action.id } }
    }
    case 'setBudget':
      return { ...state, draft: { ...state.draft, budgetINR: clampBudgetINR(action.inr) } }
    case 'setHours':
      return { ...state, draft: { ...state.draft, availableHours: clampAvailableHours(action.hours) } }
    case 'toggleInterest':
      return {
        ...state,
        draft: { ...state.draft, interests: toggleInterest(state.draft.interests, action.interest) },
      }
    case 'submit':
      // Store a snapshot of the draft — later edits to the form must not
      // rewrite the request the results view will plan.
      return { ...state, submitted: { ...state.draft, interests: [...state.draft.interests] } }
    default:
      return state
  }
}
