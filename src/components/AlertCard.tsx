import { useState } from 'react'
import type { DepartureAlert } from '../state/alerts'
import { ClockIcon, ChevronRightIcon } from './Icons'

interface AlertCardProps {
  alerts: DepartureAlert[]
}

/**
 * The mockup's single bottom-right alert card: the highest-priority
 * imminent departure, with a "+N more" expander for the rest. Every claim
 * on the card is the engine's counterfactual delta — nothing is invented.
 */
export function AlertCard({ alerts }: AlertCardProps) {
  const [expanded, setExpanded] = useState(false)
  const top = alerts[0]
  const rest = alerts.slice(1)

  return (
    <section className="alert-card" aria-label="Departure alerts" data-testid="alert-card">
      {top ? (
        <>
          <div className="alert-main">
            <span className="alert-icon" aria-hidden="true">
              <ClockIcon size={15} />
            </span>
            <div className="alert-copy">
              <p className="alert-headline">{top.headline}</p>
              <p className="alert-body">{top.detail}</p>
            </div>
            <ChevronRightIcon />
          </div>
          {rest.length > 0 && !expanded && (
            <button type="button" className="alert-more" data-testid="alert-more" onClick={() => setExpanded(true)}>
              +{rest.length} more alert{rest.length === 1 ? '' : 's'}
            </button>
          )}
          {expanded &&
            rest.map((alert) => (
              <div key={alert.connectionId} className="alert-main alert-extra" data-connection-id={alert.connectionId}>
                <span className="alert-icon" aria-hidden="true">
                  <ClockIcon size={15} />
                </span>
                <div className="alert-copy">
                  <p className="alert-headline">{alert.headline}</p>
                  <p className="alert-body">{alert.detail}</p>
                </div>
              </div>
            ))}
          {expanded && (
            <button type="button" className="alert-more" onClick={() => setExpanded(false)}>
              Show fewer alerts
            </button>
          )}
        </>
      ) : (
        <p className="alert-none">No departures leaving in the next 30 simulated minutes.</p>
      )}
    </section>
  )
}
