import { hashId, type FieldNode, type NodeState } from './layout'
import { formatDuration } from './format'

/**
 * Canvas 2D renderer for the Possibility Field. Draws the engine's actual
 * itineraries: streams and particles flow along real journey legs, the
 * origin blooms at the centre, ghosts retreat to the rim band.
 *
 * Deterministic and presentational: positions arrive as targets from
 * layoutField; the renderer tweens toward them. The rAF loop idles whenever
 * nothing animates (reduced motion + settled tweens), and reduced motion
 * collapses every tween to an instant state change.
 */

type Rgb = readonly [number, number, number]

const STATE_COLORS: Record<NodeState, Rgb> = {
  near: [86, 168, 255],
  mid: [167, 139, 255],
  far: [255, 180, 94],
  unavailable: [110, 126, 152],
}

const ORIGIN_COLOR: Rgb = [190, 220, 255]
const BACKGROUND_TOP = '#04070f'
const BACKGROUND_CENTER = '#081226'
const LABEL_COLOR = 'rgba(215, 227, 244, 0.92)'

const TWEEN_RATE = 9 // exponential approach per second — settles in ~400 ms
const PICK_RADIUS = 16
const DPR_CAP = 2

interface AnimNode {
  target: FieldNode
  x: number
  y: number
  alpha: number
  color: Rgb
}

interface StreamSpec {
  key: string
  pts: { x: number; y: number }[]
  bows: number[]
  color: Rgb
  alpha: number
  particles: number
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function approach(current: number, target: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-dt * TWEEN_RATE))
}

function fract(n: number): number {
  return n - Math.floor(n)
}

/** Deterministic 0..1 fraction from an integer seed — no Math.random anywhere. */
function hashFraction(seed: number): number {
  return fract(hashId(String(seed)) / 0xffffffff)
}

export interface FieldRendererOptions {
  reducedMotion: boolean
}

