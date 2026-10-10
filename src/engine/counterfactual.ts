import type { TransportData } from '../data/types'
import { pickBest, journeysFromLabels } from './journey'
import { searchFrom } from './search'
import type { SearchInput } from './search'
import type { Constraints } from './types'

/** Builds the engine's search input from UI-facing constraints. */
export function toSearchInput(c: Constraints): SearchInput {
  return {
    originId: c.originId,
    now: c.now,
    budgetINR: c.budgetINR,
    deadline: c.now + c.availableHours * 3_600_000,
    minTransferMin: c.minTransferMin,
  }
}

export interface DestinationImpact {
  locationId: string
  optionsBefore: number
  optionsAfter: number
  optionsRemoved: number
  wasReachable: boolean
  stillReachable: boolean
}

export interface ConnectionImpact {
  connectionId: string
  /** Total journey options removed across all destinations. */
  journeysRemoved: number
  /** Destinations flipped reachable → unreachable. */
  destinationsLost: DestinationImpact[]
  /** Every destination that lost at least one option. */
  destinationsAffected: DestinationImpact[]
  /** Destinations that survived, and the hub their surviving route now uses. */
  survivors: { locationId: string; viaNode: string | null }[]
}

/**
 * The arithmetic behind every alert: re-run reachability with one connection
 * excluded and report the exact delta. Nothing is invented — the UI renders
 * these numbers as-is ("missing it removes N options; X stays reachable via Y").
 */
export function computeConnectionImpact(
  data: TransportData,
  constraints: Constraints,
  connectionId: string,
): ConnectionImpact {
  if (!data.connectionById(connectionId)) {
    throw new Error(`unknown connection '${connectionId}'`)
  }
  const input = toSearchInput(constraints)
  const before = searchFrom(data, input)
  const after = searchFrom(data, input, { excludeConnectionIds: [connectionId] })

  const destinationsAffected: DestinationImpact[] = []
  const destinationsLost: DestinationImpact[] = []
  const survivors: { locationId: string; viaNode: string | null }[] = []
  let journeysRemoved = 0

  for (const loc of data.locations) {
    if (loc.id === constraints.originId) continue
    const beforeCount = journeysFromLabels(before.get(loc.id)).length
    const afterRuns = journeysFromLabels(after.get(loc.id))
    const afterCount = afterRuns.length
    if (beforeCount === afterCount) continue

    const impact: DestinationImpact = {
      locationId: loc.id,
      optionsBefore: beforeCount,
      optionsAfter: afterCount,
      optionsRemoved: beforeCount - afterCount,
      wasReachable: beforeCount > 0,
      stillReachable: afterCount > 0,
    }
    journeysRemoved += impact.optionsRemoved
    destinationsAffected.push(impact)
    if (!impact.stillReachable && impact.wasReachable) destinationsLost.push(impact)
    if (impact.wasReachable && impact.stillReachable) {
      const best = pickBest(afterRuns)
      survivors.push({
        locationId: loc.id,
        viaNode: best && best.legs.length > 1 ? best.legs[0]!.to : null,
      })
    }
  }

  return { connectionId, journeysRemoved, destinationsLost, destinationsAffected, survivors }
}

/**
 * The connection whose loss strands THIS result: excluding it alone leaves the
 * destination with no nondominated itinerary. Null when every single loss has
 * a surviving alternate — that is the resilience the demo celebrates.
 */
export function findCriticalConnection(
  data: TransportData,
  input: SearchInput,
  destId: string,
  journeys: { legs: { connId: string }[] }[],
): string | null {
  const usedIds: string[] = []
  const seen = new Set<string>()
  for (const j of journeys) {
    for (const leg of j.legs) {
      if (!seen.has(leg.connId)) {
        seen.add(leg.connId)
        usedIds.push(leg.connId)
      }
    }
  }
  for (const id of usedIds) {
    const labels = searchFrom(data, input, { excludeConnectionIds: [id] })
    const at = labels.get(destId)
    if (!at || at.length === 0) return id
  }
  return null
}
