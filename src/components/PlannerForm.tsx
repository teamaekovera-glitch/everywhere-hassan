import { formatINR } from '../engine/format'
import { LOCATIONS } from '../data'
import {
  INTERESTS,
  PLANNER_BUDGET_MAX,
  PLANNER_BUDGET_MIN,
  PLANNER_HOURS_MAX,
  PLANNER_HOURS_MIN,
} from '../state/planner'
import type { PlannerAction, PlannerState } from '../state/planner'

interface PlannerFormProps {
  planner: PlannerState
  dispatchPlanner: (action: PlannerAction) => void
  onHome: () => void
  onExplore: () => void
  /** Fired after "Find my trips" stores the request — the shell swaps to the results view. */
  onSubmitted: () => void
}

/**
 * The light planner form (planner spec): origin, budget, time window, and
 * the seven interest chips. Chips are toggled in selection order — the
 * number badge shows the priority the engine will use when packing
 * activities (first chosen wins). "Find my trips" stores the request; the
 * shell then shows the ranked results view built from it.
 */
export function PlannerForm({ planner, dispatchPlanner, onHome, onExplore, onSubmitted }: PlannerFormProps) {
  const { draft } = planner

  return (
    <div className="light-page planner">
      <header className="planner-head">
        <button type="button" className="cta-quiet" onClick={onHome}>
          ← Home
        </button>
        <button type="button" className="cta-quiet" onClick={onExplore}>
          Explore the field
        </button>
      </header>

      <h1 className="planner-title">Plan my day</h1>
      <p className="planner-sub">
        One origin, one budget, one time window, a few interests — ranked round trips that bring
        you home on time, with a real stay at the destination (at least 90 minutes).
      </p>

      <form
        className="planner-form"
        onSubmit={(e) => {
          e.preventDefault()
          dispatchPlanner({ type: 'submit' })
          onSubmitted()
        }}
      >
        <div className="planner-card">
          <label className="planner-label" htmlFor="planner-origin">
            Starting from
          </label>
          <select
            id="planner-origin"
            className="planner-select"
            value={draft.originId}
            onChange={(e) => dispatchPlanner({ type: 'setOrigin', id: e.target.value })}
          >
            {LOCATIONS.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} — {loc.region}
              </option>
            ))}
          </select>
        </div>

        <div className="planner-card">
          <label className="planner-label" htmlFor="planner-budget">
            Budget
          </label>
          <span className="planner-value">
            {formatINR(draft.budgetINR)}
            <span className="unit">per person</span>
          </span>
          <input
            id="planner-budget"
            type="range"
            min={PLANNER_BUDGET_MIN}
            max={PLANNER_BUDGET_MAX}
            step={50}
            value={draft.budgetINR}
            onChange={(e) => dispatchPlanner({ type: 'setBudget', inr: Number(e.target.value) })}
          />
          <div className="planner-extents">
            <span>{formatINR(PLANNER_BUDGET_MIN)}</span>
            <span>{formatINR(PLANNER_BUDGET_MAX)}</span>
          </div>
        </div>

        <div className="planner-card">
          <label className="planner-label" htmlFor="planner-hours">
            Time window
          </label>
          <span className="planner-value">
            {draft.availableHours}
            <span className="unit">hours</span>
          </span>
          <input
            id="planner-hours"
            type="range"
            min={PLANNER_HOURS_MIN}
            max={PLANNER_HOURS_MAX}
            step={1}
            value={draft.availableHours}
            onChange={(e) => dispatchPlanner({ type: 'setHours', hours: Number(e.target.value) })}
          />
          <div className="planner-extents">
            <span>{PLANNER_HOURS_MIN} h</span>
            <span>{PLANNER_HOURS_MAX} h</span>
          </div>
        </div>

        <fieldset className="planner-card planner-interests">
          <legend className="planner-label">Interests — first picked ranks highest</legend>
          <div className="chip-row" role="group">
            {INTERESTS.map(({ id, label }) => {
              const priority = draft.interests.indexOf(id)
              const selected = priority !== -1
              return (
                <button
                  key={id}
                  type="button"
                  className={`chip${selected ? ' selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => dispatchPlanner({ type: 'toggleInterest', interest: id })}
                >
                  {selected && <span className="chip-priority">{priority + 1}</span>}
                  {label}
                </button>
              )
            })}
          </div>
        </fieldset>

        <button type="submit" className="cta-loud planner-submit">
          Find my trips
        </button>
      </form>

      <p className="planner-hint">
        Set the form above and press “Find my trips” — ranked round trips with every leg, minute,
        and rupee accounted for.
      </p>
    </div>
  )
}
