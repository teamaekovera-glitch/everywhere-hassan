import { HOUR_MS, MINUTE_MS, REFERENCE_DAY_START_MS } from '../data/referenceDay'
import type { TransportData } from '../data/types'
import { findCriticalConnection, toSearchInput } from './counterfactual'
import { searchFrom } from './search'
import { BUDGET_MAX_INR } from './defaults'
import { formatINR } from './format'
import { journeysFromLabels, pickBest } from './journey'
import type { SearchInput } from './search'
import type { Constraints, Journey } from './types'
import { formatIst } from '../sim/clock'

/**
 * The unlock probe (upgrade spec, art_P6WzGRk4): for an unreachable
 * destination, the minimum extra budget or extra time that brings it back —
 * computed on demand by re-running the existing Pareto search across bounded
 * constraint relaxations. No new graph algorithm; the probe is a read-only
 * lens over one snapshot and never mutates scenario state.
 *
 * Three relaxation axes, each a bounded monotone sweep (exponential ramp,
 * then binary search to the exact integer/minute):
 * - budget — `budgetINR + Δ` with the deadline fixed (spec's minExtraBudget).
 * - deadline — `deadline + Δ` with the budget fixed (spec's minExtraTime).
 * - departure — `now − Δ` with the absolute deadline fixed. Needed because a
 *   destination killed by an expired departure (Mangaluru after the 18:05
 *   express) has no future inbound at all: no budget and no deadline
 *   extension can ever unlock it. "Leave Δ minutes earlier" is the honest
 *   answer, and the transient preview applies it as a clock rewind.
 *
 * Every axis strictly enlarges the label set (a relaxed search reproduces
 * every baseline label and adds more; a bucket is never emptied by an
 * insertion), so "has an option" is monotone in Δ and binary search is exact.
 */

/** Which axis `minExtraTime` measures — the UI phrases them differently. */
export type TimeRelaxation = 'deadline' | 'departure'

export interface BlockingConnection {
  connectionId: string
  /** "Mangaluru Express (18:05) · departs Kozhikode 18:05". */
  label: string
}

export interface UnlockProbe {
  destinationId: string
  reachableNow: false
  /** Smallest budget bump (₹) that yields a nondominated option. Null when no budget inside the app's range unlocks it. */
  minExtraBudget: number | null
  /** Smallest time shift (minutes) that yields a nondominated option — see `timeRelaxation`. Null when no time shift within the reference day helps. */
  minExtraTime: number | null
  /** What `minExtraTime` measures (null when `minExtraTime` is null). */
  timeRelaxation: TimeRelaxation | null
  /** What the probe blames, from the connection-exclusion sweep on the unlocked state. */
  blockingConnection: BlockingConnection | null
  /** Cheapest itinerary under the minimal relaxation (budget preferred, else time). */
  cheapestUnlockedItinerary: Journey | null
}

/**
 * Minimal Δ solving a monotone predicate, by exponential ramp from `step0`
 * up to `cap`, then binary search on the integer interval. Exact to the
 * sweep's unit (₹1 / 1 minute); null when even `cap` doesn't unlock.
 */
function sweepMinimal(
  step0: number,
  cap: number,
  unlocks: (delta: number) => boolean,
): number | null {
  if (cap < 1) return null
  let lo = 0 // baseline is unreachable, so Δ = 0 misses by construction
  let hi: number | null = null
  let step = step0
  while (hi === null) {
    const d = Math.min(step, cap)
    if (unlocks(d)) {
      hi = d
    } else if (d === cap) {
      return null // ramp exhausted at the cap
    } else {
      lo = d
      step *= 2
    }
  }
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2)
    if (unlocks(mid)) hi = mid
    else lo = mid
  }
  return hi
}

function hasOption(data: TransportData, input: SearchInput, destId: string): boolean {
  return journeysFromLabels(searchFrom(data, input).get(destId)).length > 0
}

/** Reference-day horizon for deadline extensions: 48 h from the day start. */
const DAY_HORIZON_MS = REFERENCE_DAY_START_MS + 48 * HOUR_MS

/**
 * Probes one unreachable destination. Returns null when the destination is
 * reachable (nothing to unlock — callers never probe a live node) or is the
 * origin; throws on an unknown id, like the rest of the engine.
 */
