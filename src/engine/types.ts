import type { Location } from '../data/types'

export interface Constraints {
  /** Where the traveller stands. */
  originId: string
  /** Simulation clock, epoch-ms on the reference day — a parameter, never wall time. */
  now: number
  /** Deadline = now + availableHours. */
  availableHours: number
  budgetINR: number
  /** Minimum connection-change time in minutes. Demo default: 20. */
  minTransferMin: number
}

export interface Leg {
  connId: string
  mode: 'train' | 'bus' | 'ferry'
  from: string
  to: string
  depart: number
  arrive: number
  costINR: number
}

export interface Journey {
  legs: Leg[]
  transfers: number
  costINR: number
  departAt: number
  arriveAt: number
}

export interface DestinationResult {
  location: Location
  reachable: boolean
  /** The nondominated set, departure-sorted. */
  journeys: Journey[]
  /** Cheapest, ties broken by earliest arrival. */
  best: Journey | null
  /** Engine-generated human explanation. */
  reason: string
  /** Valid return inside the deadline and remaining budget → day-trip badge. */
  roundTrip: Journey | null
  /** Connection whose loss strands this result (null when none does). */
  criticalConnId: string | null
}

/** Aggregate stats over one reachability snapshot — the stats panel reads these. */
export interface ReachabilitySummary {
  reachableCount: number
  totalJourneys: number
  roundTripCount: number
  cheapestFareINR: number | null
}
