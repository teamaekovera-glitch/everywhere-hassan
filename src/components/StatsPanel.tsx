import { DATA_PROVENANCE } from '../data'
import type { ReachabilitySummary } from '../engine/types'

interface StatsPanelProps {
  summary: ReachabilitySummary
  originName: string
  originRegion: string
  /** Imminent impactful departures — wired by the alerts commit. */
  criticalCount?: number
}

/** "Currently possible" card — every number read from the engine snapshot. */
export function StatsPanel({ summary, originName, originRegion, criticalCount }: StatsPanelProps) {
  return (
    <section className="panel stats-panel" aria-label="Currently possible">
      <h2 className="panel-kicker">Currently possible</h2>
      <div className="stats-origin">
        <span className="stats-origin-label">Starting from</span>
        <span className="stats-origin-name">
          {originName}, {originRegion}
        </span>
      </div>
      <dl className="stats-grid">
        <div className="stat">
          <dt>Destinations</dt>
          <dd data-testid="stat-destinations">{summary.reachableCount}</dd>
        </div>
        <div className="stat">
          <dt>Total journeys</dt>
          <dd data-testid="stat-journeys">{summary.totalJourneys}</dd>
        </div>
        <div className="stat">
          <dt>Round trips</dt>
          <dd>{summary.roundTripCount}</dd>
        </div>
        {criticalCount !== undefined ? (
          <div className="stat">
            <dt>Critical departures</dt>
            <dd data-testid="stat-critical">{criticalCount}</dd>
          </div>
        ) : null}
      </dl>
      <p className="provenance">{DATA_PROVENANCE}</p>
    </section>
  )
}
