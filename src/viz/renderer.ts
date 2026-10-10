import { categoryHue, hashId, HUE_RGB, type FieldNode, type NodeState } from './layout'
import { formatDuration } from './format'

/**
 * Canvas 2D renderer for the Possibility Field — the mockup's nebula.
 * A bright origin core radiates soft, additive category-hued lobes along
 * the real itinerary legs; ghosts sit dimmed on the rim; leader-line
 * labels name the strongest destinations. Still a reachability visual:
 * every lobe's stretch and every stream flows along an actual itinerary,
 * and hue is category, not geography.
 *
 * Deterministic and presentational: positions arrive as targets from
 * layoutField; the renderer tweens toward them. The rAF loop idles whenever
 * nothing animates (reduced motion + settled tweens), and reduced motion
 * collapses every tween to an instant state change.
 */

type Rgb = readonly [number, number, number]

/** State still drives the core dot + halo emphasis; hue comes from tags. */
const STATE_EMPHASIS: Record<NodeState, number> = {
  near: 1,
  mid: 0.82,
  far: 0.66,
  unavailable: 0.3,
}

const ORIGIN_COLOR: Rgb = [190, 220, 255]
const GHOST_RGB: Rgb = [110, 126, 152]
const BACKGROUND_TOP = '#03050b'
const BACKGROUND_WASH = 'rgba(10, 16, 34, 0.85)'
const LABEL_COLOR = 'rgba(222, 231, 248, 0.94)'

const TWEEN_RATE = 9 // exponential approach per second — settles in ~400 ms
const PICK_RADIUS = 16
const DPR_CAP = 2
/** Reachable destinations carrying leader-line labels (largest lobes first). */
const LABEL_COUNT = 8
/** Blobs sampled along each leg so the lobe stretches along the real path. */
const LOBE_TRAIL = 3

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