export class FieldRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly anim = new Map<string, AnimNode>()

  private reducedMotion: boolean
  private cssW = 0
  private cssH = 0
  private cx = 0
  private cy = 0
  private rMax = 0
  private originId = ''
  private originName = 'Origin'
  private hoverId: string | null = null
  private selectedId: string | null = null
  private raf: number | null = null
  private lastTs = 0
  private time = 0

  constructor(canvas: HTMLCanvasElement, options: FieldRendererOptions) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')
    this.ctx = ctx
    this.reducedMotion = options.reducedMotion
  }

  // ---- lifecycle ---------------------------------------------------------

  destroy(): void {
    if (this.raf !== null) cancelAnimationFrame(this.raf)
    this.raf = null
  }

  // ---- inputs ------------------------------------------------------------

  resize(cssW: number, cssH: number): void {
    if (cssW === this.cssW && cssH === this.cssH) return
    this.cssW = cssW
    this.cssH = cssH
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP)
    this.canvas.width = Math.round(cssW * dpr)
    this.canvas.height = Math.round(cssH * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.ensureFrame()
  }

  setOrigin(id: string, name: string): void {
    this.originId = id
    this.originName = name
    this.ensureFrame()
  }

  /** New layout targets from layoutField — nodes tween toward them. */
  setTargets(layout: { cx: number; cy: number; rMax: number; nodes: FieldNode[] }): void {
    this.cx = layout.cx
    this.cy = layout.cy
    this.rMax = layout.rMax

    const seen = new Set<string>()
    for (const target of layout.nodes) {
      seen.add(target.id)
      const existing = this.anim.get(target.id)
      if (existing) {
        existing.target = target
      } else {
        // First appearance: fade in at its target position.
        this.anim.set(target.id, {
          target,
          x: target.x,
          y: target.y,
          alpha: 0,
          color: STATE_COLORS[target.state],
        })
      }
    }
    for (const id of [...this.anim.keys()]) {
      if (!seen.has(id)) this.anim.delete(id)
    }
    this.ensureFrame()
  }

  setHover(id: string | null): void {
    if (id === this.hoverId) return
    this.hoverId = id
    this.ensureFrame()
  }

  setSelected(id: string | null): void {
    if (id === this.selectedId) return
    this.selectedId = id
    this.ensureFrame()
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced
    if (reduced) {
      // Collapse every in-flight tween to its target immediately.
      for (const a of this.anim.values()) {
        a.x = a.target.x
        a.y = a.target.y
        a.alpha = a.target.reachable ? 1 : 0.55
        a.color = STATE_COLORS[a.target.state]
      }
    }
    this.ensureFrame()
  }

  /** Nearest node within pick radius, in css pixels; the origin counts too. */
  pick(cssX: number, cssY: number): string | null {
    let best: string | null = null
    let bestDist = PICK_RADIUS
    for (const [id, a] of this.anim) {
      if (a.alpha < 0.15) continue
      const d = Math.hypot(a.x - cssX, a.y - cssY)
      if (d < bestDist) {
        bestDist = d
        best = id
      }
    }
    if (!best && this.originId && Math.hypot(this.cx - cssX, this.cy - cssY) < 14) return this.originId
    return best
  }

  // ---- animation loop ----------------------------------------------------

  private ensureFrame(): void {
    if (this.raf === null) {
      this.lastTs = performance.now()
      this.raf = requestAnimationFrame(this.frame)
    }
  }

  private frame = (ts: number): void => {
    this.raf = null
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000)
    this.lastTs = ts
    const animating = this.step(dt)
    this.draw()
    if (animating) this.raf = requestAnimationFrame(this.frame)
  }

  /** Advances tweens and particles; returns true while anything still moves. */
  private step(dt: number): boolean {
    this.time += dt
    let animating = false

    for (const a of this.anim.values()) {
      const t = a.target
      if (this.reducedMotion) {
        a.x = t.x
        a.y = t.y
        a.alpha = t.reachable ? 1 : 0.55
        a.color = STATE_COLORS[t.state]
        continue
      }
      const colorTarget = STATE_COLORS[t.state]
      const alphaTarget = t.reachable ? 1 : 0.55
      a.x = approach(a.x, t.x, dt)
      a.y = approach(a.y, t.y, dt)
      a.alpha = approach(a.alpha, alphaTarget, dt)
      a.color = [
        approach(a.color[0], colorTarget[0], dt),
        approach(a.color[1], colorTarget[1], dt),
        approach(a.color[2], colorTarget[2], dt),
      ]
      const settled =
        Math.abs(a.x - t.x) < 0.1 &&
        Math.abs(a.y - t.y) < 0.1 &&
        Math.abs(a.alpha - alphaTarget) < 0.005 &&
        Math.abs(a.color[0] - colorTarget[0]) < 0.5
      if (!settled) animating = true
    }

    // Streams carry drifting particles and the blooming origin — the living
    // field. Reduced motion (or an empty field) lets the loop go idle.
    const hasStreams = [...this.anim.values()].some((a) => a.target.reachable && a.target.journeys.length > 0)
    if (!this.reducedMotion && hasStreams) animating = true

    return animating
  }

  // ---- drawing -----------------------------------------------------------

  private draw(): void {
    const ctx = this.ctx
    ctx.globalCompositeOperation = 'source-over'
    this.drawBackground()
    ctx.globalCompositeOperation = 'lighter'
    this.drawBloom()
    this.drawGhostBand()
    const streams = this.buildStreams()
    for (const stream of streams) this.drawStream(stream)
    this.drawParticles(streams)
    this.drawNodes()
    ctx.globalCompositeOperation = 'source-over'
    this.drawLabels()
  }

  private drawBackground(): void {
    const ctx = this.ctx
    ctx.fillStyle = BACKGROUND_TOP
    ctx.fillRect(0, 0, this.cssW, this.cssH)
    const g = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, Math.max(this.cssW, this.cssH) * 0.7)
    g.addColorStop(0, BACKGROUND_CENTER)
    g.addColorStop(1, 'rgba(4, 7, 15, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, this.cssW, this.cssH)
  }

  private drawBloom(): void {
    const ctx = this.ctx
    const pulse = this.reducedMotion ? 0 : Math.sin(this.time * 1.1) * 0.06
    const r = this.rMax * (0.42 + pulse)
    const g = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, r)
    g.addColorStop(0, 'rgba(70, 130, 255, 0.30)')
    g.addColorStop(0.5, 'rgba(60, 100, 220, 0.10)')
    g.addColorStop(1, 'rgba(40, 70, 160, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(this.cx, this.cy, r, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawGhostBand(): void {
    const ctx = this.ctx
    ctx.strokeStyle = 'rgba(110, 126, 152, 0.14)'
    ctx.lineWidth = 1
    ctx.setLineDash([2, 6])
    ctx.beginPath()
    ctx.arc(this.cx, this.cy, this.rMax, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  }

  /** Streams from the origin along every actual itinerary polyline. */
  private buildStreams(): StreamSpec[] {
    const streams: StreamSpec[] = []
    const originPos = { x: this.cx, y: this.cy }
    const dimOthers = this.selectedId !== null

    for (const a of this.anim.values()) {
      if (!a.target.reachable || a.alpha < 0.03) continue
      const isSelected = a.target.id === this.selectedId
      const emphasis = isSelected ? 1.7 : dimOthers ? 0.45 : 1

      for (const journey of a.target.journeys) {
        const pts = [originPos]
        for (const leg of journey.legs) {
          const node = this.anim.get(leg.to)
          pts.push(node ? { x: node.x, y: node.y } : originPos)
        }
        const bows = journey.legs.map((leg) => 0.12 * ((hashId(leg.connId) & 1) === 1 ? 1 : -1))
        streams.push({
          key: journey.legs.map((l) => l.connId).join('>'),
          pts,
          bows,
          color: a.color,
          alpha: 0.16 * a.alpha * emphasis,
          particles: Math.min(8, Math.max(2, Math.round(polylineLength(pts) / 130))),
        })
      }
    }
    return streams
  }

  private drawStream(stream: StreamSpec): void {
    const ctx = this.ctx
    const [r, g, b] = stream.color
    ctx.lineCap = 'round'
    // Wide soft underlay, then the brighter core — glow without shadowBlur.
    for (const pass of [
      { width: 3.2, alpha: stream.alpha * 0.45 },
      { width: 1.1, alpha: stream.alpha * 1.6 },
    ]) {
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(1, pass.alpha)})`
      ctx.lineWidth = pass.width
      tracePolyline(ctx, stream.pts, stream.bows)
      ctx.stroke()
    }
  }

  private drawParticles(streams: StreamSpec[]): void {
    const ctx = this.ctx
    for (const stream of streams) {
      const [r, g, b] = stream.color
      for (let i = 0; i < stream.particles; i++) {
        const seed = hashId(stream.key) + i * 7919
        const speed = 0.07 + 0.05 * hashFraction(seed)
        const phase = this.reducedMotion ? hashFraction(seed * 3) : fract(hashFraction(seed) + this.time * speed)
        const p = pointOnPolyline(stream.pts, stream.bows, phase)
        if (!p) continue
        const size = 1.2 + 1.3 * hashFraction(seed * 5)
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.75 * Math.min(1, stream.alpha * 5)})`
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.8)`
        ctx.shadowBlur = 6
        ctx.beginPath()
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      }
    }
  }

  private drawNodes(): void {
    const ctx = this.ctx
    for (const [id, a] of this.anim) {
      const [r, g, b] = a.color
      const isSelected = id === this.selectedId
      const isHovered = id === this.hoverId
      const coreR = a.target.reachable ? 4.2 : 3.2

      // Halo
      const haloR = isSelected ? 22 : 14
      const halo = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, haloR)
      halo.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.5 * a.alpha})`)
      halo.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
      ctx.fillStyle = halo
      ctx.beginPath()
      ctx.arc(a.x, a.y, haloR, 0, Math.PI * 2)
      ctx.fill()

      // Core
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(1, a.alpha + 0.1)})`
      ctx.beginPath()
      ctx.arc(a.x, a.y, coreR, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = `rgba(235, 244, 255, ${0.85 * a.alpha})`
      ctx.beginPath()
      ctx.arc(a.x, a.y, 1.5, 0, Math.PI * 2)
      ctx.fill()

      // Rings
      if (isSelected || isHovered) {
        ctx.strokeStyle = isSelected ? `rgba(${r}, ${g}, ${b}, ${0.95 * a.alpha})` : `rgba(235, 244, 255, ${0.6 * a.alpha})`
        ctx.lineWidth = 1.4
        ctx.beginPath()
        ctx.arc(a.x, a.y, isSelected ? 9.5 : 7.5, 0, Math.PI * 2)
        ctx.stroke()
      }
      if (!a.target.reachable) {
        ctx.strokeStyle = `rgba(110, 126, 152, ${0.5 * a.alpha})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(a.x, a.y, 5.5, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    // Origin node — always present, always lit.
    const pulse = this.reducedMotion ? 0 : Math.sin(this.time * 2) * 0.5 + 0.5
    const halo = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, 26 + pulse * 4)
    halo.addColorStop(0, `rgba(${ORIGIN_COLOR[0]}, ${ORIGIN_COLOR[1]}, ${ORIGIN_COLOR[2]}, 0.9)`)
    halo.addColorStop(0.35, 'rgba(120, 180, 255, 0.45)')
    halo.addColorStop(1, 'rgba(120, 180, 255, 0)')
    ctx.fillStyle = halo
    ctx.beginPath()
    ctx.arc(this.cx, this.cy, 26 + pulse * 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#eaf3ff'
    ctx.beginPath()
    ctx.arc(this.cx, this.cy, 5.5, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawLabels(): void {
    const ctx = this.ctx
    ctx.font = '11px Inter, system-ui, -apple-system, sans-serif'
    ctx.textBaseline = 'middle'

    for (const a of this.anim.values()) {
      const t = a.target
      const cos = Math.cos(t.angle)
      const sin = Math.sin(t.angle)
      const align = Math.abs(cos) < 0.35 ? 'center' : cos > 0 ? 'left' : 'right'
      const off = a.target.reachable ? 13 : 11
      const lx = a.x + cos * off + (align === 'center' ? 0 : align === 'left' ? 4 : -4)
      const ly = a.y + sin * off
      const alpha = t.reachable ? a.alpha : a.alpha * 0.9

      ctx.textAlign = align
      ctx.fillStyle = t.reachable ? LABEL_COLOR : `rgba(150, 165, 190, ${0.7 * alpha})`
      ctx.fillText(t.name, lx, ly)
      if (t.reachable) {
        ctx.font = '10px Inter, system-ui, -apple-system, sans-serif'
        ctx.fillStyle = `rgba(143, 163, 200, ${0.85 * alpha})`
        const fare = t.cheapestINR !== null ? ` · from ₹${t.cheapestINR.toLocaleString('en-IN')}` : ''
        ctx.fillText(`${formatDuration(t.fastestMin)}${fare}`, lx, ly + 13)
        ctx.font = '11px Inter, system-ui, -apple-system, sans-serif'
      }
    }

    // Origin label.
    ctx.textAlign = 'left'
    ctx.fillStyle = LABEL_COLOR
    ctx.fillText(this.originName, this.cx + 12, this.cy)
  }
}

// ---- polyline geometry (shared by streams and particles) -------------------

function polylineLength(pts: { x: number; y: number }[]): number {
  let len = 0
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y)
  return len
}

