import type { Connection, TransportData } from '../data/types'
import { HOUR_MS, MINUTE_MS } from '../data/referenceDay'
import { MinHeap } from './heap'

/**
 * One Pareto label: standing at `node` at `arrival` having spent `cost`.
 * `via`/`back` are null only for the origin label.
 */
export interface Label {
  node: string
  arrival: number
  cost: number
  via: Connection | null
  back: Label | null
}

export interface SearchInput {
  originId: string
  now: number
  budgetINR: number
  /** Absolute epoch-ms the journey must be complete by. */
  deadline: number
  minTransferMin: number
}

export interface SearchOptions {
  /**
   * Counterfactual runs: pretend these connections no longer exist.
   * Powers the alerts ("missing this departure removes N options").
   */
  excludeConnectionIds?: readonly string[]
}

/** Strict dominance: an existing label must beat-or-equal BOTH axes and win one. */
function dominated(bucket: Label[], l: Label): boolean {
  return bucket.some(
    (e) => e.arrival <= l.arrival && e.cost <= l.cost && (e.arrival < l.arrival || e.cost < l.cost),
  )
}

function offer(labels: Map<string, Label[]>, queue: MinHeap<Label>, l: Label): void {
  const bucket = labels.get(l.node)
  if (bucket) {
    if (dominated(bucket, l)) return
    // Drop existing labels the new one dominates — insertion order must not
    // decide what survives (a worse-on-both-axes label can arrive first).
    for (let i = bucket.length - 1; i >= 0; i--) {
      const e = bucket[i]!
      if (l.arrival <= e.arrival && l.cost <= e.cost && (l.arrival < e.arrival || l.cost < e.cost)) {
        bucket.splice(i, 1)
      }
    }
    bucket.push(l)
  } else {
    labels.set(l.node, [l])
  }
  queue.push(l)
}

function compareLabels(a: Label, b: Label): number {
  return (
    a.arrival - b.arrival ||
    a.cost - b.cost ||
    (a.node < b.node ? -1 : a.node > b.node ? 1 : 0)
  )
}

/**
 * Multilabel time-dependent search over (arrival, cost). Expands departures
 * in time order from per-node sorted timetables; budget and deadline prune
 * branches; the minimum transfer gates every connection change (boarding at
 * the origin needs no transfer). Pure and deterministic: the clock is a
 * parameter — no Date.now(), no Math.random(), no dataset mutation.
 */
export function searchFrom(
  data: TransportData,
  input: SearchInput,
  options: SearchOptions = {},
): Map<string, Label[]> {
  if (!data.locationById.has(input.originId)) {
    throw new Error(`unknown origin '${input.originId}'`)
  }

  const excluded =
    options.excludeConnectionIds && options.excludeConnectionIds.length > 0
      ? new Set(options.excludeConnectionIds)
      : null
  const transferMs = input.minTransferMin * MINUTE_MS

  const labels = new Map<string, Label[]>()
  const queue = new MinHeap<Label>(compareLabels)
  offer(labels, queue, { node: input.originId, arrival: input.now, cost: 0, via: null, back: null })

  while (queue.size > 0) {
    const l = queue.pop()!
    // Board every connection at l.node departing ≥ arrival + transfer; the
    // origin label (via === null) boards immediately at the clock.
    const boardAt = l.via === null ? l.arrival : l.arrival + transferMs
    for (const conn of data.nextDepartures(l.node, boardAt)) {
      if (excluded?.has(conn.id)) continue
      const cost = l.cost + conn.costINR
      if (cost > input.budgetINR) continue // budget prunes the branch
      if (conn.arrive > input.deadline) continue // deadline prunes the branch
      offer(labels, queue, { node: conn.to, arrival: conn.arrive, cost, via: conn, back: l })
    }
  }

  return labels
}

export function deadlineOf(now: number, availableHours: number): number {
  return now + availableHours * HOUR_MS
}
