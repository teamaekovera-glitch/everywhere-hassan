/**
 * The simulated reference day. All engine times are epoch-ms on this day
 * expressed in Asia/Kolkata (UTC+05:30 — India has no DST), so the mapping
 * between IST clock time and epoch-ms is pure arithmetic: no wall time,
 * no locale parsing, fully deterministic.
 */
export const IST_OFFSET_MINUTES = 330
export const REFERENCE_DAY_ISO = '2026-10-17'

/** 2026-10-17T00:00:00 IST === 2026-10-16T18:30:00Z */
export const REFERENCE_DAY_START_MS = Date.UTC(2026, 9, 16, 18, 30, 0)

export const MINUTE_MS = 60_000
export const HOUR_MS = 3_600_000

/** Epoch-ms for `minutesFromMidnight` IST on the reference day (may exceed 1440 for next-day times). */
export function ist(minutesFromMidnight: number): number {
  return REFERENCE_DAY_START_MS + minutesFromMidnight * MINUTE_MS
}

/** Epoch-ms for HH:MM IST on the reference day; hours may exceed 24 for next-day times. */
export function at(hours: number, minutes = 0): number {
  return ist(hours * 60 + minutes)
}
