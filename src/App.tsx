import { useMemo } from 'react'
import { DEMO_DATA } from './data'
import { deadlineOf } from './engine'
import { FieldCanvas } from './components/FieldCanvas'
import { Header } from './components/Header'
import { ConstraintPanel } from './components/ConstraintPanel'
import { ScenariosPanel } from './components/ScenariosPanel'
import { StatsPanel } from './components/StatsPanel'
import { DetailsPanel } from './components/DetailsPanel'
import { AlertsPanel } from './components/AlertsPanel'
import { DestinationsRail } from './components/DestinationsRail'
import { Timeline } from './components/Timeline'
import { useSimulation } from './state/store'
import { buildDepartureAlerts } from './state/alerts'
import { SIM_WINDOW_END_MS, SIM_WINDOW_START_MS } from './sim/clock'

/**
 * One snapshot per change (spec): the store runs the recompute pipeline and
 * every surface below renders the same engine output. Nothing downstream
 * computes its own truth.
 */
export default function App() {
  const { clock, constraints, results, summary, selectedId, scenarios, dispatch } = useSimulation()

  const origin = DEMO_DATA.locationById.get(constraints.originId)

  const criticalConnIds = useMemo(() => {
    const ids = new Set<string>()
    for (const r of results) if (r.criticalConnId) ids.add(r.criticalConnId)
    return ids
  }, [results])

  const markers = useMemo(
    () =>
      DEMO_DATA.connections
        .filter((c) => c.depart >= SIM_WINDOW_START_MS && c.depart <= SIM_WINDOW_END_MS)
        .map((c) => ({ id: c.id, depart: c.depart, label: c.label, critical: criticalConnIds.has(c.id) })),
    [criticalConnIds],
  )

  const selected = useMemo(() => results.find((r) => r.location.id === selectedId) ?? null, [results, selectedId])

  const alerts = useMemo(() => buildDepartureAlerts(DEMO_DATA, constraints), [constraints])

  // deadline − clock, in minutes — how much of the window still fits.
  const remainingMin = Math.max(
    0,
    Math.round((deadlineOf(constraints.now, constraints.availableHours) - constraints.now) / 60_000),
  )

  return (
    <div className="app-shell">
      <Header
        originName={origin?.name ?? constraints.originId}
        playing={clock.playing}
        onReset={() => dispatch({ type: 'reset' })}
      />
      <div className="app-main">
        <aside className="rail rail-left">
          <ConstraintPanel
            originId={constraints.originId}
            budgetINR={constraints.budgetINR}
            availableHours={constraints.availableHours}
            onOrigin={(id) => dispatch({ type: 'setOrigin', id })}
            onBudget={(inr) => dispatch({ type: 'setBudget', inr })}
            onAvailableHours={(hours) => dispatch({ type: 'setAvailableHours', hours })}
          />
          <ScenariosPanel
            scenarios={scenarios}
            onSave={(name) => dispatch({ type: 'saveScenario', name })}
            onLoad={(name) => dispatch({ type: 'loadScenario', name })}
            onDelete={(name) => dispatch({ type: 'deleteScenario', name })}
          />
          <AlertsPanel alerts={alerts} />
          <StatsPanel
            summary={summary}
            originName={origin?.name ?? constraints.originId}
            originRegion={origin?.region ?? '—'}
            budgetINR={constraints.budgetINR}
            remainingMin={remainingMin}
            criticalCount={criticalConnIds.size}
          />
          <DetailsPanel result={selected} />
        </aside>
        <main className="field-area" aria-label="Possibility field">
          <FieldCanvas
            results={results}
            originId={constraints.originId}
            originName={origin?.name ?? constraints.originId}
            selectedId={selectedId}
            onSelect={(id) => dispatch({ type: 'select', id })}
          />
          <p className="field-caption">Abstract reachability field — not a geographic map.</p>
        </main>
        <aside className="rail rail-right">
          <DestinationsRail
            results={results}
            selectedId={selectedId}
            onSelect={(id) => dispatch({ type: 'select', id })}
          />
        </aside>
      </div>
      <Timeline
        nowMs={clock.nowMs}
        playing={clock.playing}
        speedMultiplier={clock.speedMultiplier}
        summary={summary}
        markers={markers}
        onSetNow={(ms) => dispatch({ type: 'setNow', ms })}
        onTogglePlay={() => dispatch({ type: 'togglePlay' })}
        onStep={(minutes) => dispatch({ type: 'step', minutes })}
        onSetSpeed={(multiplier) => dispatch({ type: 'setSpeed', multiplier })}
      />
    </div>
  )
}
