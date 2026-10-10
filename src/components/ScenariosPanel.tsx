import { useState } from 'react'
import { SCENARIO_NAME_MAX } from '../state/scenarios'
import type { SavedScenario } from '../state/scenarios'

interface ScenariosPanelProps {
  scenarios: SavedScenario[]
  onSave: (name: string) => void
  onLoad: (name: string) => void
  onDelete: (name: string) => void
}

/**
 * Named scenarios (spec): save the current constraints + clock + selection,
 * restore or delete a saved one. Identity is the trimmed name — saving an
 * existing name overwrites it.
 */
export function ScenariosPanel({ scenarios, onSave, onLoad, onDelete }: ScenariosPanelProps) {
  const [name, setName] = useState('')
  const trimmed = name.trim()

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
