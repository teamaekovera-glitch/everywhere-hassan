import { describe, expect, it } from 'vitest'
import { SHORT_TRIP_MAX_MIN, matchesTab } from '../src/components/destinationImages'

describe('destination tab classification', () => {
  it('puts every duration in the all tab', () => {
    for (const min of [0, 30, 240, 241, 480, 730]) {
      expect(matchesTab('all', min)).toBe(true)
    }
  })

  it('classifies exactly 4 hours as a short trip (inclusive boundary)', () => {
    expect(matchesTab('short', SHORT_TRIP_MAX_MIN)).toBe(true)
    expect(matchesTab('long', SHORT_TRIP_MAX_MIN)).toBe(false)
  })

  it('classifies one minute past 4 hours as a long trip', () => {
    expect(matchesTab('short', SHORT_TRIP_MAX_MIN + 1)).toBe(false)
    expect(matchesTab('long', SHORT_TRIP_MAX_MIN + 1)).toBe(true)
  })

  it('splits the demo duration range cleanly', () => {
    // Kannur is the spec's short-trip poster child; Bengaluru its long one.
    expect(matchesTab('short', 130)).toBe(true) // 2h 10m
    expect(matchesTab('long', 570)).toBe(true) // 9h 30m
  })
})
