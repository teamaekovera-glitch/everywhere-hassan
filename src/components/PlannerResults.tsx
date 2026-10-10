import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_MIN_TRANSFER_MIN } from '../engine'
import { planDayTrips } from '../engine/planner'
import type { PoiCatalog, TripPlan } from '../engine/planner'
import type { Simulation } from '../state/store'
import { ACTIVITIES, DEMO_DATA, MEALS, SPOTS } from '../data'
import { formatIst } from '../sim/clock'
import { formatINR } from '../engine/format'
import { formatDuration } from '../viz/format'
import { INTERESTS, PLANNER_CLOCK_MS } from '../state/planner'
import type { PlannerRequest } from '../state/planner'
import { matchesTab } from './destinationImages'
import type { TripTab } from './destinationImages'
import { photoForDestination } from './destinationPhotos'
import { FieldCanvas } from './FieldCanvas'
import { TripDetail } from './TripDetail'
import { DestinationModal } from './DestinationModal'
import { plansToFieldResults } from './tripPlan'

/**
 * The results surface (planner spec). The ranked plans are computed in ONE
 * place — this memo is the results snapshot — and every panel (cards, field,
 * detail) renders that same output; selection flows through the sim store's
 * `selectedId`, so a node click highlights the card and vice versa. No panel
 * computes its own truth.
 */

/** The engine's catalog shape from the bundled data modules (structural bridge). */
const PLANNER_POI: PoiCatalog = {
  activities: [...ACTIVITIES],
  meals: [...MEALS],
  spots: [...SPOTS],
}

interface PlannerResultsProps {
  sim: Simulation
  request: PlannerRequest
  onEditRequest: () => void
  onHome: () => void
  onExplore: () => void
}

const TABS: { id: TripTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'short', label: 'Short Trips' },
  { id: 'long', label: 'Long Trips' },
]

function outboundDurationMin(plan: TripPlan): number {
  return (plan.outbound.arriveAt - plan.outbound.departAt) / 60_000
}

