import { useEffect, useRef } from 'react'
import { DATA_PROVENANCE, DEMO_DATA, PHOTO_CREDITS, SPOTS } from '../data'
import { formatIst } from '../sim/clock'
import { formatINR } from '../engine/format'
import { formatDuration } from '../viz/format'
import type { TripPlan } from '../engine/planner'
import { photoForDestination, photoForSpot } from './destinationPhotos'

interface DestinationModalProps {
  plan: TripPlan
  onClose: () => void
}

/**
 * The app's first true modal primitive (planner spec): the destination detail
 * — hero photo with its credit line, the destination's travel facts, and the
 * famous spots grid with photo tiles, blurbs, and distance labels. Closes on
 * Escape or a backdrop click; focus is trapped inside while open.
 */
export function DestinationModal({ plan, onClose }: DestinationModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const location = DEMO_DATA.locationById.get(plan.destinationId)
  const credit = PHOTO_CREDITS.find((c) => c.assetId === plan.destinationId)
  const spots = SPOTS.filter((spot) => spot.destinationId === plan.destinationId)
  const heroPhoto = location ? photoForDestination(location.id) : ''

  // Focus trap + Escape — the dialog is the only Tab target while open.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const focusables = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])'),
      )
    focusables()[0]?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const list = focusables()
      if (list.length === 0) return
      const first = list[0]
      const last = list[list.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    dialog.addEventListener('keydown', onKey)
    return () => dialog.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!location) return null

  return (
    <div
      className="modal-backdrop"
      data-testid="destination-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`${location.name} — destination details`}
        data-testid="destination-modal"
      >
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Close destination details"
          data-testid="destination-modal-close"
        >
          ✕
        </button>

        <figure className="modal-hero">
          {heroPhoto ? (
            <img src={heroPhoto} alt={location.name} />
          ) : (
            <span className="modal-monogram" aria-hidden="true">
              {location.name.charAt(0)}
            </span>
          )}
          <figcaption className="modal-hero-credit" data-testid="modal-hero-credit">
            {credit
              ? `© ${credit.creator} · ${credit.license}`
              : 'Generated artwork — no photograph required attribution.'}
          </figcaption>
        </figure>

        <div className="modal-body">
          <h3 className="modal-title">{location.name}</h3>
          <p className="modal-region">
            {location.region} · {location.tags.join(', ')}
          </p>

          <dl className="modal-facts" data-testid="modal-facts">
            <div>
              <dt>Travel out</dt>
              <dd>
                {formatDuration((plan.outbound.arriveAt - plan.outbound.departAt) / 60_000)} ·{' '}
                {formatIst(plan.outbound.departAt)} → {formatIst(plan.outbound.arriveAt)}{' '}
                <span className="estimated-tag">estimated</span>
              </dd>
            </div>
            <div>
              <dt>Best fare out</dt>
              <dd>
                {formatINR(plan.outbound.costINR)} <span className="estimated-tag">estimated</span>
              </dd>
            </div>
            <div>
              <dt>Your stay</dt>
              <dd>
                {formatDuration(plan.dwellMin)} · {formatIst(plan.outbound.arriveAt)} →{' '}
                {formatIst(plan.returnJourney.departAt)}
              </dd>
            </div>
          </dl>

          <h4 className="modal-section-title">Famous spots</h4>
          <div className="spot-grid" data-testid="spot-grid">
            {spots.map((spot) => {
              const spotPhoto = photoForSpot(spot.id)
              const spotCredit = PHOTO_CREDITS.find((c) => c.assetId === spot.id)
              return (
                <figure key={spot.id} className="spot-tile">
                  {spotPhoto ? (
                    <img src={spotPhoto} alt={spot.name} loading="lazy" />
                  ) : (
                    <span className="spot-monogram" aria-hidden="true">
                      {spot.name.charAt(0)}
                    </span>
                  )}
                  <figcaption>
                    <span className="spot-name">{spot.name}</span>
                    {spotCredit && <span className="spot-credit">© {spotCredit.creator}</span>}
                    <span className="spot-blurb">{spot.blurb}</span>
                    <span className="spot-distance">
                      ~{spot.distanceKm} km from centre <span className="estimated-tag">estimated</span>
                    </span>
                  </figcaption>
                </figure>
              )
            })}
          </div>

          <p className="modal-disclosure" data-testid="modal-disclosure">
            {DATA_PROVENANCE} Photos courtesy of Wikimedia Commons contributors — see Image credits
            (offline) in the trip detail.
          </p>
        </div>
      </div>
    </div>
  )
}
