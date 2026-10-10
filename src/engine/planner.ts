import { MINUTE_MS, REFERENCE_DAY_START_MS } from '../data/referenceDay'
import type { Location, TransportData } from '../data/types'
import { journeysFromLabels, pickBest } from './journey'
import { deadlineOf, searchFrom } from './search'
import type { Constraints, Journey } from './types'

/**
 * The day-trip planner — PR 2 of the Day-Trip Planner release.
 *
 * Composes the existing two-phase search shape (an outbound `searchFrom`, then
 * a constrained return `searchFrom` — exactly the shape `roundTrip.ts` uses)
 * into ranked full-day round trips: travel out, a dwell packed with
 * interest-matched activities and a meal, and the return journey. The search
 * core is imported, never modified; Explore's `MIN_STAY_MINUTES = 60`
 * round-trip semantics are untouched — the planner owns its own, stricter
 * dwell rule below.
 *
 * The POI catalog is dependency-injected: this module declares the catalog
 * shapes structurally and consumes whatever conforms. The concrete catalogs
 * live in src/data (a sibling PR) and are never imported here, so the engine
 * compiles and tests before that data lands.
 *
 * The user's rule, mechanical: a there-and-back is not a trip. Every offered
 * plan dwells at least MIN_TRIP_DWELL_MIN minutes with at least one activity
 * or meal actually fitted inside the dwell — connectivity alone never
 * qualifies a destination as a plan.
 */

/** Interest chips, selection-ordered on the planner form. */
export type InterestId =
  | 'food'
  | 'heritage'
  | 'nightlife'
  | 'adventure'
  | 'shopping'
  | 'nature'
  | 'movies'

/**
 * A there-and-back is not a trip: minimum dwell (minutes) at the destination
 * before an offered plan may board its return. Strictly the Explore
 * round-trip minimum (60) — the planner drops what Explore still counts.
 */
export const MIN_TRIP_DWELL_MIN = 90

/** Synthetic activity estimate at one destination — mirrors the src/data contract field-for-field. */
export interface PoiActivity {
  /** Unique across the whole catalog. */
  id: string
  destinationId: string
  title: string
  category: InterestId
  /** Per-person estimate, 0 for free sights. */
  costINR: number
  /** 15–240 minutes. */
  durationMin: number
  /** One honest sentence. */
  blurb: string
}

/** Synthetic meal estimate with a service window, minutes-of-day on the reference clock. */
export interface PoiMeal {
  id: string
  destinationId: string
  name: string
  costINR: number
  /** Service window start (inclusive), minutes-of-day IST. */
  windowStartMin: number
  /** Service window end (inclusive), minutes-of-day IST. */
  windowEndMin: number
  blurb: string
}

/** Famous sight near one destination — detail-card content; not used by the planner itself. */
export interface PoiSpot {
  id: string
  destinationId: string
  name: string
  blurb: string
  /** From the destination center — used for map pins, never claimed as surveyed. */
  distanceKm: number
}

/**
 * The POI data the planner packs dwells from. Injected as a parameter — the
 * engine depends on shapes, never on the data modules.
 */
export interface PoiCatalog {
  activities: PoiActivity[]
  meals: PoiMeal[]
  spots: PoiSpot[]
}

/** Constraints (origin, clock, budget, window, transfers) plus the interest selection. */
export interface PlannerInput extends Constraints {
  /** Selection-ordered; earlier interests win packing priority. Empty = no filter. */
  interests: InterestId[]
}

/** An activity as packed into a plan — the catalog's destinationId is implied. */
export interface PlannedActivity {
  id: string
  title: string
  category: InterestId
  costINR: number
  durationMin: number
  blurb: string
}

/** A meal as packed into a plan, with the derived service slot. */
export interface PlannedMeal {
  id: string
  name: string
  costINR: number
  slot: 'breakfast' | 'lunch' | 'evening'
  blurb: string
}

/** One ranked full-day round trip — every leg, minute, and rupee accounted for. */
export interface TripPlan {
  destinationId: string
  /** Existing engine journey — the outbound search's best per destination. */
  outbound: Journey
  /** The chosen return journey (one of the nondominated candidates). */
  returnJourney: Journey
  /** Outbound first departure, epoch-ms on the reference day. */
  departAt: number
  /** Return final arrival — always ≤ the deadline. */
  arriveBackAt: number
  /** Ground time at the destination: returnJourney.departAt − outbound.arriveAt, in minutes. */
  dwellMin: number
  activities: PlannedActivity[]
  /** null when no service window covers the dwell midpoint or no meal fits the budget. */
  meal: PlannedMeal | null
  costs: {
    travelINR: number
    activitiesINR: number
    mealINR: number
    totalINR: number
  }
  /** Distinct user interests this plan actually serves, in the user's own order. */
  interestsMatched: InterestId[]
  /**
   * Deterministic ranking number, higher is better — most- to least-
   * significant: distinct interests matched weighted by user order (quantum
   * 1e11), dwell utilization at 1e-4 granularity (quantum 1e6), then cheaper
   * total cost (₹ granularity below ₹1,000,000). Integer-exact (max ≈ 2.9e12,
   * well under 2^53), so ordering is stable across runs and machines. The
   * final sort additionally breaks residual ties by destination name.
   */
  score: number
}

