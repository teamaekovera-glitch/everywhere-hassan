/**
 * Map resilience (planner spec): the route map is the one networked surface,
 * so its failure path is pure logic — a debounced tile-failure counter and a
 * threshold test — kept out of the Leaflet component so the node-env tests
 * can exercise it without jsdom or tile mocks.
 */

/**
 * Sustained-failure threshold: a blocked or dead tile server fails every
 * tile in the viewport at once, while a transient hiccup fails one or two
 * before any success arrives. Six consecutive failures with no successful
 * load in between is the documented "sustained" signal.
 */
export const SCHEMATIC_TILE_FAILURE_THRESHOLD = 6

/** The two tile-layer events the debouncing counts. */
export type TileEvent = 'error' | 'load'

/**
 * One step of the debounce: a failed tile increments the counter; ANY
 * successful tile load resets it to zero — a single flaky tile among good
 * ones never trips the fallback, but a blocked domain accumulates without
 * bound. Pure: the component owns no clock for this logic.
 */
export function nextFailureCount(current: number, event: TileEvent): number {
  return event === 'load' ? 0 : current + 1
}

/** The fallback trigger: sustained tile failure (at or above the threshold). */
export function shouldShowSchematic(failureCount: number): boolean {
  return failureCount >= SCHEMATIC_TILE_FAILURE_THRESHOLD
}
