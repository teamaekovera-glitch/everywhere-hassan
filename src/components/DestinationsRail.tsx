import { useMemo, useRef, useState } from 'react'
import type { Constraints, DestinationResult } from '../engine/types'
import type { ProbePreview } from '../state/store'
import { formatDuration } from '../viz/format'
import { categoryHue } from '../viz/layout'
import { SHORT_TRIP_MAX_MIN, imageForLocation, matchesTab, type TripTab } from './destinationImages'
import { DestinationDetails } from './DestinationDetails'
import { ChevronRightIcon } from './Icons'

interface DestinationsRailProps {
  results: DestinationResult[]
  selectedId: string | null
  /** The folded constraints the ghost cards' probe runs against. */
  constraints: Constraints
  /** Constraint fingerprint — a changed snapshot remounts the probe section. */
  probeFingerprint: string
  onApplyPreview: (preview: ProbePreview) => void
  onSelect: (id: string | null) => void
}

const TABS: { id: TripTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'short', label: 'Short Trips' },
  { id: 'long', label: 'Long Trips' },
]

function bestDurationMin(r: DestinationResult): number | null {
  if (!r.reachable || !r.best) return null
  return (r.best.arriveAt - r.best.departAt) / 60_000
}

/**
 * The mockup's right rail: All / Short / Long tabs over photo-thumbnail
 * cards — name, travel time, best fare, and the category tag line straight
 * from the dataset. Selected cards expand their engine detail (journeys,
 * round-trip badge, or the ghost card's inline unlock probe). Still a
 * keyboard-navigable listbox mirroring the field.
 */
export function DestinationsRail({
  results,
  selectedId,
  constraints,
  probeFingerprint,
  onApplyPreview,
  onSelect,
}: DestinationsRailProps) {
  const [tab, setTab] = useState<TripTab>('all')
  const [focusIndex, setFocusIndex] = useState(0)
  const itemRefs = useRef<(HTMLLIElement | null)[]>([])

  // Counts are over reachable destinations (the mockup's "All (10)"): ghosts
  // have no duration to classify and only surface on the All tab.
  const counts = useMemo(() => {
    let all = 0
    let short = 0
    let long = 0
    for (const r of results) {
      const d = bestDurationMin(r)
      if (d === null) continue
      all++
      if (d <= SHORT_TRIP_MAX_MIN) short++
      else long++
    }
    return { all, short, long } as Record<TripTab, number>
  }, [results])

  const visible = useMemo(
    () =>
      results.filter((r) => {
        const d = bestDurationMin(r)
        if (d === null) return tab === 'all'
        return matchesTab(tab, d)
      }),
    [results, tab],
  )

  function moveFocus(next: number) {
    const clamped = Math.min(visible.length - 1, Math.max(0, next))
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
        moveFocus(visible.length - 1)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        onSelect(visible[focusIndex]?.location.id ?? null)
        break
    }
  }

  function changeTab(next: TripTab) {
    setTab(next)
    setFocusIndex(0)
  }

  return (
    <section className="panel dest-rail" aria-label="Destinations">
      <div className="dest-tabs" role="group" aria-label="Trip length filter">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`dest-tab${tab === t.id ? ' active' : ''}`}
            aria-pressed={tab === t.id}
            onClick={() => changeTab(t.id)}
          >
            {t.label} <span className="dest-tab-count">({counts[t.id]})</span>
          </button>
        ))}
      </div>

      <ul role="listbox" aria-label="Destinations" aria-orientation="vertical" onKeyDown={onKeyDown}>
        {visible.map((r, i) => (
          <DestCard
            key={r.location.id}
            result={r}
            selected={selectedId === r.location.id}
            expanded={selectedId === r.location.id}
            constraints={constraints}
            probeFingerprint={probeFingerprint}
            onApplyPreview={onApplyPreview}
            onSelect={onSelect}
            refFn={(el) => {
              itemRefs.current[i] = el
            }}
            onFocusCard={() => setFocusIndex(i)}
            focusActive={i === focusIndex}
          />
        ))}
      </ul>
      <p className="rail-caption">Fares estimated · synthetic timetable</p>
    </section>
  )
}

interface DestCardProps {
  result: DestinationResult
  selected: boolean
  expanded: boolean
  focusActive: boolean
  constraints: Constraints
  probeFingerprint: string
  onApplyPreview: (preview: ProbePreview) => void
  onSelect: (id: string | null) => void
  refFn: (el: HTMLLIElement | null) => void
  onFocusCard: () => void
}

function DestCard({
  result,
  selected,
  expanded,
  focusActive,
  constraints,
  probeFingerprint,
  onApplyPreview,
  onSelect,
  refFn,
  onFocusCard,
}: DestCardProps) {
  const durMin = bestDurationMin(result)
  const hue = categoryHue(result.location.tags)
  const imageSrc = imageForLocation(result.location.id)

  return (
    <li
      ref={refFn}
      role="option"
      tabIndex={focusActive ? 0 : -1}
      aria-selected={selected}
      className={`dest-card hue-${hue}${result.reachable ? '' : ' ghost'}${selected ? ' selected' : ''}`}
      data-testid={`dest-${result.location.id}`}
      onFocus={onFocusCard}
      onClick={() => onSelect(result.location.id)}
    >
      <span className="dest-thumb" aria-hidden="true">
        {imageSrc ? (
          <img src={imageSrc} alt="" width={56} height={56} loading="lazy" />
        ) : (
          <span className="dest-monogram">{result.location.name.charAt(0)}</span>
        )}
      </span>
      <span className="dest-body">
        <span className="dest-name">{result.location.name}</span>
        {durMin !== null && result.best ? (
          <span className="dest-meta">
            {formatDuration(durMin)} · ₹{result.best.costINR.toLocaleString('en-IN')}
          </span>
        ) : (
          <span className="dest-meta">Unreachable</span>
        )}
        <span className="dest-tags">
          <span className="tag-dot" aria-hidden="true" />
          {result.location.tags.join(' · ')}
        </span>
      </span>
      <span className="dest-chevron" aria-hidden="true">
        <ChevronRightIcon />
      </span>

      {expanded && (
        <DestinationDetails
          result={result}
          constraints={constraints}
          probeFingerprint={probeFingerprint}
          onApplyPreview={onApplyPreview}
        />
      )}
    </li>
  )
}
