import type { Dispatch } from 'react'
import { formatIst12 } from '../sim/clock'
import type { SimAction } from '../state/store'

interface TimelapseOverlayProps {
  nowMs: number
  dispatch: Dispatch<SimAction>
}

/**
 * The full-day time-lapse's single affordance (spec): a prominent
 * timestamp over the breathing field and a one-key exit. The exit is a
 * mode action — the sim itself keeps running until the window edge or
 * the user's next manual input.
 */
export function TimelapseOverlay({ nowMs, dispatch }: TimelapseOverlayProps) {
  return (
    <div className="timelapse-overlay" data-testid="timelapse-overlay" role="status" aria-live="off">
      <span className="timelapse-time" data-testid="timelapse-time">
        {formatIst12(nowMs)}
      </span>
      <span className="timelapse-label">The whole day, at a breath</span>
      <button
        type="button"
        className="timelapse-exit"
        onClick={() => dispatch({ type: 'timelapseStop' })}
        aria-label="Exit the time-lapse"
      >
        Exit
      </button>
    </div>
  )
}
