import type { DestinationResult, Journey } from '../engine/types'

/**
 * Semantic colour states (locked by the spec): blue = near/cheap/short,
 * violet = moderate, amber = long/expensive/late, grey = unavailable.
 * Thresholds are on the fastest journey duration.
 */
export type NodeState = 'near' | 'mid' | 'far' | 'unavailable'

/** Duration bands in minutes: ≤ 4 h near, ≤ 8 h mid, else far. */
export const NEAR_MAX_MIN = 4 * 60
export const MID_MAX_MIN = 8 * 60

/**
 * The radius scale: 2 h journeys sit on the inner ring, 12 h at the rim
 * (spec's layoutField). Ghosts pin to the rim band regardless of duration.
 */
const INNER_FRACTION = 0.22
const RIM_MIN = 12 * 60

export interface FieldNode {
  id: string
  name: string
  region: string
  tags: string[]
  /** Deterministic polar placement — same id, same angle, forever. */
  angle: number
  radius: number
  x: number
  y: number
  state: NodeState
  reachable: boolean
  /** Fastest computed journey duration in minutes (0 for ghosts). */
  fastestMin: number
  /** Cheapest computed fare, null for ghosts. */
  cheapestINR: number | null
  roundTripAvailable: boolean
  /** Engine-generated explanation (hover/tooltip and details panel). */
  reason: string
  /** The nondominated set for this destination — the streams grow from these. */
  journeys: Journey[]
}

export interface FieldLayout {
  /** Centre of the field — the origin node sits here. */
  cx: number
  cy: number
  rMax: number
  nodes: FieldNode[]
}

/** FNV-1a 32-bit — stable across builds, no Math.random, no Date. */
export function hashId(id: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

const GOLDEN_ANGLE = 2.399963229728653 // radians; spreads consecutive hashes

/**
 * Each destination's polar angle is a stable hash of its id (spec). The
 * golden-angle multiple spreads the 18 ids around the circle without
 * clustering, and depends on the id alone — nodes never jump when other
 * destinations grey out or return.
 */
export function stableAngle(id: string): number {
  return (hashId(id) * GOLDEN_ANGLE) % (Math.PI * 2)
}

export function stateOf(result: DestinationResult): NodeState {
  const fastest = fastestDurationMin(result)
  if (fastest <= NEAR_MAX_MIN) return 'near'
  if (fastest <= MID_MAX_MIN) return 'mid'
  return 'far'
}

function fastestDurationMin(result: DestinationResult): number {
  let min = Number.POSITIVE_INFINITY
  for (const j of result.journeys) {
    const d = (j.arriveAt - j.departAt) / 60_000
    if (d < min) min = d
  }
  return min
}

function cheapestFare(result: DestinationResult): number | null {
  return result.best ? result.best.costINR : null
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

/**
 * Deterministic field layout (spec): the origin at the centre, each
 * destination's angle a stable hash of its id, its radius encoding the
 * fastest computed journey duration, and unreachable destinations pinned
 * to the outer ghost band. Same results, same size → deep-equal layout.
 */
export function layoutField(results: readonly DestinationResult[], w: number, h: number): FieldLayout {
  const cx = w / 2
  const cy = h / 2
  const rMax = Math.min(w, h) * 0.4

  const nodes = results.map((r) => {
    const angle = stableAngle(r.location.id)
    const ghost = !r.reachable
    const fastestMin = ghost ? 0 : fastestDurationMin(r)
    const radius = ghost
      ? rMax // expired nodes retreat to the pinned outer band
      : rMax * (INNER_FRACTION + (1 - INNER_FRACTION) * clamp01(fastestMin / RIM_MIN))
    return {
      id: r.location.id,
      name: r.location.name,
      region: r.location.region,
      tags: r.location.tags,
      angle,
      radius,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      state: ghost ? 'unavailable' : stateOf(r),
      reachable: r.reachable,
      fastestMin,
      cheapestINR: cheapestFare(r),
      roundTripAvailable: r.roundTrip !== null,
      reason: r.reason,
      journeys: r.journeys,
    }
  })

  return { cx, cy, rMax, nodes }
}

// ---- category hues ---------------------------------------------------------

/**
 * The nebula's category hues (mockup): the destination's first tag picks a
 * hue family — azure seas, green-teal hills, violet heritage, amber city
 * lights, cyan backwaters. Unknown tags fall back to the field's blue.
 * Pure: same tags, same hue, every time.
 */
export type CategoryHue = 'azure' | 'teal' | 'violet' | 'amber' | 'cyan' | 'blue'

const FIRST_TAG_HUES: Record<string, CategoryHue> = {
  Beaches: 'azure',
  Coast: 'azure',
  Hills: 'teal',
  Nature: 'teal',
  Tea: 'teal',
  Coffee: 'teal',
  Heritage: 'violet',
  Temples: 'violet',
  History: 'violet',
  Culture: 'violet',
  Palaces: 'violet',
  City: 'amber',
  Food: 'amber',
  Harbour: 'amber',
  Backwaters: 'cyan',
}

export function categoryHue(tags: readonly string[]): CategoryHue {
  return FIRST_TAG_HUES[tags[0] ?? ''] ?? 'blue'
}

/** CSS custom property per hue — the DOM surfaces (cards, sparks) read these. */
export const HUE_CSS_VAR: Record<CategoryHue, string> = {
  azure: 'var(--hue-azure)',
  teal: 'var(--hue-teal)',
  violet: 'var(--hue-violet)',
  amber: 'var(--hue-amber)',
  cyan: 'var(--hue-cyan)',
  blue: 'var(--hue-blue)',
}

/** Canvas RGB per hue — the renderer paints these (additive blending). */
export const HUE_RGB: Record<CategoryHue, readonly [number, number, number]> = {
  azure: [77, 166, 255],
  teal: [47, 212, 165],
  violet: [155, 123, 255],
  amber: [240, 162, 74],
  cyan: [56, 200, 240],
  blue: [91, 140, 255],
}
