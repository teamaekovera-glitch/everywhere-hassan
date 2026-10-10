import { useCallback, useEffect, useMemo } from 'react'
import { DEMO_DATA } from './data'
import { FieldCanvas } from './components/FieldCanvas'
import { Header } from './components/Header'
import { OriginCard, BudgetCard, TimeCard, LiveModeCard } from './components/ControlsCards'
import { StatsCard } from './components/StatsCard'
import { ScenariosPanel } from './components/ScenariosPanel'
import { PreviewBanner } from './components/DestinationDetails'
import { DestinationsRail } from './components/DestinationsRail'
import { AlertCard } from './components/AlertCard'
import { Timeline } from './components/Timeline'
import { StoryOverlay } from './components/StoryOverlay'
import { TimelapseOverlay } from './components/TimelapseOverlay'
import { useSimulation } from './state/store'
import { buildDepartureAlerts } from './state/alerts'
import { buildShareUrl, copyText, decodeScenarioHash, sharedScenarioFromState } from './state/share'
import { SIM_WINDOW_END_MS, SIM_WINDOW_START_MS } from './sim/clock'

/**
 * One snapshot per change (spec): the store runs the recompute pipeline and
 * every surface below renders the same engine output. Nothing downstream
 * computes its own truth.
 */
export default function App() {
  const { clock, constraints, results, summary, selectedId, scenarios, probePreview, story, timelapse, dispatch } =
    useSimulation()

  const origin = DEMO_DATA.locationById.get(constraints.originId)
  const originName = origin?.name ?? constraints.originId

  // A shared link boots its exact scenario (spec). Anything malformed or
  // stale degrades silently — the decode returns null and nothing happens.
  // Runs once on mount; offline-safe (no fetch, ever).
  useEffect(() => {
    const shared = decodeScenarioHash(window.location.hash)
    if (shared) dispatch({ type: 'loadShared', scenario: shared })
  }, [dispatch])

  // Copy link (spec): serialize the current snapshot with the SAME schema
  // localStorage uses and put the URL on the clipboard.
  const onShareLink = useCallback(async (): Promise<boolean> => {
    const scenario = sharedScenarioFromState({
      clockNowMs: clock.nowMs,
      speedMultiplier: clock.speedMultiplier,
      originId: constraints.originId,
      budgetINR: constraints.budgetINR,
      availableHours: constraints.availableHours,
      selectedId,
    })
    if (!scenario) return false
    return copyText(buildShareUrl(window.location.href, scenario))
  }, [clock.nowMs, clock.speedMultiplier, constraints.originId, constraints.budgetINR, constraints.availableHours, selectedId])

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

  const alerts = useMemo(() => buildDepartureAlerts(DEMO_DATA, constraints), [constraints])

  const probeFingerprint = `${constraints.originId}|${constraints.now}|${constraints.budgetINR}|${constraints.availableHours}`

  return (
    <div className="app-shell">
      <Header
        onReset={() => dispatch({ type: 'reset' })}
        onStory={() => dispatch({ type: 'storyStart' })}
        onTimelapse={() => dispatch({ type: 'timelapseStart' })}
        scenarioPanel={
          <ScenariosPanel
            scenarios={scenarios}
            onSave={(name) => dispatch({ type: 'saveScenario', name })}
            onLoad={(name) => dispatch({ type: 'loadScenario', name })}
            onDelete={(name) => dispatch({ type: 'deleteScenario', name })}
            onShareLink={onShareLink}
          />
        }
      />
      <div className="app-main">
        <aside className="rail rail-left" aria-label="Trip controls">
          <OriginCard originId={constraints.originId} onOrigin={(id) => dispatch({ type: 'setOrigin', id })} />
          <BudgetCard budgetINR={constraints.budgetINR} onBudget={(inr) => dispatch({ type: 'setBudget', inr })} />
          <TimeCard
            availableHours={constraints.availableHours}
            onAvailableHours={(hours) => dispatch({ type: 'setAvailableHours', hours })}
          />
          <LiveModeCard playing={clock.playing} onToggle={() => dispatch({ type: 'togglePlay' })} />
          <StatsCard summary={summary} criticalCount={criticalConnIds.size} />
        </aside>
        <main className="field-area" aria-label="Possibility field">
          {probePreview && (
            <PreviewBanner preview={probePreview} onReset={() => dispatch({ type: 'clearProbePreview' })} />
          )}
          <FieldCanvas
            results={results}
            originId={constraints.originId}
            originName={originName}
            selectedId={selectedId}
            onSelect={(id) => dispatch({ type: 'select', id })}
          />
          <p className="field-caption">Abstract reachability field — not a geographic map.</p>
        </main>
        <aside className="rail rail-right">
          <DestinationsRail
            results={results}
            selectedId={selectedId}
            constraints={constraints}
            probeFingerprint={probeFingerprint}
            onApplyPreview={(p) => dispatch({ type: 'applyProbePreview', preview: p })}
            onSelect={(id) => dispatch({ type: 'select', id })}
          />
          <AlertCard alerts={alerts} />
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
      {story && <StoryOverlay story={story} nowMs={clock.nowMs} summary={summary} dispatch={dispatch} />}
      {timelapse && <TimelapseOverlay nowMs={clock.nowMs} dispatch={dispatch} />}
    </div>
  )
}
