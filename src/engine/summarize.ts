import type { DestinationResult, ReachabilitySummary } from './types'

/**
 * Stats for the timeline's running count and the stats panel — read from one
 * engine snapshot, never recomputed by panels ("no panel computes its own
 * truth").
 */
export function summarizeResults(results: readonly DestinationResult[]): ReachabilitySummary {
  let reachableCount = 0
  let totalJourneys = 0
  let roundTripCount = 0
  let cheapestFareINR: number | null = null

  for (const r of results) {
    if (r.reachable) reachableCount += 1
    totalJourneys += r.journeys.length
    if (r.roundTrip) roundTripCount += 1
    if (r.best && (cheapestFareINR === null || r.best.costINR < cheapestFareINR)) {
      cheapestFareINR = r.best.costINR
    }
  }

  return { reachableCount, totalJourneys, roundTripCount, cheapestFareINR }
}
