import { useEffect, useMemo, useRef, useState } from 'react'
import type { DestinationResult } from '../engine/types'
import { layoutField } from '../viz/layout'
import { FieldRenderer } from '../viz/renderer'
import { formatDuration } from '../viz/format'

interface FieldCanvasProps {
  results: DestinationResult[]
  originId: string
  originName: string
  selectedId: string | null
  onSelect: (id: string | null) => void
}

interface HoverState {
  id: string
  x: number
  y: number
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/**
 * Mounts the Canvas 2D field inside React: deterministic layout per engine
 * snapshot, pointer hover/click picking, and a floating tooltip. Keyboard
 * access is mirrored separately by the destinations listbox.
 */
export function FieldCanvas({ results, originId, originName, selectedId, onSelect }: FieldCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<FieldRenderer | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [hover, setHover] = useState<HoverState | null>(null)
  const reducedMotion = useReducedMotion()

  // Track the wrapper's css size — the canvas fills its container.
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) setSize({ width: rect.width, height: rect.height })
    })
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [])

  // Create the renderer once.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = new FieldRenderer(canvas, { reducedMotion })
    rendererRef.current = renderer
    return () => {
      renderer.destroy()
      rendererRef.current = null
    }
    // reducedMotion is forwarded via setReducedMotion; onSelect via ref.
  }, [])

  // Layout is pure: same results and size, same field.
  const layout = useMemo(
    () => (size.width > 0 && size.height > 0 ? layoutField(results, size.width, size.height) : null),
    [results, size],
  )

  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer) return
    if (layout) renderer.setTargets(layout)
    renderer.setOrigin(originId, originName)
  }, [layout, originId, originName])

  useEffect(() => {
    rendererRef.current?.setSelected(selectedId)
  }, [selectedId])

  useEffect(() => {
    rendererRef.current?.setReducedMotion(reducedMotion)
  }, [reducedMotion])

  const nodeById = useMemo(() => new Map(layout?.nodes.map((n) => [n.id, n]) ?? []), [layout])

  function toLocal(e: React.PointerEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const hoveredNode = hover ? nodeById.get(hover.id) : undefined

  return (
    <div ref={wrapRef} className="field-wrap">
      <canvas
        ref={canvasRef}
        className="field-canvas"
        style={{ cursor: hover && hover.id !== originId ? 'pointer' : 'default' }}
        role="img"
        aria-label={`Possibility field from ${originName}: ${results.filter((r) => r.reachable).length} reachable destinations. Keyboard users: use the destinations list.`}
        onPointerMove={(e) => {
          const p = toLocal(e)
          const id = rendererRef.current?.pick(p.x, p.y) ?? null
          setHover(id ? { id, x: p.x, y: p.y } : null)
        }}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => {
          const p = toLocal(e)
          const id = rendererRef.current?.pick(p.x, p.y) ?? null
          onSelect(id !== null && id !== originId ? id : null)
        }}
      />

      {hoveredNode ? (
        <div
          className="field-tooltip"
          style={{
            left: Math.min(hover!.x + 16, Math.max(8, size.width - 224)),
            top: Math.min(hover!.y + 14, Math.max(8, size.height - 76)),
          }}
          aria-hidden="true"
        >
          <div className="tooltip-name">{hoveredNode.name}</div>
          {hoveredNode.reachable ? (
            <div className="tooltip-sub">
              {formatDuration(hoveredNode.fastestMin)} · from ₹{hoveredNode.cheapestINR?.toLocaleString('en-IN')}
              {hoveredNode.roundTripAvailable ? ' · day trip possible' : ''}
            </div>
          ) : (
            <div className="tooltip-sub tooltip-ghost">Unreachable — {hoveredNode.reason}</div>
          )}
        </div>
      ) : hover && hover.id === originId ? (
        <div className="field-tooltip" style={{ left: hover.x + 16, top: hover.y + 14 }} aria-hidden="true">
          <div className="tooltip-name">{originName}</div>
          <div className="tooltip-sub">Origin — you start here</div>
        </div>
      ) : null}
    </div>
  )
}
