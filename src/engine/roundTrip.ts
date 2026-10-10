import { MINUTE_MS } from '../data/referenceDay'
import type { TransportData } from '../data/types'
import { pickBest, journeysFromLabels } from './journey'
import { searchFrom } from './search'
import type { SearchInput } from './search'
import type { Journey } from './types'

/**
 * Minimum dwell at a destination before the return may board. Part of the
 * round-trip contract: a "day trip" means you actually got to be there.
 */
export const MIN_STAY_MINUTES = 60

/**
 * Reverse search for the return: from the destination (having arrived on
 * `outbound`), find a journey back to the origin that departs no earlier than
 * arrival + MIN_STAY, arrives by the SAME deadline, and keeps the whole trip
 * inside the SAME budget. Null when nothing fits — one-way reachability is
 * the default claim, never silently upgraded to a day trip.
 */
export function findRoundTrip(
  data: TransportData,
  input: SearchInput,
  outbound: Journey,
): Journey | null {
  const earliestReturn = outbound.arriveAt + MIN_STAY_MINUTES * MINUTE_MS
  const remainingBudget = input.budgetINR - outbound.costINR
  if (remainingBudget < 0 || earliestReturn > input.deadline) return null

  const labels = searchFrom(data, {
    originId: outbound.legs[outbound.legs.length - 1]!.to,
    now: earliestReturn,
    budgetINR: remainingBudget,
    deadline: input.deadline,
    minTransferMin: input.minTransferMin,
  })
  const returns = journeysFromLabels(labels.get(input.originId))
  return pickBest(returns)
}
