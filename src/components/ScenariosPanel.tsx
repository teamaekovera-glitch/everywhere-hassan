import { useState } from 'react'
import { SCENARIO_NAME_MAX } from '../state/scenarios'
import type { SavedScenario } from '../state/scenarios'

interface ScenariosPanelProps {
  scenarios: SavedScenario[]
  onSave: (name: string) => void
  onLoad: (name: string) => void
  onDelete: (name: string) => void
  /** Copy link (spec): put a share URL for the current snapshot on the clipboard. */
  onShareLink: () => Promise<boolean>
}

/**
 * Named scenarios (spec): save the current constraints + clock + selection,
 * restore or delete a saved one. Identity is the trimmed name — saving an
 * existing name overwrites it. Copy link serializes the same snapshot to
 * a URL hash instead of localStorage — one serializer, two sinks.
 */
export function ScenariosPanel({ scenarios, onSave, onLoad, onDelete, onShareLink }: ScenariosPanelProps) {
  const [name, setName] = useState('')
  const [shareState, setShareState] = useState<'idle' | 'ok' | 'fail'>('idle')
  const trimmed = name.trim()

  async function handleShare(): Promise<void> {
    const ok = await onShareLink()
    setShareState(ok ? 'ok' : 'fail')
    // The confirmation is transient — long enough to read, short enough
    // to not look like state.
    window.setTimeout(() => setShareState('idle'), 2_000)
  }

  return (
    <section className="panel scenarios-panel" aria-label="Saved scenarios">
      <h2 className="panel-kicker">Scenarios</h2>
      <form
        className="scenario-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!trimmed) return
          onSave(trimmed)
          setName('')
        }}
      >
        <label className="scenario-label" htmlFor="scenario-name">
          Save constraints, clock and selection under a name
        </label>
        <div className="scenario-input-row">
          <input
            id="scenario-name"
            data-testid="scenario-name"
            value={name}
            maxLength={SCENARIO_NAME_MAX}
            placeholder="e.g. Budget weekend"
            onChange={(e) => setName(e.currentTarget.value)}
          />
          <button type="submit" data-testid="scenario-save" disabled={!trimmed}>
            Save
          </button>
        </div>
      </form>

      <div className="scenario-share-row">
        <button type="button" data-testid="share-link" onClick={handleShare}>
          Copy link
        </button>
        <span className="scenario-share-note" role="status" data-testid="share-feedback">
          {shareState === 'ok' ? 'Copied — link restores this exact scenario' : shareState === 'fail' ? 'Copy failed — clipboard unavailable' : 'Share this exact scenario as a URL'}
        </span>
      </div>

      {scenarios.length === 0 ? (
        <p className="scenario-none">No saved scenarios yet — set constraints, then save them here.</p>
      ) : (
        <ul className="scenario-list" data-testid="scenarios-list">
          {scenarios.map((s) => (
            <li key={s.name} className="scenario-item">
              <span className="scenario-item-name" title={s.name}>
                {s.name}
              </span>
              <span className="scenario-actions">
                <button
                  type="button"
                  data-testid={`scenario-load-${s.name}`}
                  onClick={() => onLoad(s.name)}
                  aria-label={`Load scenario ${s.name}`}
                >
                  Load
                </button>
                <button
                  type="button"
                  data-testid={`scenario-delete-${s.name}`}
                  onClick={() => onDelete(s.name)}
                  aria-label={`Delete scenario ${s.name}`}
                  className="scenario-delete"
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
