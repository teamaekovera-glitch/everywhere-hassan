import { useState } from 'react'
import type { ReactNode } from 'react'
import { BookIcon, FastForwardIcon, LinkIcon, ResetIcon } from './Icons'

interface HeaderProps {
  onReset: () => void
  /** Start the guided tour (spec) — auto-playing, pausable, exitable. */
  onStory: () => void
  /** One-key full-day time-lapse (spec). */
  onTimelapse: () => void
  /** Popover body: scenario save/load + share link, off the main canvas. */
  scenarioPanel: ReactNode
}

/**
 * The mockup's quiet header: wordmark and tagline, then consolidated icon
 * actions — story, time-lapse, scenarios/share (the popover), reset. The
 * popover is dismissed by its backdrop, Esc, or the close button.
 */
export function Header({ onReset, onStory, onTimelapse, scenarioPanel }: HeaderProps) {
  const [open, setOpen] = useState(false)

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') setOpen(false)
  }

  return (
    <header className="app-header">
      <div className="brand">
        <h1>EVERYWHERE</h1>
        <p>YOUR POSSIBLE WORLD</p>
      </div>
      <div className="header-right">
        <span className="tagline">Same you. Different timelines.</span>
        <button type="button" className="icon-btn" data-testid="tell-the-story" onClick={onStory} aria-label="Tell the story" title="Tell the story">
          <BookIcon />
        </button>
        <button type="button" className="icon-btn" data-testid="play-the-day" onClick={onTimelapse} aria-label="Play the day" title="Play the day">
          <FastForwardIcon />
        </button>
        <button
          type="button"
          className={`icon-btn${open ? ' active' : ''}`}
          data-testid="scenarios-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label="Scenarios and share"
          title="Scenarios & share"
        >
          <LinkIcon />
        </button>
        <button type="button" className="icon-btn" data-testid="reset-demo" onClick={onReset} aria-label="Reset demo" title="Reset demo">
          <ResetIcon />
        </button>
      </div>
      {open && (
        <>
          <div className="popover-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="header-popover" role="dialog" aria-label="Scenarios and share" onKeyDown={onKeyDown}>
            {scenarioPanel}
          </div>
        </>
      )}
    </header>
  )
}