export function PlannerResults({ sim, request, onEditRequest, onHome, onExplore }: PlannerResultsProps) {
  const [tab, setTab] = useState<TripTab>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const detailRef = useRef<HTMLElement>(null)

  // The one results computation for this request — same shape as Explore's
  // recompute pipeline: memoized engine output, never re-derived downstream.
  const plans = useMemo(
    () =>
      planDayTrips(DEMO_DATA, PLANNER_POI, {
        originId: request.originId,
        now: PLANNER_CLOCK_MS,
        availableHours: request.availableHours,
        budgetINR: request.budgetINR,
        minTransferMin: DEFAULT_MIN_TRANSFER_MIN,
        interests: request.interests,
      }),
    [request],
  )

  const fieldResults = useMemo(() => plansToFieldResults(plans, DEMO_DATA), [plans])
  const originName = DEMO_DATA.locationById.get(request.originId)?.name ?? request.originId
  const deadlineMs = PLANNER_CLOCK_MS + request.availableHours * 3_600_000

  // Card filter mirrors the Explore rail: trip length tabs over the outbound.
  const visible = useMemo(
    () => plans.filter((plan) => matchesTab(tab, outboundDurationMin(plan))),
    [plans, tab],
  )
  const selectedPlan = plans.find((plan) => plan.destinationId === sim.selectedId) ?? null

  // A new selection reveals the detail below — bring it into view.
  useEffect(() => {
    if (selectedPlan) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setModalOpen(false)
  }, [selectedPlan?.destinationId]) // eslint-disable-line react-hooks/exhaustive-deps -- selection id only

  const select = (id: string | null) => sim.dispatch({ type: 'select', id })

  return (
    <div className="light-page planner-results">
      <header className="planner-head">
        <button type="button" className="cta-quiet" onClick={onHome}>
          ← Home
        </button>
        <div className="planner-head-actions">
          <button type="button" className="cta-quiet" onClick={onEditRequest} data-testid="edit-request">
            Edit trip request
          </button>
          <button type="button" className="cta-quiet" onClick={onExplore}>
            Explore the field
          </button>
        </div>
      </header>

      <h1 className="planner-title">Your day, ranked</h1>
      <p className="results-echo" data-testid="results-echo">
        From {originName} · {formatINR(request.budgetINR)} · {request.availableHours} h · departures from{' '}
        {formatIst(PLANNER_CLOCK_MS)}
        {request.interests.length > 0 && (
          <>
            {' '}
            · priority:{' '}
            {request.interests
              .map((interest, index) => `${index + 1}. ${INTERESTS.find((i) => i.id === interest)?.label ?? interest}`)
              .join(', ')}
          </>
        )}
      </p>

      {plans.length === 0 ? (
        <section className="planner-empty" aria-live="polite" data-testid="results-empty">
          <h2>No trip fits this request yet</h2>
          <p className="planner-empty-note">
            Every plan needs a real stay — at least 90 minutes on the ground with something to do or
            a meal that fits, all inside {formatINR(request.budgetINR)} and back within{' '}
            {request.availableHours} h. Try a bigger budget, a longer window, or a closer origin.
          </p>
          <button type="button" className="cta-loud" onClick={onEditRequest}>
            Adjust my request
          </button>
        </section>
      ) : (
        <>
          <div className="results-main">
            <section className="results-cards" aria-label="Ranked trip plans">
              <div className="dest-tabs" role="group" aria-label="Trip length filter">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`dest-tab${tab === t.id ? ' active' : ''}`}
                    aria-pressed={tab === t.id}
                    onClick={() => setTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {visible.length === 0 && (
                <p className="planner-hint">No {tab === 'short' ? 'short' : 'long'} trips in this plan set.</p>
              )}

              <ol className="plan-card-list" data-testid="plan-card-list">
                {visible.map((plan, index) => {
                  const location = DEMO_DATA.locationById.get(plan.destinationId)
                  const selected = sim.selectedId === plan.destinationId
                  const photo = photoForDestination(plan.destinationId)
                  return (
                    <li key={plan.destinationId}>
                      <article
                        className={`plan-card${selected ? ' selected' : ''}`}
                        data-testid="plan-card"
                        aria-pressed={selected}
                        onClick={() => select(selected ? null : plan.destinationId)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            select(selected ? null : plan.destinationId)
                          }
                        }}
                        tabIndex={0}
                        role="button"
                      >
                        <div className="plan-card-photo">
                          {photo ? (
                            <img src={photo} alt="" width={72} height={72} loading="lazy" />
                          ) : (
                            <span className="plan-card-monogram" aria-hidden="true">
                              {(location?.name ?? plan.destinationId).charAt(0)}
                            </span>
                          )}
                        </div>
                        <div className="plan-card-body">
                          <header className="plan-card-head">
                            <h3>
                              <span className="plan-rank">#{index + 1}</span> {location?.name ?? plan.destinationId}
                            </h3>
                            <span className="plan-score-hint">best match</span>
                          </header>
                          <p className="plan-route" data-testid="plan-route">
                            Depart {formatIst(plan.departAt)} → {formatDuration(plan.dwellMin)} stay → back{' '}
                            {formatIst(plan.arriveBackAt)}
                          </p>
                          <dl className="plan-costs" data-testid="plan-costs">
                            <div>
                              <dt>Travel</dt>
                              <dd>{formatINR(plan.costs.travelINR)}</dd>
                            </div>
                            <div>
                              <dt>Activities</dt>
                              <dd>{formatINR(plan.costs.activitiesINR)}</dd>
                            </div>
                            <div>
                              <dt>Meal</dt>
                              <dd>{plan.meal ? formatINR(plan.costs.mealINR) : '—'}</dd>
                            </div>
                            <div>
                              <dt>Total</dt>
                              <dd>
                                {formatINR(plan.costs.totalINR)} <span className="estimated-tag">estimated</span>
                              </dd>
                            </div>
                          </dl>
                          <div className="plan-chips">
                            {plan.interestsMatched.map((interest) => (
                              <span key={interest} className="plan-chip">
                                {INTERESTS.find((i) => i.id === interest)?.label ?? interest}
                              </span>
                            ))}
                            {!plan.meal && <span className="plan-chip plan-chip-quiet">no meal fits</span>}
                          </div>
                        </div>
                      </article>
                    </li>
                  )
                })}
              </ol>
              <p className="results-provenance" data-testid="results-provenance">
                Fares, activities, and meals are synthetic estimates — not live transport data. No
                accounts, no tracking.
              </p>
            </section>

            <section className="results-field" aria-label="Feasible trips field">
              <FieldCanvas
                results={fieldResults}
                originId={request.originId}
                originName={originName}
                selectedId={sim.selectedId}
                onSelect={select}
              />
              <p className="field-caption">
                Feasible trips only — the field shrinks to destinations with a real plan. Abstract
                layout, not a geographic map.
              </p>
            </section>
          </div>

          {selectedPlan && (
            <section ref={detailRef} className="results-detail">
              <TripDetail
                plan={selectedPlan}
                budgetINR={request.budgetINR}
                deadlineMs={deadlineMs}
                onClose={() => select(null)}
                onOpenDestination={() => setModalOpen(true)}
              />
            </section>
          )}
        </>
      )}

      {modalOpen && selectedPlan && (
        <DestinationModal plan={selectedPlan} onClose={() => setModalOpen(false)} />
      )}
    </div>
  )
}
