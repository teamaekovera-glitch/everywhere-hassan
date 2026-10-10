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
  /**
   * Real-world latitude in decimal degrees (WGS84). Unlike the synthetic
   * timetable, these are factual geography — the map and planner consume
   * them; the bounding-box validator refuses typos at load.
   */
  lat: number
  /** Real-world longitude in decimal degrees (WGS84). */
  lon: number
}

/**
 * The seven planner interest categories, in canonical display order.
 * The planner ranks by these; the POI catalog is tagged with them.
 */
export type InterestId =
  | 'food'
  | 'heritage'
  | 'nightlife'
  | 'adventure'
  | 'shopping'
  | 'nature'
  | 'movies'

export const INTEREST_IDS: readonly InterestId[] = [
  'food',
  'heritage',
  'nightlife',
  'adventure',
  'shopping',
  'nature',
  'movies',
]

/** Which meal slot a service window belongs to. */
export type MealSlot = 'breakfast' | 'lunch' | 'evening'

export const MEAL_SLOTS: readonly MealSlot[] = ['breakfast', 'lunch', 'evening']

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
