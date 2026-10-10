import type { DestinationResult, Journey } from '../engine/types'
import { DEMO_DATA } from '../data'
import { formatIst } from '../sim/clock'
import { formatINR } from '../engine/format'
import { formatDuration } from '../viz/format'

interface DetailsPanelProps {
  result: DestinationResult | null
}

function journeyDurationMin(j: Journey): number {
  return (j.arriveAt - j.departAt) / 60_000
}

/**
 * The selected destination's engine snapshot: every nondominated journey
 * with its leg breakdown, the round-trip badge, and the engine's reason.
 * Revalidated on every scrub — expired journeys simply stop being listed.
 */
export function DetailsPanel({ result }: DetailsPanelProps) {
  if (!result) {
    return (
      <section className="panel details-panel" aria-label="Destination details">
        <h2 className="panel-kicker">Destination</h2>
        <p className="details-empty">Select a destination on the field or in the list to see its journeys.</p>
      </section>
    )
  }

  return (
    <section className="panel details-panel" aria-label={`Details for ${result.location.name}`}>
      <div className="details-head">
        <h2 className="panel-kicker">Destination</h2>
        <span className={`state-chip ${result.reachable ? 'state-ok' : 'state-ghost'}`}>
          {result.reachable ? 'Possible' : 'Unreachable'}
        </span>
      </div>
      <h3 className="details-name">{result.location.name}</h3>
      <p className="details-tags">
        {result.location.region} · {result.location.tags.join(' · ')}
      </p>
      <p className="details-reason" data-testid="details-reason">
        {result.reason}
      </p>

      {result.reachable ? (
        <>
          <ul className="journey-list" data-testid="journey-list">
            {result.journeys.map((j) => (
              <li key={j.legs.map((l) => l.connId).join('>')} className="journey">
                <div className="journey-summary">
                  <span className="journey-window">
                    {formatIst(j.departAt)} → {formatIst(j.arriveAt)}
                  </span>
                  <span className="journey-meta">
                    {formatDuration(journeyDurationMin(j))} · {formatINR(j.costINR)} (estimated) ·{' '}
                    {j.transfers === 0 ? 'direct' : `${j.transfers} transfer${j.transfers === 1 ? '' : 's'}`}
                  </span>
                </div>
                <ol className="leg-list">
                  {j.legs.map((leg) => (
                    <li key={leg.connId} className={`leg mode-${leg.mode}`}>
                      <span className="leg-mode">{leg.mode}</span>
                      <span className="leg-label">{DEMO_DATA.connectionById(leg.connId)?.label ?? leg.connId}</span>
                      <span className="leg-times">
                        {formatIst(leg.depart)} → {formatIst(leg.arrive)}
                      </span>
                      <span className="leg-fare">{formatINR(leg.costINR)}</span>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
          {result.roundTrip ? (
            <p className="roundtrip-badge" data-testid="roundtrip-badge">
              Day trip possible — return arrives {formatIst(result.roundTrip.arriveAt)} ·{' '}
              {formatINR(result.roundTrip.costINR)} return fare (estimated)
            </p>
          ) : (
            <p className="roundtrip-none">No valid return inside the deadline and budget — one-way reachability only.</p>
          )}
        </>
      ) : (
        <p className="details-ghost-note">The field keeps this destination as a grey ghost at the rim while no valid itinerary survives.</p>
      )}
    </section>
  )
}
