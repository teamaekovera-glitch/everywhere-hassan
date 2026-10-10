import { useState } from 'react'
import type { DestinationResult, Journey } from '../engine/types'
import { describeUnlock, probeUnlock } from '../engine'
import type { UnlockProbe } from '../engine'
import { DEMO_DATA } from '../data'
import type { Constraints } from '../engine/types'
import { formatIst } from '../sim/clock'
import { formatINR } from '../engine/format'
import { formatDuration } from '../viz/format'
import type { ProbePreview } from '../state/store'

/**
 * The body that expands inside a selected destination card: the engine's
 * reason, every nondominated journey with its leg breakdown, the round-trip
 * badge — or, for ghosts, the unlock probe's "what would it take?" inline.
 * Revalidated on every scrub — expired journeys stop being listed.
 */

function journeyDurationMin(j: Journey): number {
  return (j.arriveAt - j.departAt) / 60_000
}

function LegList({ journey }: { journey: Journey }) {
  return (
    <ol className="leg-list">
      {journey.legs.map((leg) => (
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
  )
}

/**
 * The unlock probe's transient preview: the field is recomputing from the
 * relaxed snapshot, so the banner names the relaxation and offers the way
 * back. Saved scenarios and the constraint sliders stay untouched. Rendered
 * over the field so the lens is visible whatever is selected.
 */
export function PreviewBanner({ preview, onReset }: { preview: ProbePreview; onReset: () => void }) {
  return (
    <div className="probe-preview-banner" data-testid="probe-preview-banner" role="status">
      <div className="preview-copy">
        <strong>Previewing a relaxation</strong>
        <p>{preview.summary}</p>
      </div>
      <button
        type="button"
        className="probe-btn probe-reset"
        data-testid="probe-reset"
        onClick={onReset}
        aria-label="Reset the probe preview and restore the baseline"
      >
        Reset
      </button>
    </div>
  )
}

/**
 * The "what would it take?" probe for one unreachable destination. The probe
 * runs on demand — only when the affordance is clicked — never on recompute.
 * Remounting on `probeFingerprint` keeps a stale answer impossible.
 */
function ProbeSection({
  result,
  constraints,
  onApplyPreview,
}: {
  result: DestinationResult
  constraints: Constraints
  onApplyPreview: (preview: ProbePreview) => void
}) {
  const [probe, setProbe] = useState<UnlockProbe | null>(null)

  function runProbe() {
    setProbe(probeUnlock(DEMO_DATA, constraints, result.location.id))
  }

  function applyBudget(p: UnlockProbe) {
    if (p.minExtraBudget === null) return
    const next = constraints.budgetINR + p.minExtraBudget
    onApplyPreview({
      budgetINR: next,
      summary: `Budget raised ${formatINR(constraints.budgetINR)} → ${formatINR(next)} (transient preview — not saved)`,
    })
  }

  function applyTime(p: UnlockProbe) {
    if (p.minExtraTime === null) return
    if (p.timeRelaxation === 'departure') {
      const rewoundTo = constraints.now - p.minExtraTime * 60_000
      onApplyPreview({
        nowMs: rewoundTo,
        // Stretch the window so the absolute deadline stays fixed — the same
        // relaxation the probe searched ("leave earlier, same flexibility").
        availableHours: constraints.availableHours + p.minExtraTime / 60,
        summary: `Clock rewound ${p.minExtraTime} min → ${formatIst(rewoundTo)} (transient preview — not saved)`,
      })
    } else {
      onApplyPreview({
        availableHours: constraints.availableHours + p.minExtraTime / 60,
        summary: `Deadline extended ${p.minExtraTime} min (transient preview — not saved)`,
      })
    }
  }

  if (!probe) {
    return (
      <div className="probe-section" data-testid="probe-section">
        <button type="button" className="probe-btn" data-testid="probe-open" onClick={runProbe}>
          What would it take?
        </button>
        <p className="probe-note">Probe runs on demand — read-only, nothing saved.</p>
      </div>
    )
  }

  const headline = describeUnlock(probe)
  const itinerary = probe.cheapestUnlockedItinerary

  return (
    <div className="probe-section" data-testid="probe-section">
      <p className="probe-headline" data-testid="probe-headline">
        {headline ?? 'Nothing brings it back from here — no budget inside the app’s range and no time shift within the reference day unlocks this destination.'}
      </p>

      {probe.minExtraBudget !== null && (
        <div className="probe-row" data-testid="probe-delta-budget">
          <span>
            {formatINR(probe.minExtraBudget)} more on the budget <span className="probe-fare-note">(estimated fares)</span>
          </span>
          <button type="button" className="probe-btn" data-testid="probe-apply-budget" onClick={() => applyBudget(probe)}>
            Show it
          </button>
        </div>
      )}

      {probe.minExtraTime !== null && (
        <div className="probe-row" data-testid="probe-delta-time">
          <span>
            {probe.timeRelaxation === 'departure' ? `${probe.minExtraTime} min earlier start` : `${probe.minExtraTime} min more on the deadline`}
          </span>
          <button type="button" className="probe-btn" data-testid="probe-apply-time" onClick={() => applyTime(probe)}>
            Show it
          </button>
        </div>
      )}

      {probe.blockingConnection && (
        <p className="probe-blame" data-testid="probe-blocking">
          Fragile link — {probe.blockingConnection.label}. Lose it and even the relaxed state strands this destination.
        </p>
      )}

      {itinerary && (
        <div className="journey probe-itinerary" data-testid="probe-itinerary">
          <div className="journey-summary">
            <span className="journey-window">
              {formatIst(itinerary.departAt)} → {formatIst(itinerary.arriveAt)}
            </span>
            <span className="journey-meta">
              {formatDuration(journeyDurationMin(itinerary))} · {formatINR(itinerary.costINR)} (estimated) ·{' '}
              {itinerary.transfers === 0 ? 'direct' : `${itinerary.transfers} transfer${itinerary.transfers === 1 ? '' : 's'}`}
            </span>
          </div>
          <LegList journey={itinerary} />
        </div>
      )}

      <p className="probe-note">Preview only — the field relaxes until you reset or touch any control.</p>
    </div>
  )
}

interface DestinationDetailsProps {
  result: DestinationResult
  /** The folded constraints the probe runs against (a lens over the live sim). */
  constraints: Constraints
  /** Constraint fingerprint — a changed snapshot remounts the probe section. */
  probeFingerprint: string
  onApplyPreview: (preview: ProbePreview) => void
}

export function DestinationDetails({ result, constraints, probeFingerprint, onApplyPreview }: DestinationDetailsProps) {
  return (
    <div className="dest-details" aria-label={`Details for ${result.location.name}`}>
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
                <LegList journey={j} />
              </li>
            ))}
          </ul>
          {result.roundTrip ? (
            <p className="roundtrip-badge" data-testid="roundtrip-badge">
              Day trip possible — return arrives {formatIst(result.roundTrip.arriveAt)} · {formatINR(result.roundTrip.costINR)} return fare
              (estimated)
            </p>
          ) : (
            <p className="roundtrip-none">No valid return inside the deadline and budget — one-way reachability only.</p>
          )}
        </>
      ) : (
        <>
          <p className="details-ghost-note">The field keeps this destination as a grey ghost at the rim while no valid itinerary survives.</p>
          <ProbeSection key={probeFingerprint} result={result} constraints={constraints} onApplyPreview={onApplyPreview} />
        </>
      )}
    </div>
  )
}
