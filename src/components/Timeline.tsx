import { useRef } from 'react'
import type { ReachabilitySummary } from '../engine/types'
import {
  SIM_WINDOW_END_MS,
  SIM_WINDOW_SPAN_MS,
  SIM_WINDOW_START_MS,
  formatIst12,
} from '../sim/clock'

interface TimelineProps {
  nowMs: number
  playing: boolean
  speedMultiplier: number
  summary: ReachabilitySummary
  /** Every timetable departure inside the window; critical ones ring. */
  markers: { id: string; depart: number; label: string; critical: boolean }[]
  onSetNow: (ms: number) => void
  onTogglePlay: () => void
  onStep: (minutes: number) => void
  onSetSpeed: (multiplier: number) => void
}

const SPEEDS = [2, 5, 20]
/** Labelled hour ticks: 6 AM → 12 PM → 6 PM → 12 AM → 6 AM. */
const MAJOR_TICKS = [
  { hour: 6, label: '6 AM' },
  { hour: 12, label: '12 PM' },
  { hour: 18, label: '6 PM' },
  { hour: 24, label: '12 AM' },
  { hour: 30, label: '6 AM' },
]

function fracOf(ms: number): number {
  return (ms - SIM_WINDOW_START_MS) / SIM_WINDOW_SPAN_MS
}

/** "1 destination · 1 journey" — count lines read better singular at one. */
function plural(n: number, word: string): string {
  return `${word}${n === 1 ? '' : 's'}`
}

/**
 * The simulation's steering wheel (spec): a 06:00 → 06:00 (+1d) IST window
 * with a labelled cursor, draggable scrubber, play/pause, ±15-minute steps,
 * time warp, and every timetable departure as a marker. Scrubbing drives
 * the full recompute pipeline through the store.
 */
export function Timeline({
  nowMs,
  playing,
  speedMultiplier,
  summary,
  markers,
  onSetNow,
  onTogglePlay,
  onStep,
  onSetSpeed,
}: TimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null)

  function posToMs(clientX: number): number {
    const rect = trackRef.current!.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    return SIM_WINDOW_START_MS + f * SIM_WINDOW_SPAN_MS
  }

  const cursorFrac = Math.min(1, Math.max(0, fracOf(nowMs)))

  return (
    <section className="timeline" aria-label="Simulation timeline">
      <div className="tl-controls">
        <button className="tl-btn" onClick={() => onStep(-15)} aria-label="Step back 15 minutes" title="−15 min">
          −15m
        </button>
        <button
          className={`tl-btn tl-play${playing ? ' playing' : ''}`}
          onClick={onTogglePlay}
          aria-label={playing ? 'Pause simulation' : 'Play simulation'}
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <button className="tl-btn" onClick={() => onStep(15)} aria-label="Step forward 15 minutes" title="+15 min">
          +15m
        </button>
        <label className="tl-warp">
          <span>Time warp</span>
          <select value={speedMultiplier} onChange={(e) => onSetSpeed(Number(e.target.value))} aria-label="Time warp">
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="tl-track-area">
        <div
          ref={trackRef}
          className="tl-track"
          role="slider"
          tabIndex={0}
          aria-label="Simulation clock — drag or use arrow keys"
          aria-valuemin={SIM_WINDOW_START_MS}
          aria-valuemax={SIM_WINDOW_END_MS}
          aria-valuenow={nowMs}
          aria-valuetext={formatIst12(nowMs)}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            onSetNow(posToMs(e.clientX))
          }}
          onPointerMove={(e) => {
            if (e.buttons & 1) onSetNow(posToMs(e.clientX))
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              e.preventDefault()
              onStep(-15)
            } else if (e.key === 'ArrowRight') {
              e.preventDefault()
              onStep(15)
            }
          }}
        >
          <div className="tl-progress" style={{ width: `${cursorFrac * 100}%` }} />
          {Array.from({ length: 25 }, (_, i) => i * 60).map((minute) => (
            <div
              key={minute}
              className={`tl-tick${minute % 360 === 0 ? ' major' : ''}`}
              style={{ left: `${fracOf(SIM_WINDOW_START_MS + minute * 60_000) * 100}%` }}
            />
          ))}
          {markers.map((m) => (
            <div
              key={m.id}
              className={`tl-marker${m.critical ? ' critical' : ''}`}
              style={{ left: `${fracOf(m.depart) * 100}%` }}
              title={`${m.label} — departs ${formatIst12(m.depart)}`}
            />
          ))}
          <div className="tl-cursor" style={{ left: `${cursorFrac * 100}%` }}>
            <div className="tl-now">
              <span className="tl-now-label">Now</span>
              <span className="tl-now-time">{formatIst12(nowMs)}</span>
            </div>
          </div>
        </div>
        <div className="tl-tick-labels">
          {MAJOR_TICKS.map((t) => (
            <span key={t.hour} style={{ left: `${((t.hour * 60 - 360) / 1440) * 100}%` }}>
              {t.label}
            </span>
          ))}
        </div>
        <p className="tl-caption">Simulated schedule — demo timetable</p>
      </div>

      <div className="tl-count" role="status">
        <strong>{summary.reachableCount}</strong> {plural(summary.reachableCount, 'destination')} ·{' '}
        <strong>{summary.totalJourneys}</strong> {plural(summary.totalJourneys, 'journey')} still possible
      </div>
    </section>
  )
}
