import { useEffect, useReducer, useState } from 'react'
import App from './App'
import { Home } from './components/Home'
import { PlannerForm } from './components/PlannerForm'
import { decodeScenarioHash } from './state/share'
import { surfaceForHash } from './state/surface'
import type { Surface } from './state/surface'
import { initialPlannerState, plannerReducer } from './state/planner'
import { useSimulation } from './state/store'

/**
 * The top-level shell (planner spec): owns which surface is live —
 * light Home, light planner form, or today's dark simulator — and wraps
 * the existing app tree. No router: one surface state, conditional render,
 * the same pattern the overlays already use. The store hook lives HERE so
 * the share deep-link below and the Explore tree read the same snapshot —
 * `App` receives it as a prop; nothing instantiates a second store.
 */
export default function AppShell() {
  const sim = useSimulation()
  const [surface, setSurface] = useState<Surface>(() => surfaceForHash(window.location.hash))
  const [planner, dispatchPlanner] = useReducer(plannerReducer, undefined, initialPlannerState)

  // A shared link boots its exact scenario, restored into Explore from ANY
  // surface (spec) — Home is the default landing, never a dead end for a
  // link. Anything malformed or stale degrades silently: the decode returns
  // null and nothing happens. Runs once on mount; offline-safe (no fetch).
  // (Moved up from App when the shell was introduced — the surface switch
  // must accompany the restore, and only the shell owns the surface.)
  useEffect(() => {
    const shared = decodeScenarioHash(window.location.hash)
    if (shared) {
      sim.dispatch({ type: 'loadShared', scenario: shared })
      setSurface('explore')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only by design; dispatch is stable
  }, [])

  // The light token set is shared by Home and the planner form; the dark
  // theme stays Explore-only. Toggling the body class scopes the light
  // ground/text without touching any dark-surface rule.
  useEffect(() => {
    document.body.classList.toggle('light-ui', surface !== 'explore')
  }, [surface])

  if (surface === 'explore') {
    return (
      <>
        <App sim={sim} />
        <button
          type="button"
          className="explore-exit"
          onClick={() => setSurface('home')}
          aria-label="Back to home"
          title="Back to home"
        >
          ← Home
        </button>
      </>
    )
  }

  if (surface === 'planner') {
    return (
      <PlannerForm
        planner={planner}
        dispatchPlanner={dispatchPlanner}
        onHome={() => setSurface('home')}
        onExplore={() => setSurface('explore')}
      />
    )
  }

  return <Home onPlanDay={() => setSurface('planner')} onExplore={() => setSurface('explore')} />
}
