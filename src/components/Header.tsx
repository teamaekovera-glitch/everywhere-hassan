interface HeaderProps {
  originName: string
  playing: boolean
  onReset: () => void
}

/** Brand, live status chip, origin, and the demo reset. */
export function Header({ originName, playing, onReset }: HeaderProps) {
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
        <button className="btn-reset" onClick={onReset}>
          Reset demo
        </button>
      </div>
    </header>
  )
}
