/** Transport modes the MVP schedules. */
export type Mode = 'train' | 'bus' | 'ferry'

export const MODES: readonly Mode[] = ['train', 'bus', 'ferry']

export interface Location {
  /** Stable id — 'kozhikode'; the field layout derives from it. */
  id: string
  /** Display name — 'Kozhikode'. */
  name: string
  /** 'Kerala' | 'Karnataka' | 'Tamil Nadu'. */
  region: string
  /** e.g. ['Beaches', 'Food'] — rail captions. */
  tags: string[]
}

/**
 * One scheduled run of one service on the reference day. Immutable.
 * All times are absolute epoch-ms on the reference day, Asia/Kolkata
 * (UTC+05:30, no DST — see referenceDay.ts).
 */
export interface Connection {
  /** Stable across builds — 'TRN-16649-KZK-THR'. */
  id: string
  from: string
  to: string
  mode: Mode
  /** Epoch-ms on the reference day. */
  depart: number
  /** Strictly greater than depart — enforced by the dataset validator. */
  arrive: number
  /** Synthetic estimated fare, always ≥ 0. */
  costINR: number
  /** 'Mangaluru Express' — shown in route breakdowns. */
  label: string
}

/**
 * The validated, indexed transport dataset the engine consumes.
 * Built by `loadTransportData`, which refuses internally inconsistent input.
 */
export interface TransportData {
  readonly locations: readonly Location[]
  readonly connections: readonly Connection[]
  readonly locationById: ReadonlyMap<string, Location>
  /** Connections at `node` departing at or after `afterMs`, in departure order. */
  nextDepartures(node: string, afterMs: number): Connection[]
  connectionById(id: string): Connection | undefined
}
