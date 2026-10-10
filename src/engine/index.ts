import { REFERENCE_DAY_START_MS } from '../data/referenceDay'
import type { TransportData } from '../data/types'
import { findCriticalConnection, toSearchInput } from './counterfactual'
import { describeReachable, explainUnreachable, journeysFromLabels, pickBest } from './journey'
import { findRoundTrip } from './roundTrip'
import { searchFrom } from './search'
import type { Label, SearchInput, SearchOptions } from './search'
import type { Constraints, DestinationResult } from './types'
import { formatIst } from '../sim/clock'

export type { Connection, Location, Mode, TransportData } from '../data/types'
export type { Constraints, DestinationResult, Journey, Leg, ReachabilitySummary } from './types'
export type { Label, SearchInput, SearchOptions } from './search'
export { searchFrom, deadlineOf } from './search'
export {
  computeConnectionImpact,
  findCriticalConnection,
  toSearchInput,
} from './counterfactual'
export type { ConnectionImpact, DestinationImpact } from './counterfactual'
export { findRoundTrip, MIN_STAY_MINUTES } from './roundTrip'
export { summarizeResults } from './summarize'
export {
  BUDGET_MAX_INR,
  BUDGET_MIN_INR,
  clampAvailableHours,
  clampBudgetINR,
  DEFAULT_AVAILABLE_HOURS,
  DEFAULT_BUDGET_INR,
  DEFAULT_MIN_TRANSFER_MIN,
  DEFAULT_ORIGIN_ID,
  HOURS_MAX,
  HOURS_MIN,
  makeDefaultConstraints,
} from './defaults'
export { labelToJourney, journeysFromLabels, pickBest } from './journey'
export { probeUnlock, describeUnlock } from './probe'
export type { UnlockProbe, BlockingConnection, TimeRelaxation } from './probe'

/**
 * The one engine entry point: given the dataset, the constraints (including
 * the simulation clock as a plain parameter) and optional counterfactual
 * exclusions, return one result per non-origin destination, in dataset order.
 * Deterministic: same inputs → deep-equal results, every time.
 */
export function computeReachability(
  data: TransportData,
  constraints: Constraints,
  options: SearchOptions = {},
): DestinationResult[] {
  const input = toSearchInput(constraints)
  const labels = searchFrom(data, input, options)

  // Diagnostics only when something is unreachable — four extra pure runs.
  let needsDiagnosis = false
  for (const loc of data.locations) {
    if (loc.id !== constraints.originId && (labels.get(loc.id)?.length ?? 0) === 0) {
      needsDiagnosis = true
      break
    }
  }
  const relaxed = needsDiagnosis ? computeRelaxedRuns(data, input) : null

  const originName = data.locationById.get(constraints.originId)?.name ?? constraints.originId
  const results: DestinationResult[] = []

  for (const loc of data.locations) {
    if (loc.id === constraints.originId) continue
    const journeys = journeysFromLabels(labels.get(loc.id))

    if (journeys.length === 0) {
      results.push({
        location: loc,
        reachable: false,
        journeys: [],
        best: null,
        reason: relaxed
          ? explainUnreachable(data, input, loc.id, relaxed)
          : 'Unreachable under the current constraints.',
        roundTrip: null,
        criticalConnId: null,
      })
      continue
    }

    const best = pickBest(journeys)!
    const roundTrip = findRoundTrip(data, input, best)
    const reason =
      describeReachable(best, originName) +
      (roundTrip
        ? ` Day trip possible — return arrives ${formatIst(roundTrip.arriveAt)}.`
        : ' No valid return inside the deadline and budget.')
    const criticalConnId = findCriticalConnection(data, input, loc.id, journeys)

    results.push({
      location: loc,
      reachable: true,
      journeys,
      best,
      reason,
      roundTrip,
      criticalConnId,
    })
  }

  return results
}

/** The four relaxed searches that power constraint-naming reasons. */
function computeRelaxedRuns(
  data: TransportData,
  input: SearchInput,
): {
  withBudget: Map<string, Label[]>
  withDeadline: Map<string, Label[]>
  withTransfer: Map<string, Label[]>
  withClock: Map<string, Label[]>
} {
  return {
    withBudget: searchFrom(data, { ...input, budgetINR: Number.POSITIVE_INFINITY }),
    withDeadline: searchFrom(data, { ...input, deadline: Number.POSITIVE_INFINITY }),
    withTransfer: searchFrom(data, { ...input, minTransferMin: 0 }),
    withClock: searchFrom(data, { ...input, now: REFERENCE_DAY_START_MS }),
  }
}
