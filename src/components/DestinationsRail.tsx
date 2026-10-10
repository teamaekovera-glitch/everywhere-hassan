import { useRef, useState } from 'react'
import type { DestinationResult } from '../engine/types'
import { formatDuration } from '../viz/format'

interface DestinationsRailProps {
  results: DestinationResult[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}

function stateClass(r: DestinationResult): string {
  if (!r.reachable) return 'ghost'
  if (r.roundTrip) return 'daytrip'
  const j = r.best
  if (!j) return 'ghost'
  const durMin = (j.arriveAt - j.departAt) / 60_000
  return durMin <= 180 ? 'near' : durMin <= 420 ? 'mid' : 'far'
}

/**
 * The destinations rail: a DOM listbox mirroring the canvas field (spec) —
 * every node is keyboard-navigable with arrows and Enter, giving the field
 * full keyboard access. Order and data come from the engine snapshot.
 */
export function DestinationsRail({ results, selectedId, onSelect }: DestinationsRailProps) {
  const [focusIndex, setFocusIndex] = useState(0)
  const itemRefs = useRef<(HTMLLIElement | null)[]>([])

  function moveFocus(next: number) {
    const clamped = Math.min(results.length - 1, Math.max(0, next))
    setFocusIndex(clamped)
    itemRefs.current[clamped]?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        moveFocus(focusIndex + 1)
        break
      case 'ArrowUp':
        e.preventDefault()
        moveFocus(focusIndex - 1)
        break
      case 'Home':
        e.preventDefault()
        moveFocus(0)
        break
      case 'End':
        e.preventDefault()
        moveFocus(results.length - 1)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        onSelect(results[focusIndex]?.location.id ?? null)
        break
    }
  }

  return (
    <section className="panel destinations-rail" aria-label="Destinations">
      <h2 className="panel-kicker">Destinations</h2>
      <ul role="listbox" aria-label="Destinations" aria-orientation="vertical" onKeyDown={onKeyDown}>
        {results.map((r, i) => (
          <li
            key={r.location.id}
            ref={(el) => {
              itemRefs.current[i] = el
            }}
            role="option"
            tabIndex={i === focusIndex ? 0 : -1}
            aria-selected={selectedId === r.location.id}
            className={`dest-item ${stateClass(r)}${selectedId === r.location.id ? ' selected' : ''}`}
            data-testid={`dest-${r.location.id}`}
            onFocus={() => setFocusIndex(i)}
            onClick={() => onSelect(r.location.id)}
          >
            <span className="dest-dot" aria-hidden="true" />
            <span className="dest-name">{r.location.name}</span>
            <span className="dest-meta">
              {r.reachable
                ? `${formatDuration((r.best!.arriveAt - r.best!.departAt) / 60_000)} · ₹${(r.best!.costINR).toLocaleString('en-IN')}`
                : 'Unreachable'}
            </span>
            {r.roundTrip ? (
              <span className="dest-daytrip" title="Return journey fits the same deadline">
                day trip
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="rail-caption">Fares estimated · synthetic timetable</p>
    </section>
  )
}
