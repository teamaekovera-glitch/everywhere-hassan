import { MODES } from './types'
import type { Connection, Location, Mode, TransportData } from './types'

/** Thrown when the timetable is internally inconsistent. Lists every problem found. */
export class DatasetValidationError extends Error {
  readonly problems: readonly string[]

  constructor(problems: readonly string[]) {
    super(`Invalid transport dataset:\n- ${problems.join('\n- ')}`)
    this.name = 'DatasetValidationError'
    this.problems = [...problems]
  }
}

/**
 * Rough South-India bounding box for the demo dataset. Location lat/lon are
 * real geography, so a coordinate typo (a decimal dropped, a sea position)
 * must fail loudly at load rather than render a map pin in the ocean.
 */
const LAT_MIN = 8
const LAT_MAX = 22
const LON_MIN = 72
const LON_MAX = 80

/**
 * Refuses internally inconsistent timetables: depart ≥ arrive, negative
 * costs, duplicate location/connection ids, unknown nodes, bad modes.
 * Throws DatasetValidationError listing all problems at once.
 */
export function validateDataset(
  locations: readonly Location[],
  connections: readonly Connection[],
): void {
  const problems: string[] = []

  const locationIds = new Set<string>()
  for (const loc of locations) {
    if (typeof loc.id !== 'string' || loc.id.length === 0) {
      problems.push('found a location with an empty id')
      continue
    }
    if (locationIds.has(loc.id)) problems.push(`duplicate location id '${loc.id}'`)
    locationIds.add(loc.id)
    if (typeof loc.name !== 'string' || loc.name.length === 0) {
      problems.push(`location '${loc.id}' has an empty name`)
    }
    if (!Number.isFinite(loc.lat) || loc.lat < LAT_MIN || loc.lat > LAT_MAX) {
      problems.push(
        `location '${loc.id}' has latitude ${loc.lat} outside the dataset bounding box (${LAT_MIN}–${LAT_MAX}°N)`,
      )
    }
    if (!Number.isFinite(loc.lon) || loc.lon < LON_MIN || loc.lon > LON_MAX) {
      problems.push(
        `location '${loc.id}' has longitude ${loc.lon} outside the dataset bounding box (${LON_MIN}–${LON_MAX}°E)`,
      )
    }
  }

  const connectionIds = new Set<string>()
  for (const conn of connections) {
    if (connectionIds.has(conn.id)) problems.push(`duplicate connection id '${conn.id}'`)
    connectionIds.add(conn.id)

    if (!locationIds.has(conn.from)) {
      problems.push(`connection '${conn.id}' departs from unknown node '${conn.from}'`)
    }
    if (!locationIds.has(conn.to)) {
      problems.push(`connection '${conn.id}' arrives at unknown node '${conn.to}'`)
    }
    if (!(conn.arrive > conn.depart)) {
      problems.push(`connection '${conn.id}' must satisfy arrive > depart`)
    }
    if (!(conn.costINR >= 0)) {
      problems.push(`connection '${conn.id}' has negative cost ${conn.costINR}`)
    }
    if (!MODES.includes(conn.mode)) {
      problems.push(`connection '${conn.id}' has unknown mode '${String(conn.mode)}'`)
    }
  }

  if (problems.length > 0) throw new DatasetValidationError(problems)
}

function compareDeparture(a: Connection, b: Connection): number {
  return a.depart - b.depart || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

/**
 * Validates the dataset and builds the indexed view the engine consumes:
 * per-node departure timetables sorted once at load and binary-searched on
 * every expansion.
 */
export function loadTransportData(
  locations: readonly Location[],
  connections: readonly Connection[],
): TransportData {
  validateDataset(locations, connections)

  const departuresByNode = new Map<string, Connection[]>()
  for (const conn of connections) {
    const bucket = departuresByNode.get(conn.from)
    if (bucket) bucket.push(conn)
    else departuresByNode.set(conn.from, [conn])
  }
  for (const bucket of departuresByNode.values()) {
    bucket.sort(compareDeparture)
  }

  const connectionById = new Map<string, Connection>()
  for (const conn of connections) connectionById.set(conn.id, conn)

  const locationById = new Map<string, Location>()
  for (const loc of locations) locationById.set(loc.id, loc)

  return {
    locations,
    connections,
    locationById,
    nextDepartures(node: string, afterMs: number): Connection[] {
      const bucket = departuresByNode.get(node)
      if (!bucket) return []
      // Lower-bound binary search on depart.
      let lo = 0
      let hi = bucket.length
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (bucket[mid]!.depart < afterMs) lo = mid + 1
        else hi = mid
      }
      return bucket.slice(lo)
    },
    connectionById(id: string): Connection | undefined {
      return connectionById.get(id)
    },
  }
}

export type { Connection, Location, Mode, TransportData }
