import { useMemo, useState } from 'react'
import type { Journey } from '../engine/types'
import type { DestinationResult } from '../engine/types'
import { formatDuration } from '../viz/format'
import { categoryHue, HUE_CSS_VAR } from '../viz/layout'
import { ChevronRightIcon } from './Icons'

interface JourneysStripProps {
  results: DestinationResult[]
  selectedId: string | null
  onSelect: (id: string) => void
}

/** How many journey chips show before the "+N more" expander (mockup). */
const COLLAPSED_COUNT = 5

const SPARK_W = 64
const SPARK_H = 20

/**
 * The best itinerary's shape, honestly mini: x is time across the journey,
 * y is a lane per mode (train / ferry / bus), so every rise and dip is a
 * real transfer. Pure geometry — same journey, same spark, every render.
 */
function sparkPath(j: Journey): { d: string; dots: { x: number; y: number }[] } {
  const lane: Record<Journey['legs'][number]['mode'], number> = {
    train: SPARK_H * 0.3,
    ferry: SPARK_H * 0.5,
    bus: SPARK_H * 0.72,
  }
  const t0 = j.departAt
  const span = Math.max(1, j.arriveAt - j.departAt)
  const x = (ms: number) => 1.5 + ((ms - t0) / span) * (SPARK_W - 3)

  const pts: { x: number; y: number }[] = []
  for (const leg of j.legs) {
    // Skip zero-length legs (same-time edges) so the path never stalls.
    const x0 = x(leg.depart)
    const x1 = x(leg.arrive)
    if (pts.length === 0 || x1 - pts[pts.length - 1]!.x > 0.5) pts.push({ x: x0, y: lane[leg.mode] })
    pts.push({ x: x1, y: lane[leg.mode] })
  }

  if (pts.length === 0) return { d: '', dots: [] }
  let d = `M ${pts[0]!.x.toFixed(1)} ${pts[0]!.y.toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!
    const b = pts[i]!
    const mx = (a.x + b.x) / 2
    d += ` C ${mx.toFixed(1)} ${a.y.toFixed(1)}, ${mx.toFixed(1)} ${b.y.toFixed(1)}, ${b.x.toFixed(1)} ${b.y.toFixed(1)}`
  }
  // Transfer joins get a dot — every kink in the line is a real change.
  const dots = pts.filter((_, i) => i > 0 && i < pts.length - 1 && pts[i]!.y !== pts[i - 1]!.y)
  return { d, dots }
}

interface Chip {
  id: string
  name: string
  durMin: number
  fareINR: number
  color: string
  spark: { d: string; dots: { x: number; y: number }[] }
}

/**
 * The mockup's "Your journeys" strip: one chip per reachable destination's
 * best itinerary — leg sparkline, name, duration · fare. Click selects the
 * destination on the field; "+N more" expands the rest.
 */
export function JourneysStrip({ results, selectedId, onSelect }: JourneysStripProps) {
  const [expanded, setExpanded] = useState(false)

  const chips = useMemo<Chip[]>(
    () =>
      results
        .filter((r) => r.reachable && r.best)
        .map((r) => {
          const best = r.best!
          const durMin = (best.arriveAt - best.departAt) / 60_000
          return {
            id: r.location.id,
            name: r.location.name,
            durMin,
            fareINR: best.costINR,
            color: HUE_CSS_VAR[categoryHue(r.location.tags)],
            spark: sparkPath(best),
          }
        })
        .sort((a, b) => a.durMin - b.durMin),
    [results],
  )

  const shown = expanded ? chips : chips.slice(0, COLLAPSED_COUNT)
  const hidden = chips.length - shown.length

  return (
    <section className="journeys" aria-label="Your journeys" data-testid="journeys-strip">
      <span className="journeys-label" aria-hidden="true">
        Your
        <br />
        journeys
      </span>
      <div className={`journeys-row${expanded ? ' expanded' : ''}`}>
        {shown.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className={`journey-chip${chip.id === selectedId ? ' selected' : ''}`}
            data-testid={`journey-card-${chip.id}`}
            onClick={() => onSelect(chip.id)}
            aria-pressed={chip.id === selectedId}
          >
            <span className="journey-chip-copy">
              <span className="journey-chip-name">{chip.name}</span>
              <span className="journey-chip-meta">
                {formatDuration(chip.durMin)} · ₹{chip.fareINR.toLocaleString('en-IN')}
              </span>
            </span>
            <svg className="journey-spark" viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} aria-hidden="true" focusable="false">
              <path d={chip.spark.d} fill="none" stroke={chip.color} strokeWidth={1.6} strokeLinecap="round" />
              {chip.spark.dots.map((dot, i) => (
                <circle key={i} cx={dot.x} cy={dot.y} r={1.7} fill={chip.color} />
              ))}
            </svg>
            <span className="journey-chip-chevron" aria-hidden="true">
              <ChevronRightIcon size={12} />
            </span>
          </button>
        ))}
        {hidden > 0 && (
          <button type="button" className="journeys-more" data-testid="journeys-more" onClick={() => setExpanded(true)}>
            +{hidden} more
          </button>
        )}
        {expanded && chips.length > COLLAPSED_COUNT && (
          <button type="button" className="journeys-more" data-testid="journeys-less" onClick={() => setExpanded(false)}>
            Show less
          </button>
        )}
      </div>
    </section>
  )
}
