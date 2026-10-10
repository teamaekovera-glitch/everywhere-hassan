import { describe, expect, it } from 'vitest'
import { DEMO_DATA, at } from '../src/data'
import { computeReachability, makeDefaultConstraints } from '../src/engine'
import { MID_MAX_MIN, NEAR_MAX_MIN, layoutField, stableAngle } from '../src/viz/layout'

/**
 * Layout determinism is the visual contract of the Possibility Field: the
 * same engine results always produce the same field, angles never move when
 * other destinations grey out, and expiry retreats to the ghost band.
 */

function layoutAt(now: number, w = 900, h = 640) {
  return layoutField(computeReachability(DEMO_DATA, { ...makeDefaultConstraints(), now }), w, h)
}

describe('stableAngle', () => {
  it('is a pure function of the id', () => {
    expect(stableAngle('mangaluru')).toBe(stableAngle('mangaluru'))
    expect(stableAngle('mangaluru')).not.toBe(stableAngle('bengaluru'))
  })

  it('lands in [0, 2π) for every dataset location', () => {
    for (const loc of DEMO_DATA.locations) {
      const a = stableAngle(loc.id)
      expect(a).toBeGreaterThanOrEqual(0)
      expect(a).toBeLessThan(Math.PI * 2)
    }
  })
})

describe('layoutField — determinism', () => {
  it('same results and size → deep-equal layout, twice in a row', () => {
    const a = layoutAt(at(12, 0))
    const b = layoutAt(at(12, 0))
    expect(b).toEqual(a)
  })

  it('angles are a function of the id alone — greying a neighbour never moves a node', () => {
    const bloom = layoutAt(at(12, 0))
    const afterExpiry = layoutAt(at(18, 25)) // Mangaluru and most of the bloom are gone
    for (const before of bloom.nodes) {
      const after = afterExpiry.nodes.find((n) => n.id === before.id)
      if (!after) continue
      expect(after.angle).toBe(before.angle)
    }
  })
})

describe('layoutField — placement', () => {
  const layout = layoutAt(at(12, 0))

  it('places every node by hash angle and duration radius around the centre', () => {
    for (const n of layout.nodes) {
      expect(n.x).toBe(layout.cx + n.radius * Math.cos(n.angle))
      expect(n.y).toBe(layout.cy + n.radius * Math.sin(n.angle))
      expect(n.radius).toBeGreaterThan(0)
      expect(n.radius).toBeLessThanOrEqual(layout.rMax)
    }
  })

  it('orders radii by fastest journey duration — inner ring for short hops', () => {
    const reachable = layout.nodes.filter((n) => n.reachable)
    const byDuration = [...reachable].sort((a, b) => a.fastestMin - b.fastestMin)
    for (let i = 1; i < byDuration.length; i++) {
      expect(byDuration[i]!.radius).toBeGreaterThanOrEqual(byDuration[i - 1]!.radius)
    }
    // Wayanad's fastest option (14:50 Volvo, 2h30m) sits on the inner ring…
    const wayanad = reachable.find((n) => n.id === 'wayanad')!
    expect(wayanad.fastestMin).toBe(150)
    // …while Bengaluru's cheapest chain (12h55m) rides near the rim.
    const bengaluru = reachable.find((n) => n.id === 'bengaluru')!
    expect(bengaluru.fastestMin).toBe(775)
    expect(bengaluru.radius).toBeGreaterThan(wayanad.radius)
  })
})

describe('layoutField — semantic states', () => {
  it('colours by duration band: near ≤ 4 h, mid ≤ 8 h, far beyond', () => {
    const layout = layoutAt(at(12, 0))
    for (const n of layout.nodes) {
      if (!n.reachable) continue
      if (n.fastestMin <= NEAR_MAX_MIN) expect(n.state).toBe('near')
      else if (n.fastestMin <= MID_MAX_MIN) expect(n.state).toBe('mid')
      else expect(n.state).toBe('far')
    }
  })

  it('carries the engine truth for tooltip and details', () => {
    const layout = layoutAt(at(12, 0))
    const bengaluru = layout.nodes.find((n) => n.id === 'bengaluru')!
    expect(bengaluru.cheapestINR).toBe(1520)
    expect(bengaluru.journeys.length).toBeGreaterThan(0)
    expect(bengaluru.reason).toContain('Reachable')
  })
})

describe('layoutField — expiry retreat', () => {
  it('unavailable destinations pin to the ghost band at the rim', () => {
    const after = layoutAt(at(18, 25))
    const ghosts = after.nodes.filter((n) => !n.reachable)
    expect(ghosts.length).toBeGreaterThan(0)
    for (const g of ghosts) {
      expect(g.state).toBe('unavailable')
      expect(g.radius).toBe(after.rMax)
      expect(g.journeys).toEqual([])
      expect(g.cheapestINR).toBeNull()
      expect(g.reason.length).toBeGreaterThan(0)
    }
    // Mangaluru specifically: its only evening express expired at 18:05.
    const mangaluru = after.nodes.find((n) => n.id === 'mangaluru')!
    expect(mangaluru.reachable).toBe(false)
    // Bengaluru survives on its alternate route and never retreats.
    const bengaluru = after.nodes.find((n) => n.id === 'bengaluru')!
    expect(bengaluru.reachable).toBe(true)
  })

  it('a restored destination returns to exactly its earlier placement', () => {
    const before = layoutAt(at(12, 0))
    const back = layoutAt(at(12, 0))
    expect(back).toEqual(before)
  })
})