function hueOf(node: FieldNode): Rgb {
  return HUE_RGB[categoryHue(node.tags)]
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
  private labeled: ReadonlySet<string> = new Set()
  private lastNodes: readonly FieldNode[] = []
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
          color: hueOf(target),
        })
      }
    }
    for (const id of [...this.anim.keys()]) {
      if (!seen.has(id)) this.anim.delete(id)
    }
    this.lastNodes = layout.nodes
    this.labeled = pickLabeled(layout.nodes, this.selectedId, this.hoverId)
    this.ensureFrame()
  }

  setHover(id: string | null): void {
    if (id === this.hoverId) return
    this.hoverId = id
    this.labeled = pickLabeled(this.lastNodes, this.selectedId, this.hoverId)
    this.ensureFrame()
  }

  setSelected(id: string | null): void {
    if (id === this.selectedId) return
    this.selectedId = id
    this.labeled = pickLabeled(this.lastNodes, this.selectedId, this.hoverId)
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
        a.color = hueOf(a.target)
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
        a.color = hueOf(t)
        continue
      }
      const colorTarget = hueOf(t)
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

    // Streams carry drifting particles and the breathing core — the living
    // nebula. Reduced motion (or an empty field) lets the loop go idle.
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
    this.drawNebula()
    this.drawStreams()
    this.drawNodes()
    ctx.globalCompositeOperation = 'source-over'
    this.drawLabels()
  }

  private drawBackground(): void {
    const ctx = this.ctx
    ctx.fillStyle = BACKGROUND_TOP
    ctx.fillRect(0, 0, this.cssW, this.cssH)
    const g = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, Math.max(this.cssW, this.cssH) * 0.72)
    g.addColorStop(0, BACKGROUND_WASH)
    g.addColorStop(1, 'rgba(3, 5, 11, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, this.cssW, this.cssH)
  }

  /**
   * The nebula body: the origin core plus one category-hued glow per
   * reachable destination, stretched along its real legs. Additive blending
   * makes overlaps glow — the field reads as one luminous organism.
   */
  private drawNebula(): void {
    this.drawCore()
    this.drawGhostBand()

    const dimOthers = this.selectedId !== null
    for (const a of this.anim.values()) {
      if (!a.target.reachable || a.alpha < 0.03) continue
      const isSelected = a.target.id === this.selectedId
      const emphasis = (isSelected ? 1.5 : dimOthers ? 0.4 : 1) * STATE_EMPHASIS[a.target.state]
      const [r, g, b] = a.color

      // Lobe at the destination itself — larger when near (short trips).
      const lobeR = a.target.state === 'near' ? 34 : a.target.state === 'mid' ? 27 : 22
      this.blob(a.x, a.y, lobeR, r, g, b, 0.34 * a.alpha * emphasis)

      // The lobe trails toward the origin along the fastest journey's first
      // legs — the glow literally follows the way you would travel.
      const journey = a.target.journeys[0]
      if (!journey) continue
      let from = { x: this.cx, y: this.cy }
      for (let i = 0; i < Math.min(LOBE_TRAIL, journey.legs.length); i++) {
        const next = this.anim.get(journey.legs[i]!.to)
        if (!next) break
        const mx = lerp(from.x, next.x, 0.55)
        const my = lerp(from.y, next.y, 0.55)
        this.blob(mx, my, lobeR * 0.62, r, g, b, 0.16 * a.alpha * emphasis)
        from = { x: next.x, y: next.y }
      }
    }
  }

  /** One soft additive blob — the nebula's atom. No shadowBlur (slow). */
  private blob(x: number, y: number, radius: number, r: number, g: number, b: number, alpha: number): void {
    if (alpha <= 0.004) return
    const ctx = this.ctx
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius)
    grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${Math.min(1, alpha)})`)
    grad.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, ${Math.min(1, alpha * 0.32)})`)
    grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  /** The origin core — the mockup's sun. Breathes unless motion is reduced. */
  private drawCore(): void {
    const ctx = this.ctx
    const pulse = this.reducedMotion ? 0 : Math.sin(this.time * 1.1) * 0.06
    const r = this.rMax * (0.46 + pulse)
    const g = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, r)
    g.addColorStop(0, 'rgba(96, 150, 255, 0.42)')
    g.addColorStop(0.4, 'rgba(70, 110, 230, 0.16)')
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
  private drawStreams(): void {
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
        const stream: StreamSpec = {
          key: journey.legs.map((l) => l.connId).join('>'),
          pts,
          bows,
          color: a.color,
          alpha: 0.14 * a.alpha * emphasis,
          particles: Math.min(8, Math.max(2, Math.round(polylineLength(pts) / 130))),
        }
        this.drawStream(stream)
        this.drawParticles(stream)
      }
    }
  }

  private drawStream(stream: StreamSpec): void {
    const ctx = this.ctx
    const [r, g, b] = stream.color
    ctx.lineCap = 'round'
    // Wide soft underlay, then the brighter core — glow without shadowBlur.
    for (const pass of [
      { width: 3, alpha: stream.alpha * 0.5 },
      { width: 1, alpha: stream.alpha * 1.7 },
    ]) {
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(1, pass.alpha)})`
      ctx.lineWidth = pass.width
      tracePolyline(ctx, stream.pts, stream.bows)
      ctx.stroke()
    }
  }

  private drawParticles(stream: StreamSpec): void {
    const ctx = this.ctx
    const [r, g, b] = stream.color
    for (let i = 0; i < stream.particles; i++) {
      const seed = hashId(stream.key) + i * 7919
      const speed = 0.07 + 0.05 * hashFraction(seed)
      const phase = this.reducedMotion ? hashFraction(seed * 3) : fract(hashFraction(seed) + this.time * speed)
      const p = pointOnPolyline(stream.pts, stream.bows, phase)
      if (!p) continue
      const size = 1.2 + 1.3 * hashFraction(seed * 5)
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.75 * Math.min(1, stream.alpha * 5)})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  private drawNodes(): void {
    const ctx = this.ctx
    for (const [id, a] of this.anim) {
      const [r, g, b] = a.color
      const isSelected = id === this.selectedId
      const isHovered = id === this.hoverId
      const t = a.target

      if (t.reachable) {
        // Bright knot inside the lobe.
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(1, a.alpha)})`
        ctx.beginPath()
        ctx.arc(a.x, a.y, 3.4, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = `rgba(236, 244, 255, ${0.9 * a.alpha})`
        ctx.beginPath()
        ctx.arc(a.x, a.y, 1.5, 0, Math.PI * 2)
        ctx.fill()

        if (isSelected || isHovered) {
          ctx.strokeStyle = isSelected ? `rgba(${r}, ${g}, ${b}, ${0.95 * a.alpha})` : `rgba(235, 244, 255, ${0.6 * a.alpha})`
          ctx.lineWidth = 1.4
          ctx.beginPath()
          ctx.arc(a.x, a.y, isSelected ? 9.5 : 7.5, 0, Math.PI * 2)
          ctx.stroke()
        }
      } else {
        // Ghosts stay honest: dim desaturated dot with a waiting ring.
        const [gr, gg, gb] = GHOST_RGB
        ctx.fillStyle = `rgba(${gr}, ${gg}, ${gb}, ${0.7 * a.alpha})`
        ctx.beginPath()
        ctx.arc(a.x, a.y, 2.6, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = `rgba(${gr}, ${gg}, ${gb}, ${0.5 * a.alpha})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(a.x, a.y, 5.5, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    // Origin sun — always present, always lit.
    const pulse = this.reducedMotion ? 0 : Math.sin(this.time * 2) * 0.5 + 0.5
    const halo = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, 26 + pulse * 4)
    halo.addColorStop(0, `rgba(${ORIGIN_COLOR[0]}, ${ORIGIN_COLOR[1]}, ${ORIGIN_COLOR[2]}, 0.95)`)
    halo.addColorStop(0.35, 'rgba(120, 180, 255, 0.5)')
    halo.addColorStop(1, 'rgba(120, 180, 255, 0)')
    ctx.fillStyle = halo
    ctx.beginPath()
    ctx.arc(this.cx, this.cy, 26 + pulse * 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#f2f7ff'
    ctx.beginPath()
    ctx.arc(this.cx, this.cy, 5.5, 0, Math.PI * 2)
    ctx.fill()
  }

  /**
   * Leader-line labels on the largest reachable lobes (plus the origin,
   * selected and hovered node, always) — the mockup's quiet annotation
   * layer, never overlapping.
   */
  private drawLabels(): void {
    const ctx = this.ctx

    // 1. Collect candidates in a fixed priority order: origin, selection,
    //    hover, then labeled lobes fastest-first (same order as pickLabeled).
    const byId = new Map(this.anim)
    const ordered: AnimNode[] = []
    const push = (id: string) => {
      const a = byId.get(id)
      if (a) ordered.push(a)
    }
    if (this.selectedId) push(this.selectedId)
    if (this.hoverId) push(this.hoverId)
    for (const id of this.labeled) if (id !== this.selectedId && id !== this.hoverId) push(id)

    const candidates: LabelCandidate[] = [
      {
        id: '__origin__',
        lx: this.cx + 12,
        ly: this.cy,
        align: 'left',
        width: ctx.measureText(this.originName).width,
        twoLine: false,
        origin: true,
      },
      ...ordered
        .filter((a) => a.target.reachable || a.target.id === this.selectedId || a.target.id === this.hoverId)
        .map((a) => {
          const t = a.target
          const cos = Math.cos(t.angle)
          const align = Math.abs(cos) < 0.35 ? ('center' as const) : cos > 0 ? ('left' as const) : ('right' as const)
          ctx.font = '11px Inter, system-ui, -apple-system, sans-serif'
          const nameW = ctx.measureText(t.name).width
          let width = nameW
          if (t.reachable) {
            ctx.font = '10px Inter, system-ui, -apple-system, sans-serif'
            const fare = t.cheapestINR !== null ? ` · from ₹${t.cheapestINR.toLocaleString('en-IN')}` : ''
            width = Math.max(width, ctx.measureText(`${formatDuration(t.fastestMin)}${fare}`).width)
          }
          const lx = a.x + cos * 20 + (align === 'center' ? 0 : align === 'left' ? 6 : -6)
          return {
            id: t.id,
            lx,
            ly: a.y + Math.sin(t.angle) * 20,
            align,
            width,
            twoLine: t.reachable,
            origin: false,
          }
        }),
    ]

    // 2. Resolve collisions — nudged or dropped.
    const placed = resolveLabels(candidates)
    const slots = new Map(placed.map((p) => [p.id, p]))

    // 3. Draw.
    ctx.font = '11px Inter, system-ui, -apple-system, sans-serif'
    ctx.textBaseline = 'middle'
    for (const a of this.anim.values()) {
      const t = a.target
      const forced = t.id === this.selectedId || t.id === this.hoverId
      if (!t.reachable && !forced) continue
      if (!forced && !this.labeled.has(t.id)) continue
      const slot = slots.get(t.id)
      if (!slot) continue
      const [r, g, b] = a.color

      const cos = Math.cos(t.angle)
      const sin = Math.sin(t.angle)

      // Leader line: lobe edge → label anchor.
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.45 * a.alpha})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(a.x + cos * 12, a.y + sin * 12)
      ctx.lineTo(a.x + cos * 17, a.y + sin * 17)
      ctx.stroke()

      const alpha = t.reachable ? a.alpha : a.alpha * 0.9
      ctx.textAlign = slot.align
      ctx.fillStyle = t.reachable ? LABEL_COLOR : `rgba(150, 165, 190, ${0.75 * alpha})`
      ctx.fillText(t.name, slot.lx, slot.ly)
      if (t.reachable) {
        ctx.font = '10px Inter, system-ui, -apple-system, sans-serif'
        ctx.fillStyle = `rgba(143, 163, 200, ${0.85 * alpha})`
        const fare = t.cheapestINR !== null ? ` · from ₹${t.cheapestINR.toLocaleString('en-IN')}` : ''
        ctx.fillText(`${formatDuration(t.fastestMin)}${fare}`, slot.lx, slot.ly + 13)
        ctx.font = '11px Inter, system-ui, -apple-system, sans-serif'
      }
    }

    // Origin label.
    const origin = slots.get('__origin__')
    if (origin) {
      ctx.textAlign = 'left'
      ctx.fillStyle = LABEL_COLOR
      ctx.fillText(this.originName, origin.lx, origin.ly)
    }
  }
}

/** A label awaiting a slot: anchor point, alignment, and measured width. */
interface LabelCandidate {
  id: string
  lx: number
  ly: number
  align: 'center' | 'left' | 'right'
  width: number
  twoLine: boolean
  origin: boolean
}

/** A label that won a slot, possibly nudged vertically. */
type PlacedLabel = LabelCandidate & { ly: number }

/** Vertical nudges tried in order before a label is dropped. */
const LABEL_NUDGES = [0, -15, 15, -30, 30, -45, 45, -60, 60] as const
const LABEL_PAD = 3

/**
 * Greedy label placement — the mockup never stacks text on the field.
 * Candidates keep their given priority order (origin, selection, hover,
 * strongest lobes); each tries its natural spot, then fixed vertical
 * nudges, and is dropped when every slot collides. Deterministic: same
 * inputs, same placement.
 */
export function resolveLabels(candidates: readonly LabelCandidate[]): PlacedLabel[] {
  const boxes: { x0: number; x1: number; y0: number; y1: number }[] = []
  const placed: PlacedLabel[] = []
  for (const c of candidates) {
    const height = c.twoLine ? 26 : 13
    const x0 = c.align === 'center' ? c.lx - c.width / 2 : c.align === 'left' ? c.lx : c.lx - c.width
    const x1 = x0 + c.width
    let chosenLy: number | null = null
    for (const dy of LABEL_NUDGES) {
      const y0 = c.ly + dy - 7
      const y1 = y0 + height
      const collides = boxes.some((b) => x0 < b.x1 + LABEL_PAD && x1 > b.x0 - LABEL_PAD && y0 < b.y1 + LABEL_PAD && y1 > b.y0 - LABEL_PAD)
      if (!collides) {
        chosenLy = c.ly + dy
        boxes.push({ x0, x1, y0, y1 })
        break
      }
    }
    if (chosenLy !== null) placed.push({ ...c, ly: chosenLy })
  }
  return placed
}

/**
 * Which nodes carry labels this frame: the LABEL_COUNT fastest reachable
 * destinations (the biggest, brightest lobes), plus selection and hover.
 * Deterministic — same results, same label set.
 */
function pickLabeled(nodes: readonly FieldNode[], selectedId: string | null, hoverId: string | null): ReadonlySet<string> {
  const labeled = new Set<string>()
  const reachable = nodes.filter((n) => n.reachable).sort((a, b) => a.fastestMin - b.fastestMin || a.id.localeCompare(b.id))
  for (const node of reachable.slice(0, LABEL_COUNT)) labeled.add(node.id)
  if (selectedId) labeled.add(selectedId)
  if (hoverId) labeled.add(hoverId)
  return labeled
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