/** Meal-slot boundaries on the reference clock (minutes-of-day IST). */
const LUNCH_FROM_MIN = 11 * 60 // 11:00
const EVENING_FROM_MIN = 16 * 60 // 16:00

const MINUTES_PER_DAY = 24 * 60

/** Dwell-utilization fixed-point: 1e-4 of the dwell, integer-exact in the score. */
const UTIL_QUANTUM = 1_000_000
/** One interest-weight unit outweighs any utilization difference. */
const INTEREST_QUANTUM = 100_000 * UTIL_QUANTUM
/** Rupee headroom for the cost component — cheaper is better within it. */
const COST_HEADROOM_INR = 1_000_000

function mealSlotForMinute(minute: number): PlannedMeal['slot'] {
  if (minute < LUNCH_FROM_MIN) return 'breakfast'
  if (minute < EVENING_FROM_MIN) return 'lunch'
  return 'evening'
}

/** Minutes-of-day IST for an epoch-ms on/around the reference day (wraps at midnight). */
function minutesOfDay(ms: number): number {
  const raw = Math.floor((ms - REFERENCE_DAY_START_MS) / MINUTE_MS)
  return ((raw % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
}

/**
 * Distinct interests matched, weighted by the user's own order: the first
 * selected interest outweighs the last, and every additional match adds.
 */
function weightedInterestScore(interestsMatched: InterestId[], interests: InterestId[]): number {
  let score = 0
  for (const matched of interestsMatched) {
    const idx = interests.indexOf(matched)
    if (idx >= 0) score += interests.length - idx
  }
  return score
}

/** The single deterministic ranking number — see TripPlan.score. */
function compositeScore(
  interestsMatched: InterestId[],
  interests: InterestId[],
  packedMinutes: number,
  dwellMin: number,
  totalINR: number,
): number {
  const interestScore = weightedInterestScore(interestsMatched, interests)
  const utilPoints = Math.floor((packedMinutes / dwellMin) * 10_000)
  const savings = Math.max(0, COST_HEADROOM_INR - 1 - totalINR)
  return interestScore * INTEREST_QUANTUM + utilPoints * UTIL_QUANTUM + savings
}

/** What one return candidate's dwell packed, before TripPlan assembly. */
interface DwellPack {
  activities: PlannedActivity[]
  meal: PlannedMeal | null
  activitiesINR: number
  mealINR: number
  packedMinutes: number
}

/**
 * Greedy dwell packing. Candidates are pre-filtered to the destination and —
 * when interests are selected — to the selected categories (a destination with
 * none of the user's interests packs no activities at all). Order: user's
 * interest priority first, then cost-effectiveness (₹ per minute, compared by
 * integer cross-multiplication — no float ordering), then id for a total
 * order. With no interests selected every category is equal priority and
 * cost-effectiveness decides. An activity packs when it still fits the dwell;
 * entries that do not fit are skipped and packing continues, so when the
 * dwell is tight the lowest-priority entries lose their slots first.
 */
function packActivities(
  candidates: PoiActivity[],
  interests: InterestId[],
  dwellStartMs: number,
  dwellEndMs: number,
): { packed: PlannedActivity[]; packedMinutes: number; activitiesINR: number } {
  const priorityOf = (a: PoiActivity): number =>
    interests.length === 0 ? 0 : interests.indexOf(a.category)

  // With interests selected, only the selected categories may pack — a
  // destination with none of them packs no activities at all.
  const eligible =
    interests.length === 0 ? candidates : candidates.filter((a) => interests.includes(a.category))

  const ordered = [...eligible].sort((a, b) => {
    const byPriority = priorityOf(a) - priorityOf(b)
    if (byPriority !== 0) return byPriority
    // cost-effectiveness: a.costINR/a.durationMin < b.costINR/b.durationMin,
    // cross-multiplied to stay in integer arithmetic (durations are ≥ 15 min).
    const byEfficiency = a.costINR * b.durationMin - b.costINR * a.durationMin
    if (byEfficiency !== 0) return byEfficiency
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })

  const packed: PlannedActivity[] = []
  let cursor = dwellStartMs
  let packedMinutes = 0
  let activitiesINR = 0
  for (const a of ordered) {
    const endMs = cursor + a.durationMin * MINUTE_MS
    if (endMs > dwellEndMs) continue
    packed.push({
      id: a.id,
      title: a.title,
      category: a.category,
      costINR: a.costINR,
      durationMin: a.durationMin,
      blurb: a.blurb,
    })
    cursor = endMs
    packedMinutes += a.durationMin
    activitiesINR += a.costINR
  }
  return { packed, packedMinutes, activitiesINR }
}

/**
 * Packs one (outbound, return) pair's dwell: activities greedily by time, one
 * meal whose service window covers the dwell midpoint, then a budget
 * reconciliation that prefers the meal — the plan survives with fewer
 * activities — dropping lowest-priority activities until travel + activities
 * + meal fits the budget. Falls back to an activities-only plan when no meal
 * can fit even with none packed. Returns null when nothing fits: that round
 * trip is not a plan.
 */
function packDwell(
  destActivities: PoiActivity[],
  destMeals: PoiMeal[],
  interests: InterestId[],
  outbound: Journey,
  ret: Journey,
  budgetINR: number,
): DwellPack | null {
  const dwellStartMs = outbound.arriveAt
  const dwellEndMs = ret.departAt
  const dwellMin = (dwellEndMs - dwellStartMs) / MINUTE_MS
  if (dwellMin < MIN_TRIP_DWELL_MIN) return null

  const { packed, activitiesINR } = packActivities(
    destActivities,
    interests,
    dwellStartMs,
    dwellEndMs,
  )
  const travelINR = outbound.costINR + ret.costINR

  const midpointMs = Math.floor((dwellStartMs + dwellEndMs) / 2)
  const midpointMin = minutesOfDay(midpointMs)
  const servingMeals = destMeals
    .filter((m) => m.windowStartMin <= midpointMin && midpointMin <= m.windowEndMin)
    .sort((a, b) => a.costINR - b.costINR || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

  const toPlannedMeal = (m: PoiMeal): PlannedMeal => ({
    id: m.id,
    name: m.name,
    costINR: m.costINR,
    slot: mealSlotForMinute(midpointMin),
    blurb: m.blurb,
  })

  // Meal preferred: drop activities from the priority end until the cheapest
  // serving meal fits the remaining budget (minimal drops — the loop stops as
  // soon as it fits). Meals are cost-sorted, so the first that fits costs the
  // fewest activities.
  const kept = [...packed]
  let keptINR = activitiesINR
  for (const m of servingMeals) {
    while (kept.length > 0 && travelINR + keptINR + m.costINR > budgetINR) {
      keptINR -= kept.pop()!.costINR
    }
    if (travelINR + keptINR + m.costINR <= budgetINR) {
      return {
        activities: kept,
        meal: toPlannedMeal(m),
        activitiesINR: keptINR,
        mealINR: m.costINR,
        packedMinutes: kept.reduce((sum, a) => sum + a.durationMin, 0),
      }
    }
  }

  // No meal fits even with none packed — an activities-only day is still a
  // legitimate plan when at least one activity remains inside the budget.
  while (kept.length > 0 && travelINR + keptINR > budgetINR) {
    keptINR -= kept.pop()!.costINR
  }
  if (kept.length === 0) return null
  return {
    activities: kept,
    meal: null,
    activitiesINR: keptINR,
    mealINR: 0,
    packedMinutes: kept.reduce((sum, a) => sum + a.durationMin, 0),
  }
}

/**
 * Better plan for the ranking comparator: higher score; on exact ties, home
 * earlier (more buffer before the deadline), then the earlier-returning
 * departure. Deterministic and total within one destination.
 */
function compareCandidatePlans(a: TripPlan, b: TripPlan): number {
  return (
    b.score - a.score ||
    a.arriveBackAt - b.arriveBackAt ||
    a.returnJourney.departAt - b.returnJourney.departAt
  )
}

function assembleTripPlan(
  location: Location,
  outbound: Journey,
  ret: Journey,
  pack: DwellPack,
  input: PlannerInput,
  dwellMs: number,
): TripPlan {
  const travelINR = outbound.costINR + ret.costINR
  const activitiesINR = pack.activitiesINR
  const mealINR = pack.mealINR
  const totalINR = travelINR + activitiesINR + mealINR

  const matched = new Set<InterestId>(pack.activities.map((a) => a.category))
  // A meal is food content — it matches the food interest when selected.
  if (pack.meal && input.interests.includes('food')) matched.add('food')
  const interestsMatched = input.interests.filter((i) => matched.has(i))

  const dwellMin = Math.round(dwellMs / MINUTE_MS)
  const packedMinutes = pack.packedMinutes

  return {
    destinationId: location.id,
    outbound,
    returnJourney: ret,
    departAt: outbound.departAt,
    arriveBackAt: ret.arriveAt,
    dwellMin,
    activities: pack.activities,
    meal: pack.meal,
    costs: { travelINR, activitiesINR, mealINR, totalINR },
    interestsMatched,
    score: compositeScore(interestsMatched, input.interests, packedMinutes, dwellMin, totalINR),
  }
}

/**
 * All nondominated return journeys from one destination are dwell candidates;
 * each is packed and reconciled, and the best plan wins.
 */
function bestPlanForDestination(
  data: TransportData,
  poi: PoiCatalog,
  input: PlannerInput,
  location: Location,
  outbound: Journey,
  deadline: number,
): TripPlan | null {
  const earliestReturnMs = outbound.arriveAt + MIN_TRIP_DWELL_MIN * MINUTE_MS
  const remainingBudgetINR = input.budgetINR - outbound.costINR
  if (remainingBudgetINR < 0 || earliestReturnMs > deadline) return null

  // The findRoundTrip shape, parameterized: same deadline, budget reduced by
  // the outbound cost, clock shifted past the minimum dwell. All nondominated
  // returns are kept — each is a candidate dwell length.
  const returnLabels = searchFrom(data, {
    originId: location.id,
    now: earliestReturnMs,
    budgetINR: remainingBudgetINR,
    deadline,
    minTransferMin: input.minTransferMin,
  })

  const destActivities = poi.activities.filter((a) => a.destinationId === location.id)
  const destMeals = poi.meals.filter((m) => m.destinationId === location.id)

  let best: TripPlan | null = null
  for (const ret of journeysFromLabels(returnLabels.get(input.originId))) {
    const dwellMs = ret.departAt - outbound.arriveAt
    // The there-and-back guard, held even though the shifted clock should
    // guarantee it: connectivity alone never qualifies a plan.
    if (dwellMs < MIN_TRIP_DWELL_MIN * MINUTE_MS) continue
    const pack = packDwell(destActivities, destMeals, input.interests, outbound, ret, input.budgetINR)
    if (!pack) continue
    const plan = assembleTripPlan(location, outbound, ret, pack, input, dwellMs)
    if (!best || compareCandidatePlans(plan, best) < 0) best = plan
  }
  return best
}

/**
 * Every feasible ranked day trip for the input — travel out, dwell, eat, back
 * before the deadline, all inside the budget.
 *
 * Four composable steps, all deterministic: (1) one outbound search from the
 * origin, best outbound per destination via pickBest; (2) per reachable
 * destination, a return search with the clock shifted past the minimum dwell
 * and the budget reduced by the outbound cost, keeping every nondominated
 * return as a dwell candidate; (3) the dwell packed greedily with
 * interest-matched activities and one meal, budget-reconciled by dropping
 * lowest-priority activities; (4) ranked by the score chain — interests
 * matched (user order), dwell utilization, cheaper total, destination name.
 *
 * Pure: the clock arrives as a constraint, the catalog as a parameter, and
 * equal inputs deep-equal across runs and machines.
 */
export function planDayTrips(data: TransportData, poi: PoiCatalog, input: PlannerInput): TripPlan[] {
  const deadline = deadlineOf(input.now, input.availableHours)
  const outboundLabels = searchFrom(data, {
    originId: input.originId,
    now: input.now,
    budgetINR: input.budgetINR,
    deadline,
    minTransferMin: input.minTransferMin,
  })

  const plans: TripPlan[] = []
  for (const location of data.locations) {
    if (location.id === input.originId) continue
    const outbound = pickBest(journeysFromLabels(outboundLabels.get(location.id)))
    if (!outbound) continue // unreachable — never a plan
    const plan = bestPlanForDestination(data, poi, input, location, outbound, deadline)
    if (plan) plans.push(plan)
  }

  const nameOf = (id: string): string => data.locationById.get(id)?.name ?? id
  return plans.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score
    const an = nameOf(a.destinationId)
    const bn = nameOf(b.destinationId)
    if (an !== bn) return an < bn ? -1 : 1
    return a.destinationId < b.destinationId ? -1 : a.destinationId > b.destinationId ? 1 : 0
  })
}
