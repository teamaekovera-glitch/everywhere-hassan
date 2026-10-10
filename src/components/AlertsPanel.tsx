import type { DepartureAlert } from '../state/alerts'

interface AlertsPanelProps {
  alerts: DepartureAlert[]
}

/**
 * Engine-derived imminent-departure warnings. Every number on screen is the
 * engine's counterfactual delta — the panel never invents an impact.
 */
export function AlertsPanel({ alerts }: AlertsPanelProps) {
  if (alerts.length === 0) {
    return (
      <section className="panel alerts-panel" aria-label="Departure alerts">
        <h2 className="panel-kicker">Departure alerts</h2>
        <p className="alert-none">No departures in the next 30 simulated minutes.</p>
      </section>
    )
  }

  return (
    <section className="panel alerts-panel" aria-label="Departure alerts">
      <h2 className="panel-kicker">Departure alerts</h2>
      {alerts.map((alert) => (
        <article key={alert.connectionId} className="alert" data-connection-id={alert.connectionId}>
          <header className="alert-head">
            <span className="alert-dot" aria-hidden="true" />
            <span>{alert.headline}</span>
          </header>
          <p className="alert-body">{alert.detail}</p>
        </article>
      ))}
    </section>
  )
}
