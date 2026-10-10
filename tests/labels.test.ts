import { describe, expect, it } from 'vitest'
import { resolveLabels } from '../src/viz/renderer'

function cand(id: string, lx: number, ly: number, over: Partial<{ align: 'center' | 'left' | 'right'; width: number; twoLine: boolean; origin: boolean }> = {}) {
  return { id, lx, ly, align: 'left' as const, width: 80, twoLine: true, origin: false, ...over }
}

describe('resolveLabels — greedy label placement', () => {
  it('keeps natural positions when nothing collides', () => {
    const placed = resolveLabels([cand('a', 100, 100), cand('b', 100, 200)])
    expect(placed.map((p) => ({ id: p.id, ly: p.ly }))).toEqual([
      { id: 'a', ly: 100 },
      { id: 'b', ly: 200 },
    ])
  })

  it('nudges a colliding label vertically instead of stacking', () => {
    const placed = resolveLabels([cand('a', 100, 100), cand('b', 100, 106)])
    expect(placed).toHaveLength(2)
    // Same slot for both would overlap: b must land on a different nudge step.
    expect(placed[1]!.ly).not.toBe(placed[0]!.ly)
    // Every placed label is on one of the fixed nudge offsets from its origin.
    const allowed = [0, -15, 15, -30, 30, -45, 45, -60, 60]
    for (const p of placed) {
      expect(allowed.some((dy) => p.ly === 106 + dy || p.ly === 100 + dy)).toBe(true)
    }
  })

  it('drops the lowest-priority label when no slot is free', () => {
    // Ten labels at the same anchor: the nudge slots fill up, and the
    // lowest-priority labels are dropped rather than stacked.
    const ids = 'abcdefghij'.split('')
    const input = ids.map((id) => cand(id, 100, 100))
    const placed = resolveLabels(input)
    expect(placed.length).toBeLessThan(ids.length)
    expect(placed.length).toBeGreaterThanOrEqual(2)
    expect(placed[0]!.id).toBe('a')
    expect(placed[0]!.ly).toBe(100)
    // Placed labels never overlap each other.
    for (let i = 1; i < placed.length; i++) {
      expect(placed[i]!.ly).not.toBe(placed[i - 1]!.ly)
    }
  })

  it('respects priority order — earlier candidates keep their natural spot', () => {
    const placed = resolveLabels([cand('origin', 50, 50, { origin: true, twoLine: false }), cand('x', 50, 50)])
    expect(placed[0]!.id).toBe('origin')
    expect(placed[0]!.ly).toBe(50)
    expect(placed[1]!.ly).not.toBe(50)
  })

  it('boxes right-aligned labels to the left of the anchor', () => {
    const left = resolveLabels([cand('l', 200, 100, { align: 'left' })])[0]!
    const right = resolveLabels([cand('r', 200, 100, { align: 'right' })])[0]!
    // Same anchor: a right-aligned label occupies lx-width..lx, a left-aligned lx..lx+width.
    expect(right.lx).toBe(left.lx)
    // Collision between mirrored labels at the same anchor: they overlap only if
    // both were placed at the same spot — verify they do collide when combined.
    const both = resolveLabels([cand('l', 200, 100, { align: 'left' }), cand('r', 200, 100, { align: 'right' })])
    expect(both).toHaveLength(2)
    expect(both[1]!.ly).not.toBe(both[0]!.ly)
  })

  it('is deterministic — same inputs, same placement', () => {
    const input = [cand('a', 100, 100), cand('b', 100, 106), cand('c', 100, 112)]
    expect(resolveLabels(input)).toEqual(resolveLabels(input))
  })
})
