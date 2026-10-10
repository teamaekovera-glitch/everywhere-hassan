import { DEMO_DATA } from '../data'
import { BUDGET_MAX_INR, BUDGET_MIN_INR, HOURS_MAX, HOURS_MIN } from '../engine/defaults'
import { formatINR } from '../engine/format'

interface ConstraintPanelProps {
  originId: string
  budgetINR: number
  availableHours: number
  onOrigin: (id: string) => void
  onBudget: (inr: number) => void
  onAvailableHours: (hours: number) => void
}

function formatHours(hours: number): string {
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
}

/**
 * The constraint panel (spec): origin selector over the bundled dataset,
 * budget and time sliders with numeric readouts. Every change dispatches
 * into the one store — field, stats, alerts and details all recompute from
 * the same snapshot. Range thumbs stay keyboard-operable natively; the
 * visible labels double as the accessible names.
 */
export function ConstraintPanel({
  originId,
  budgetINR,
  availableHours,
  onOrigin,
  onBudget,
  onAvailableHours,
}: ConstraintPanelProps) {
  return (
    <section className="panel constraint-panel" aria-label="Travel constraints">
      <h2 className="panel-kicker">Constraints</h2>

      <div className="constraint-row">
        <label className="constraint-label" htmlFor="constraint-origin">
          Starting from
        </label>
        <select
          id="constraint-origin"
          data-testid="constraint-origin"
          value={originId}
          onChange={(e) => onOrigin(e.currentTarget.value)}
        >
          {DEMO_DATA.locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} · {l.region}
            </option>
          ))}
        </select>
      </div>

      <div className="constraint-row">
        <label className="constraint-label" htmlFor="constraint-budget">
          Budget
        </label>
        <span className="constraint-value" data-testid="constraint-budget-value">
          {formatINR(budgetINR)}
        </span>
        <input
          id="constraint-budget"
          data-testid="constraint-budget"
          type="range"
          min={BUDGET_MIN_INR}
          max={BUDGET_MAX_INR}
          step={50}
          value={budgetINR}
          aria-valuetext={`${formatINR(budgetINR)} estimated rupees`}
          onChange={(e) => onBudget(Number(e.currentTarget.value))}
        />
        <div className="constraint-extents" aria-hidden="true">
          <span>{formatINR(BUDGET_MIN_INR)}</span>
          <span>{formatINR(BUDGET_MAX_INR)}</span>
        </div>
      </div>

      <div className="constraint-row">
        <label className="constraint-label" htmlFor="constraint-hours">
          Time available
        </label>
        <span className="constraint-value" data-testid="constraint-hours-value">
          {formatHours(availableHours)}
        </span>
        <input
          id="constraint-hours"
          data-testid="constraint-hours"
          type="range"
          min={HOURS_MIN}
          max={HOURS_MAX}
          step={1}
          value={availableHours}
          aria-valuetext={`${availableHours} hours available`}
          onChange={(e) => onAvailableHours(Number(e.currentTarget.value))}
        />
        <div className="constraint-extents" aria-hidden="true">
          <span>{HOURS_MIN}h</span>
          <span>{HOURS_MAX}h</span>
        </div>
      </div>
    </section>
  )
}
