import { formatIst } from '../sim/clock'
import { formatINR } from './format'
import type { Journey, Leg } from './types'
import type { Label, SearchInput } from './search'
import type { TransportData } from '../data/types'

/** Walks the back-pointers into an origin→destination journey. */
export function labelToJourney(label: Label): Journey | null {
  if (label.via === null || label.back === null) return null // the origin label has no legs

  const legs: Leg[] = []
  for (let l: Label | null = label; l !== null && l.via !== null; l = l.back) {
    legs.push({
      connId: l.via.id,
      mode: l.via.mode,
      from: l.via.from,
      to: l.via.to,
      depart: l.via.depart,
      arrive: l.via.arrive,
      costINR: l.via.costINR,
    })
  }
  legs.reverse()

  return {
    legs,
    transfers: legs.length - 1,
    costINR: label.cost,
    departAt: legs[0]!.depart,
    arriveAt: label.arrival,
  }
}

function legSignature(j: Journey): string {
  return j.legs.map((l) => l.connId).join('>')
}

function compareJourneys(a: Journey, b: Journey): number {
  return (
    a.departAt - b.departAt ||
    a.arriveAt - b.arriveAt ||
    a.costINR - b.costINR ||
    (legSignature(a) < legSignature(b) ? -1 : legSignature(a) > legSignature(b) ? 1 : 0)
  )
}

/** The nondominated set for one destination, departure-sorted (spec contract). */
export function journeysFromLabels(labels: Label[] | undefined): Journey[] {
  if (!labels || labels.length === 0) return []
  const journeys: Journey[] = []
  for (const label of labels) {
    const journey = labelToJourney(label)
    if (journey) journeys.push(journey)
  }
  journeys.sort(compareJourneys)
  return journeys
}

/** Cheapest, ties broken by earliest arrival (spec contract). */
export function pickBest(journeys: Journey[]): Journey | null {
  if (journeys.length === 0) return null
  let best = journeys[0]!
  for (const j of journeys) {
    if (j.costINR < best.costINR || (j.costINR === best.costINR && j.arriveAt < best.arriveAt)) {
      best = j
    }
  }
  return best
}

/** Summary line for a reachable destination. */
export function describeReachable(best: Journey, originName: string): string {
  const transfers =
    best.transfers === 0
      ? 'direct'
      : `${best.transfers} transfer${best.transfers === 1 ? '' : 's'}`
  return (
    `Reachable from ${originName} — ${best.legs.length} leg${best.legs.length === 1 ? '' : 's'}, ` +
    `${transfers}, ${formatINR(best.costINR)} (estimated), arrives ${formatIst(best.arriveAt)}.`
  )
}

/** Tightest connection change in a journey: the gap the transfer minimum must accept. */
export function tightestTransfer(j: Journey): { node: string; gapMin: number } | null {
  let tightest: { node: string; gapMin: number } | null = null
  for (let i = 1; i < j.legs.length; i++) {
    const gapMin = (j.legs[i]!.depart - j.legs[i - 1]!.arrive) / 60_000
    if (tightest === null || gapMin < tightest.gapMin) {
      tightest = { node: j.legs[i]!.from, gapMin }
    }
  }
  return tightest
}

/**
 * Diagnoses an unreachable destination with four relaxed re-runs (budget,
 * deadline, transfer minimum, clock). The first relaxation that rescues the
 * destination names the constraint that broke — nothing invented.
 */
export function explainUnreachable(
  data: TransportData,
  input: SearchInput,
  destId: string,
  relaxed: {
    withBudget: Map<string, Label[]>
    withDeadline: Map<string, Label[]>
    withTransfer: Map<string, Label[]>
    withClock: Map<string, Label[]>
  },
): string {
  const name = data.locationById.get(destId)?.name ?? destId

  const budgetRuns = journeysFromLabels(relaxed.withBudget.get(destId))
  if (budgetRuns.length > 0) {
    const cheapest = pickBest(budgetRuns)!
    return (
      `Unreachable — the cheapest option to ${name} costs ${formatINR(cheapest.costINR)} (estimated), ` +
      `above the ${formatINR(input.budgetINR)} budget.`
    )
  }

  const deadlineRuns = journeysFromLabels(relaxed.withDeadline.get(destId))
  if (deadlineRuns.length > 0) {
    let earliest = deadlineRuns[0]!
    for (const j of deadlineRuns) if (j.arriveAt < earliest.arriveAt) earliest = j
    return (
      `Unreachable — the earliest possible arrival is ${formatIst(earliest.arriveAt)}, ` +
      `after the ${formatIst(input.deadline)} deadline.`
    )
  }

  const transferRuns = journeysFromLabels(relaxed.withTransfer.get(destId))
  if (transferRuns.length > 0) {
    let tightest: { node: string; gapMin: number } | null = null
    for (const j of transferRuns) {
      const t = tightestTransfer(j)
      if (t && (tightest === null || t.gapMin < tightest.gapMin)) tightest = t
    }
    if (tightest) {
      return (
        `Unreachable — every route to ${name} needs a connection change at ` +
        `${data.locationById.get(tightest.node)?.name ?? tightest.node} with only ` +
        `${tightest.gapMin} minutes, below the ${input.minTransferMin}-minute minimum.`
      )
    }
  }

  const clockRuns = journeysFromLabels(relaxed.withClock.get(destId))
  if (clockRuns.length > 0) {
    // Name the latest first-departure still on offer — for the demo this is
    // exactly the connection whose expiry stranded the destination.
    let lastDepart = clockRuns[0]!
    for (const j of clockRuns) {
      if (j.departAt > lastDepart.departAt) lastDepart = j
    }
    return (
      `Unreachable — the last departure that could reach ${name} left ` +
      `${data.locationById.get(input.originId)?.name ?? input.originId} at ` +
      `${formatIst(lastDepart.departAt)} (${lastDepart.legs[0]!.connId}), ` +
      `before the current simulation time ${formatIst(input.now)}.`
    )
  }

  return `Unreachable — no chain of scheduled departures reaches ${name} on the reference-day timetable.`
}
