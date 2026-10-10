interface HeaderProps {
  originName: string
  playing: boolean
  onReset: () => void
  /** Start the guided tour (spec) — auto-playing, pausable, exitable. */
  onStory: () => void
  /** One-key full-day time-lapse (spec). */
  onTimelapse: () => void
}

/** Brand, live status chip, origin, the story/time-lapse keys, and the demo reset. */
export function Header({ originName, playing, onReset, onStory, onTimelapse }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="brand">
        <h1>EVERYWHERE</h1>
        <p>YOUR POSSIBLE WORLD</p>
      </div>
      <div className="header-right">
        <span className={`status-chip${playing ? ' live' : ''}`} role="status">
          <span className="status-dot" aria-hidden="true" />
          {playing ? 'Simulating' : 'Simulation paused'}
        </span>
        <span className="header-origin">Starting from {originName}</span>
        <button className="btn-story" data-testid="tell-the-story" onClick={onStory}>
          Tell the story
        </button>
        <button className="btn-timelapse" data-testid="play-the-day" onClick={onTimelapse}>
          Play the day
        </button>
        <button className="btn-reset" onClick={onReset}>
          Reset demo
        </button>
      </div>
    </header>
  )
}
