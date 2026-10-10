import { describe, expect, it } from 'vitest'
import { at, REFERENCE_DAY_START_MS } from '../src/data/referenceDay'
import {
  DEFAULT_NOW_MS,
  SIM_WINDOW_END_MS,
  SIM_WINDOW_SPAN_MS,
  SIM_WINDOW_START_MS,
  clampToSimWindow,
  formatIst,
  formatIst12,
  istParts,
  makeSimClockState,
  stepClock,
} from '../src/sim/clock'

describe('sim clock (deterministic, no wall time)', () => {
  it('formats reference-day IST times', () => {
    expect(formatIst(at(0, 0))).toBe('00:00')
    expect(formatIst(at(6, 0))).toBe('06:00')
    expect(formatIst(at(12, 0))).toBe('12:00')
    expect(formatIst(at(18, 5))).toBe('18:05')
  })

  it('marks next-day times with a (+1d) suffix', () => {
    expect(formatIst(at(24, 5))).toBe('00:05 (+1d)')
    expect(formatIst(at(25, 30))).toBe('01:30 (+1d)')
    expect(formatIst(at(28, 45))).toBe('04:45 (+1d)')
  })

  it('decomposes IST parts cleanly', () => {
    expect(istParts(at(18, 5))).toEqual({ dayOffset: 0, hours: 18, minutes: 5 })
    expect(istParts(at(25, 30))).toEqual({ dayOffset: 1, hours: 1, minutes: 30 })
  })

  it('maps the reference day to 2026-10-17T00:00 IST (UTC+05:30, no DST)', () => {
    // 2026-10-17T00:00 IST === 2026-10-16T18:30Z
    expect(REFERENCE_DAY_START_MS).toBe(Date.UTC(2026, 9, 16, 18, 30, 0))
  })

  it('spans 06:00 → 06:00 (+1d), exactly 24 hours', () => {
    expect(formatIst(SIM_WINDOW_START_MS)).toBe('06:00')
    expect(formatIst(SIM_WINDOW_END_MS)).toBe('06:00 (+1d)')
    expect(SIM_WINDOW_SPAN_MS).toBe(24 * 60 * 60_000)
  })

  it('clamps and steps inside the window', () => {
    expect(clampToSimWindow(at(3, 0))).toBe(SIM_WINDOW_START_MS)
    expect(clampToSimWindow(at(31, 0))).toBe(SIM_WINDOW_END_MS)
    expect(stepClock(at(12, 0), 15)).toBe(at(12, 15))
    expect(stepClock(at(12, 0), -15)).toBe(at(11, 45))
    expect(stepClock(at(29, 30), 60)).toBe(SIM_WINDOW_END_MS)
    expect(stepClock(at(6, 0), -15)).toBe(SIM_WINDOW_START_MS)
  })

  it('seeds the demo clock at 12:00 IST, paused', () => {
    expect(makeSimClockState()).toEqual({
      nowMs: DEFAULT_NOW_MS,
      playing: false,
      speedMultiplier: 1,
    })
    expect(formatIst(DEFAULT_NOW_MS)).toBe('12:00')
  })

  it('formats 12-hour clock times for the timeline cursor and ticks', () => {
    expect(formatIst12(at(0, 5))).toBe('12:05 AM')
    expect(formatIst12(at(6, 0))).toBe('6:00 AM')
    expect(formatIst12(DEFAULT_NOW_MS)).toBe('12:00 PM')
    expect(formatIst12(at(12, 0))).toBe('12:00 PM')
    expect(formatIst12(at(18, 5))).toBe('6:05 PM')
    expect(formatIst12(at(24, 30))).toBe('12:30 AM (+1d)')
  })
})
