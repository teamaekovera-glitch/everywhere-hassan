import { Suspense, lazy } from 'react'
import { DEMO_DATA, PHOTO_CREDITS } from '../data'
import type { PhotoCredit } from '../data/photoCredits'
import { formatIst } from '../sim/clock'
import { formatINR } from '../engine/format'
import { formatDuration } from '../viz/format'
import type { TripPlan } from '../engine/planner'
import { ImageCreditsPanel } from './ImageCreditsPanel'
import { buildItinerary } from './tripPlan'

// Leaflet stays out of the main bundle (spec): the map is its own lazy chunk,
// loaded only when a selected plan reveals the detail view.
const TripMap = lazy(() => import('./TripMap'))

interface TripDetailProps {
  plan: TripPlan
  budgetINR: number
  /** The planner deadline this plan guarantees to beat. */
  deadlineMs: number
  onClose: () => void
  onOpenDestination: () => void
}

/** The destination's own photo credits — hero + its famous spots — rendered offline. */
function creditsForDestination(destinationId: string): readonly PhotoCredit[] {
  return PHOTO_CREDITS.filter(
    (credit) => credit.assetId === destinationId || credit.assetId.startsWith(`${destinationId}-spot`),
  )
}

/**
 * The trip-detail surface (planner spec): the full itinerary leg-by-leg —
 * every leg, activity, and meal with its time and cost — the dwell window,
 * the arrival-back guarantee against the deadline, the lazy OSM route map,
 * and the destination's offline image credits.
 */
export function TripDetail({ plan, budgetINR, deadlineMs, onClose, onOpenDestination }: TripDetailProps) {
  const destination = DEMO_DATA.locationById.get(plan.destinationId)
  const itinerary = buildItinerary(plan, DEMO_DATA)

  return (
    <section className="trip-detail card" aria-label={`Trip detail — ${destination?.name ?? plan.destinationId}`} data-testid="trip-detail">
      <header className="trip-detail-head">
        <div>
          <h3 className="trip-detail-title">
            {destination?.name ?? plan.destinationId} <span className="trip-detail-sub">— your day, minute by minute</span>
          </h3>
          <p className="trip-detail-guarantee" data-testid="trip-guarantee">
            Stay {formatIst(plan.outbound.arriveAt)} → {formatIst(plan.returnJourney.departAt)} ·{' '}
            {formatDuration(plan.dwellMin)} on the ground · back by{' '}
            <strong>{formatIst(plan.arriveBackAt)}</strong> — before your {formatIst(deadlineMs)} deadline.
          </p>
        </div>
        <div className="trip-detail-actions">
          <button type="button" className="cta-quiet" onClick={onOpenDestination} data-testid="open-destination-modal">
            Destination details
          </button>
          <button type="button" className="cta-quiet" onClick={onClose} data-testid="close-trip-detail" aria-label="Close trip detail">
            Close
          </button>
        </div>
      </header>

      <ol className="itinerary-list" data-testid="itinerary-list">
        {itinerary.map((entry) => (
          <li
            key={`${entry.kind}-${entry.id}`}
            className={`itinerary-entry itinerary-${entry.kind}${entry.kind === 'leg' ? ` phase-${entry.phase}` : ''}`}
          >
            <span className="itinerary-time">
              {formatIst(entry.startMs)}
              {entry.endMs !== null && (
                <>
                  {' → '}
                  {formatIst(entry.endMs)}
                </>
              )}
            </span>
            <span className="itinerary-body">
              <span className="itinerary-title">
                {entry.kind === 'leg' && <span className={`itinerary-mode mode-${entry.mode}`}>{entry.mode}</span>}
                {entry.kind === 'leg' && (
                  <span className="itinerary-phase">{entry.phase === 'outbound' ? 'out · ' : 'back · '}</span>
                )}
                {entry.title}
              </span>
              {entry.kind !== 'leg' && entry.blurb && <span className="itinerary-blurb">{entry.blurb}</span>}
              {entry.kind === 'meal' && <span className="itinerary-slot">{entry.slot} · service window estimate</span>}
            </span>
            <span className="itinerary-cost">
              {entry.costINR === 0 ? 'Free' : formatINR(entry.costINR)}
              <span className="estimated-tag">estimated</span>
            </span>
          </li>
        ))}
      </ol>

      <Suspense fallback={<div className="trip-map trip-map-loading">Loading map…</div>}>
        <TripMap plan={plan} deadlineMs={deadlineMs} />
      </Suspense>

      <footer className="trip-detail-totals" data-testid="trip-totals">
        <span>
          Travel {formatINR(plan.costs.travelINR)} · Activities {formatINR(plan.costs.activitiesINR)} · Meal{' '}
          {formatINR(plan.costs.mealINR)} · <strong>Total {formatINR(plan.costs.totalINR)}</strong> of {formatINR(budgetINR)}
        </span>
        <span className="estimated-tag">all costs are estimates</span>
      </footer>

      {creditsForDestination(plan.destinationId).length > 0 && (
        <ImageCreditsPanel credits={creditsForDestination(plan.destinationId)} />
      )}
    </section>
  )
}
