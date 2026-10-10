import { DATA_PROVENANCE } from '../data'
import type { ReachabilitySummary } from '../engine/types'
import { PinIcon, RouteIcon, UsersIcon, WarnIcon } from './Icons'

interface StatsCardProps {
  summary: ReachabilitySummary
  /** Distinct departures whose loss strands at least one reachable destination. */
  criticalCount: number
}

/**
 * The mockup's "Currently possible" stack — every number read straight from
 * the engine snapshot, nothing computed here. The disclosure stays truthful
 * about the synthetic timetable (a locked MVP decision the mockup's bolder
 * "real transport data" claim does not override).
 */
export function StatsCard({ summary, criticalCount }: StatsCardProps) {
  return (
    <section className="card stats-card" aria-label="Currently possible">
      <h2 className="card-kicker">Currently possible</h2>
      <ul className="stats-rows">
        <li className="stat-row">
          <span className="stat-icon" aria-hidden="true">
            <PinIcon size={15} />
          </span>
          <div className="stat-copy">
            <dd className="stat-num" data-testid="stat-destinations">
              {summary.reachableCount}
            </dd>
            <dt className="stat-label">Destinations</dt>
          </div>
        </li>
        <li className="stat-row">
          <span className="stat-icon" aria-hidden="true">
            <RouteIcon size={15} />
          </span>
          <div className="stat-copy">
            <dd className="stat-num" data-testid="stat-journeys">
              {summary.totalJourneys}
            </dd>
            <dt className="stat-label">Total journeys</dt>
          </div>
        </li>
        <li className="stat-row">
          <span className="stat-icon" aria-hidden="true">
            <UsersIcon size={15} />
          </span>
          <div className="stat-copy">
            <dd className="stat-num" data-testid="stat-critical">
              {criticalCount} <WarnIcon />
            </dd>
            <dt className="stat-label">Critical departures</dt>
          </div>
        </li>
      </ul>
      <p className="stats-hint">
        A computed reachability field based on a synthetic reference timetable — not a travel booking platform.
      </p>
      <p className="provenance">{DATA_PROVENANCE}</p>
    </section>
  )
}
