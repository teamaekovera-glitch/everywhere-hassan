import { MINUTE_MS, REFERENCE_DAY_ISO, REFERENCE_DAY_START_MS } from '../data/referenceDay'

export { MINUTE_MS, REFERENCE_DAY_ISO, REFERENCE_DAY_START_MS }

/**
 * The simulation timeline window: 06:00 IST reference day → 06:00 IST next
 * day (spec). Every clock value the UI scrubs to is clamped inside it.
 */
export const SIM_WINDOW_START_MS = REFERENCE_DAY_START_MS + 6 * 60 * MINUTE_MS
export const SIM_WINDOW_END_MS = REFERENCE_DAY_START_MS + 30 * 60 * MINUTE_MS
export const SIM_WINDOW_SPAN_MS = SIM_WINDOW_END_MS - SIM_WINDOW_START_MS

/** Where the demo clock starts: 12:00 IST. */
export const DEFAULT_NOW_MS = REFERENCE_DAY_START_MS + 12 * 60 * MINUTE_MS

export interface IstParts {
  /** 0 = reference day, 1 = next day. */
  dayOffset: number
  hours: number
  minutes: number
}

/** Pure IST wall-clock decomposition — no Date objects, no locale, no wall time. */
export function istParts(ms: number): IstParts {
  const totalMinutes = Math.floor((ms - REFERENCE_DAY_START_MS) / MINUTE_MS)
  const dayOffset = Math.floor(totalMinutes / 1440)
  const within = totalMinutes - dayOffset * 1440
  return { dayOffset, hours: Math.floor(within / 60), minutes: within % 60 }
}

/** '12:00' on the reference day, '04:45 (+1d)' the next. */
export function formatIst(ms: number): string {
  const { dayOffset, hours, minutes } = istParts(ms)
  const hh = String(hours).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  return dayOffset > 0 ? `${hh}:${mm} (+${dayOffset}d)` : `${hh}:${mm}`
}

/** '12:00 PM' / '6 AM' (+1d suffix) — the timeline cursor and tick labels. */
export function formatIst12(ms: number): string {
  const { dayOffset, hours, minutes } = istParts(ms)
  const h12 = hours % 12 === 0 ? 12 : hours % 12
  const suffix = dayOffset > 0 ? ' (+1d)' : ''
  return `${h12}:${String(minutes).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}${suffix}`
}

export function clampToSimWindow(ms: number): number {
  return Math.min(SIM_WINDOW_END_MS, Math.max(SIM_WINDOW_START_MS, ms))
}

/** ±15-minute stepping for the timeline; the result stays inside the window. */
export function stepClock(nowMs: number, minutes: number): number {
  return clampToSimWindow(nowMs + minutes * MINUTE_MS)
}

/** Mutable-across-ticks state is owned by the store (PR 2); this is its shape + seed. */
export interface SimClockState {
  nowMs: number
  playing: boolean
  speedMultiplier: number
}

export function makeSimClockState(): SimClockState {
  return { nowMs: DEFAULT_NOW_MS, playing: false, speedMultiplier: 1 }
}
