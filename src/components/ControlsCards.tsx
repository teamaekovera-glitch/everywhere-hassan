import { DEMO_DATA } from '../data'
import { BUDGET_MAX_INR, BUDGET_MIN_INR, HOURS_MAX, HOURS_MIN } from '../engine/defaults'
import { formatINR } from '../engine/format'
import { CardIcon, ClockIcon, PinIcon } from './Icons'

/**
 * The mockup's left column: one honest control per card. Each dispatches
 * into the one store — field, stats, alerts and details all recompute from
 * the same snapshot. Sliders and the origin select stay natively
 * keyboard-operable; the visible labels are their accessible names.
 */

interface OriginCardProps {
  originId: string
  onOrigin: (id: string) => void
}

export function OriginCard({ originId, onOrigin }: OriginCardProps) {
  return (
    <section className="card" aria-label="Starting from">
      <div className="card-head">
        <span className="card-icon" aria-hidden="true">
          <PinIcon />
        </span>
        <label className="card-label" htmlFor="constraint-origin">
          Starting from
        </label>
      </div>
      <select
        id="constraint-origin"
        className="card-select"
        data-testid="constraint-origin"
        value={originId}
        onChange={(e) => onOrigin(e.currentTarget.value)}
      >
        {DEMO_DATA.locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}, {l.region}
          </option>
        ))}
      </select>
    </section>
  )
}

interface BudgetCardProps {
  budgetINR: number
  onBudget: (inr: number) => void
}

export function BudgetCard({ budgetINR, onBudget }: BudgetCardProps) {
  return (
    <section className="card" aria-label="Budget">
      <div className="card-head">
        <span className="card-icon" aria-hidden="true">
          <CardIcon />
        </span>
        <label className="card-label" htmlFor="constraint-budget">
          Budget
        </label>
      </div>
      <span className="card-value" data-testid="constraint-budget-value">
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
      <div className="card-extents" aria-hidden="true">
        <span>{formatINR(BUDGET_MIN_INR)}</span>
        <span>{formatINR(BUDGET_MAX_INR)}</span>
      </div>
    </section>
  )
}

interface TimeCardProps {
  availableHours: number
  onAvailableHours: (hours: number) => void
}

function formatHours(hours: number): string {
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
}

export function TimeCard({ availableHours, onAvailableHours }: TimeCardProps) {
  return (
    <section className="card" aria-label="Time available">
      <div className="card-head">
        <span className="card-icon" aria-hidden="true">
          <ClockIcon />
        </span>
        <label className="card-label" htmlFor="constraint-hours">
          Time available
        </label>
      </div>
      <span className="card-value" data-testid="constraint-hours-value">
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
      <div className="card-extents" aria-hidden="true">
        <span>{HOURS_MIN}h</span>
        <span>{HOURS_MAX}h</span>
      </div>
    </section>
  )
}

interface LiveModeCardProps {
  playing: boolean
  onToggle: () => void
}

/** Bound to the same clock as the timeline's play key — one state, two controls. */
export function LiveModeCard({ playing, onToggle }: LiveModeCardProps) {
  return (
    <section className="card live-card" aria-label="Live mode">
      <div className="card-head">
        <span className="card-icon" aria-hidden="true">
          <ClockIcon />
        </span>
        <div className="live-copy">
          <span className="card-label" id="live-mode-label">
            Live mode
          </span>
          <span className="live-sub">Watch your options change as time moves.</span>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={playing}
        aria-labelledby="live-mode-label"
        data-testid="live-mode-toggle"
        className={`switch${playing ? ' on' : ''}`}
        onClick={onToggle}
      >
        <span className="switch-knob" aria-hidden="true" />
      </button>
    </section>
  )
}
