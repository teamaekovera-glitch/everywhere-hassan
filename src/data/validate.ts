import { INTEREST_IDS, MEAL_SLOTS, MODES } from './types'
import type { ActivityDef } from './activities'
import type { MealDef } from './meals'
import type { SpotDef } from './spots'
import type { Connection, InterestId, Location, Mode, TransportData } from './types'

/** Thrown when the timetable is internally inconsistent. Lists every problem found. */
export class DatasetValidationError extends Error {
  readonly problems: readonly string[]

  constructor(problems: readonly string[], label = 'transport dataset') {
    super(`Invalid ${label}:\n- ${problems.join('\n- ')}`)
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

/** The three POI catalogs as one validation unit — the planner consumes them together. */
export interface PoiCatalogInput {
  readonly activities: readonly ActivityDef[]
  readonly meals: readonly MealDef[]
  readonly spots: readonly SpotDef[]
}

const DURATION_MIN_MIN = 15
const DURATION_MAX_MIN = 240
const DAY_END_MIN = 24 * 60

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

/**
 * Refuses an internally inconsistent POI catalog (activities, meals, spots):
 * duplicate ids, unknown destination ids, negative costs, out-of-range
 * durations, unordered meal windows, and destinations left without a food
 * option or fewer than three interest categories. Same contract as
 * validateDataset — every problem collected, one throw.
 *
 * Coverage rule: a meal counts as the destination's food interest (it is a
 * food offering), so '≥ 3 categories covered' is satisfied by activity
 * categories plus food when any meal exists.
 */
export function validatePoiCatalog(
  catalog: PoiCatalogInput,
  locations: readonly Location[],
): void {
  const problems: string[] = []
  const locationIds = new Set(locations.map((loc) => loc.id))
  const ids = new Set<string>()

  const claimId = (id: string, kind: string): boolean => {
    if (typeof id !== 'string' || id.length === 0) {
      problems.push(`found a ${kind} with an empty id`)
      return false
    }
    if (ids.has(id)) {
      problems.push(`duplicate ${kind} id '${id}'`)
      return false
    }
    ids.add(id)
    return true
  }
  const claimDestination = (destinationId: string, id: string): void => {
    if (!locationIds.has(destinationId)) {
      problems.push(`${id} references unknown destination '${destinationId}'`)
    }
  }
  const claimCost = (costINR: number, id: string): void => {
    if (!Number.isFinite(costINR) || costINR < 0) {
      problems.push(`${id} has negative or non-finite cost ${costINR}`)
    }
  }
  const claimText = (text: string, field: string, id: string): void => {
    if (typeof text !== 'string' || text.length === 0) {
      problems.push(`${id} has an empty ${field}`)
    }
  }

  for (const activity of catalog.activities) {
    if (!claimId(activity.id, 'activity')) continue
    claimDestination(activity.destinationId, activity.id)
    if (!INTEREST_IDS.includes(activity.category)) {
      problems.push(`activity '${activity.id}' has unknown category '${String(activity.category)}'`)
    }
    claimCost(activity.costINR, activity.id)
    if (
      !Number.isFinite(activity.durationMin) ||
      activity.durationMin < DURATION_MIN_MIN ||
      activity.durationMin > DURATION_MAX_MIN
    ) {
      problems.push(
        `activity '${activity.id}' has duration ${activity.durationMin} outside ${DURATION_MIN_MIN}–${DURATION_MAX_MIN} min`,
      )
    }
    claimText(activity.title, 'title', activity.id)
    claimText(activity.blurb, 'blurb', activity.id)
  }

  for (const meal of catalog.meals) {
    if (!claimId(meal.id, 'meal')) continue
    claimDestination(meal.destinationId, meal.id)
    claimCost(meal.costINR, meal.id)
    if (!MEAL_SLOTS.includes(meal.slot)) {
      problems.push(`meal '${meal.id}' has unknown slot '${String(meal.slot)}'`)
    }
    if (
      !Number.isFinite(meal.windowStartMin) ||
      !Number.isFinite(meal.windowEndMin) ||
      meal.windowStartMin < 0 ||
      meal.windowEndMin > DAY_END_MIN ||
      meal.windowStartMin >= meal.windowEndMin
    ) {
      problems.push(`meal '${meal.id}' has an unordered window (${meal.windowStartMin}–${meal.windowEndMin})`)
    }
    claimText(meal.name, 'name', meal.id)
    claimText(meal.blurb, 'blurb', meal.id)
  }

  for (const spot of catalog.spots) {
    if (!claimId(spot.id, 'spot')) continue
    claimDestination(spot.destinationId, spot.id)
    if (!Number.isFinite(spot.distanceKm) || spot.distanceKm < 0) {
      problems.push(`spot '${spot.id}' has negative or non-finite distance ${spot.distanceKm}`)
    }
    claimText(spot.name, 'name', spot.id)
    claimText(spot.blurb, 'blurb', spot.id)
  }

  for (const loc of locations) {
    const destinationActivities = catalog.activities.filter((a) => a.destinationId === loc.id)
    const destinationMeals = catalog.meals.filter((m) => m.destinationId === loc.id)
    if (destinationActivities.length === 0 && destinationMeals.length === 0) {
      problems.push(`destination '${loc.id}' has no activities or meals`)
      continue
    }
    const hasFood = destinationMeals.length > 0 ||
      destinationActivities.some((a) => a.category === 'food')
    if (!hasFood) {
      problems.push(`destination '${loc.id}' has neither a food activity nor a meal`)
    }
    const categories = new Set<InterestId>(destinationActivities.map((a) => a.category))
    if (destinationMeals.length > 0) categories.add('food')
    if (categories.size < 3) {
      problems.push(
        `destination '${loc.id}' covers only ${categories.size} interest categories (need ≥ 3)`,
      )
    }
  }

  if (problems.length > 0) throw new DatasetValidationError(problems, 'POI catalog')
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

export type { Connection, Location, Mode, TransportData, ActivityDef, MealDef, SpotDef }