function segmentControl(p0: { x: number; y: number }, p1: { x: number; y: number }, bow: number): { x: number; y: number } {
  const dx = p1.x - p0.x
  const dy = p1.y - p0.y
  const len = Math.hypot(dx, dy) || 1
  return { x: (p0.x + p1.x) / 2 + (-dy / len) * len * bow, y: (p0.y + p1.y) / 2 + (dx / len) * len * bow }
}

function tracePolyline(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], bows: number[]): void {
  ctx.beginPath()
  ctx.moveTo(pts[0]!.x, pts[0]!.y)
  for (let i = 1; i < pts.length; i++) {
    const c = segmentControl(pts[i - 1]!, pts[i]!, bows[i - 1]!)
    ctx.quadraticCurveTo(c.x, c.y, pts[i]!.x, pts[i]!.y)
  }
}

/** Point at fraction s ∈ [0, 1) along the bowed polyline. */
function pointOnPolyline(
  pts: { x: number; y: number }[],
  bows: number[],
  s: number,
): { x: number; y: number } | null {
  const segCount = pts.length - 1
  if (segCount < 1) return null
  const scaled = Math.min(0.9999, Math.max(0, s)) * segCount
  const i = Math.floor(scaled)
  const t = scaled - i
  const p0 = pts[i]!
  const p1 = pts[i + 1]!
  const c = segmentControl(p0, p1, bows[i]!)
  const u = 1 - t
  return {
    x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
    y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y,
  }
}
