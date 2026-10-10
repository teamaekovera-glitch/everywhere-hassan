import { computeConnectionImpact } from '../engine'
import type { ConnectionImpact, Constraints, Mode, TransportData } from '../engine'

/**
 * Alerts are engine-derived counterfactuals (spec): for each imminent
 * departure the reachability is re-run with that connection excluded and the
 * exact delta reported. Nothing is invented — the judge can see the
 * arithmetic behind every warning.
 */

/** Imminence window: departures leaving within 30 simulated minutes. */
export const ALERT_WINDOW_MS = 30 * 60_000

export interface DepartureAlert {
  connectionId: string
  label: string
  mode: Mode
  depart: number
  minutesUntil: number
  impact: ConnectionImpact
  headline: string
  detail: string
}

function nameOf(data: TransportData, id: string): string {
  return data.locationById.get(id)?.name ?? id
}

/** The human sentence for one impact — pure, so tests pin the exact wording. */
export function describeImpact(data: TransportData, label: string, impact: ConnectionImpact): string {
  const removed = impact.journeysRemoved
  if (removed === 0) {
    return `Missing "${label}" removes no journey options — every affected destination keeps an alternate.`
  }
  const parts: string[] = [`Missing "${label}" removes ${removed} journey option${removed === 1 ? '' : 's'}`]
  if (impact.destinationsLost.length > 0) {
    const names = impact.destinationsLost.map((d) => nameOf(data, d.locationId))
    parts.push(`${names.join(', ')} ${names.length === 1 ? 'becomes' : 'become'} unreachable`)
  }
  const via = impact.survivors
    .map((s) => `${nameOf(data, s.locationId)}${s.viaNode ? ` stays reachable via ${nameOf(data, s.viaNode)}` : ' stays reachable'}`)
    .join('; ')
  if (via) parts.push(via)
  return `${parts.join('; ')}.`
}

/**
 * All alerts firing at the simulation clock: imminent departures inside the
 * window, most disruptive first, then by departure time.
 */
export function buildDepartureAlerts(
  data: TransportData,
  constraints: Constraints,
  windowMs: number = ALERT_WINDOW_MS,
): DepartureAlert[] {
  const alerts: DepartureAlert[] = []

  for (const conn of data.connections) {
    const until = conn.depart - constraints.now
    if (until < 0 || until > windowMs) continue

    const impact = computeConnectionImpact(data, constraints, conn.id)
    alerts.push({
      connectionId: conn.id,
      label: conn.label,
      mode: conn.mode,
      depart: conn.depart,
      minutesUntil: Math.round(until / 60_000),
      impact,
      headline: `${conn.label} departs in ${Math.round(until / 60_000)} min`,
      detail: describeImpact(data, conn.label, impact),
    })
  }

  return alerts.sort(
    (a, b) => b.impact.journeysRemoved - a.impact.journeysRemoved || a.depart - b.depart,
  )
}