export function probeUnlock(
  data: TransportData,
  constraints: Constraints,
  destId: string,
): UnlockProbe | null {
  if (!data.locationById.has(destId)) {
    throw new Error(`unknown destination '${destId}'`)
  }
  if (destId === constraints.originId) return null

  const input = toSearchInput(constraints)
  if (hasOption(data, input, destId)) return null

  // Axis 1 — budget (spec: ₹50, ₹100, ₹200 … then binary search).
  const budgetCap = Math.max(0, BUDGET_MAX_INR - input.budgetINR)
  const minExtraBudget = sweepMinimal(50, budgetCap, (d) =>
    hasOption(data, { ...input, budgetINR: input.budgetINR + d }, destId),
  )

  // Axis 2 — deadline extension (spec: +30m, +1h, +2h … then binary search),
  // bounded by the reference-day horizon. Skipped when the deadline already
  // reaches past it — extending further admits no timetable rows.
  const deadlineCapMin = Math.floor((DAY_HORIZON_MS - input.deadline) / MINUTE_MS)
  const deadlineDelta =
    deadlineCapMin >= 1
      ? sweepMinimal(30, deadlineCapMin, (m) =>
          hasOption(data, { ...input, deadline: input.deadline + m * MINUTE_MS }, destId),
        )
      : null

  // Axis 3 — departure rewind, only when no deadline extension works: the
  // destination is departure-dead, and "leave earlier, same arrival
  // flexibility" is the remaining honest lever.
  const rewindCapMin = Math.floor((input.now - REFERENCE_DAY_START_MS) / MINUTE_MS)
  const rewindDelta =
    deadlineDelta === null && rewindCapMin >= 1
      ? sweepMinimal(5, rewindCapMin, (m) =>
          hasOption(data, { ...input, now: input.now - m * MINUTE_MS }, destId),
        )
      : null

  const minExtraTime = deadlineDelta ?? rewindDelta
  const timeRelaxation: TimeRelaxation | null =
    deadlineDelta !== null ? 'deadline' : rewindDelta !== null ? 'departure' : null

  // The headline relaxation drives the preview and the shown itinerary:
  // budget when it unlocks (a sentence about money), else time.
  const relaxedInput: SearchInput | null =
    minExtraBudget !== null
      ? { ...input, budgetINR: input.budgetINR + minExtraBudget }
      : timeRelaxation === 'deadline' && deadlineDelta !== null
        ? { ...input, deadline: input.deadline + deadlineDelta * MINUTE_MS }
        : timeRelaxation === 'departure' && rewindDelta !== null
          ? { ...input, now: input.now - rewindDelta * MINUTE_MS }
          : null

  if (relaxedInput === null) {
    // Stranded even under every bounded relaxation — the panel says so.
    return {
      destinationId: destId,
      reachableNow: false,
      minExtraBudget: null,
      minExtraTime: null,
      timeRelaxation: null,
      blockingConnection: null,
      cheapestUnlockedItinerary: null,
    }
  }

  const journeys = journeysFromLabels(searchFrom(data, relaxedInput).get(destId))
  const itinerary = pickBest(journeys)
  const criticalId = itinerary
    ? findCriticalConnection(data, relaxedInput, destId, journeys)
    : null
  const critical = criticalId ? data.connectionById(criticalId) : undefined

  return {
    destinationId: destId,
    reachableNow: false,
    minExtraBudget,
    minExtraTime,
    timeRelaxation,
    blockingConnection:
      critical
        ? {
            connectionId: critical.id,
            label: `${critical.label} · departs ${data.locationById.get(critical.from)?.name ?? critical.from} ${formatIst(critical.depart)}`,
          }
        : null,
    cheapestUnlockedItinerary: itinerary,
  }
}

/** One-line human summary of a probe's headline unlock — the panel's lead sentence. */
export function describeUnlock(probe: UnlockProbe): string | null {
  const name = probe.destinationId
  if (probe.minExtraBudget !== null) {
    return `${formatINR(probe.minExtraBudget)} more unlocks ${name}.`
  }
  if (probe.minExtraTime !== null && probe.timeRelaxation === 'deadline') {
    return `${probe.minExtraTime} more minutes on the deadline unlock ${name}.`
  }
  if (probe.minExtraTime !== null && probe.timeRelaxation === 'departure') {
    return `Leaving ${probe.minExtraTime} min earlier unlocks ${name}.`
  }
  return null
}
