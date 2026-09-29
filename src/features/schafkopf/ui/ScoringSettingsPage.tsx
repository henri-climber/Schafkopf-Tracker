import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import {
  useGlobalScoringConfig,
  useUpdateGlobalScoringConfig,
} from '@/features/schafkopf/api/queries'
import { DEFAULT_SCORING_CONFIG, type ScoringConfig } from '@/features/schafkopf/domain/gameModes'
import { ScoringConfigForm } from './ScoringConfigForm'
import '@/shared/styles/scoring-config.css'
import '@/shared/styles/round-editor.css'

/** The default tariff every new game starts with. Editable by everyone. */
export function ScoringSettingsPage() {
  const navigate = useNavigate()
  const configQuery = useGlobalScoringConfig()
  const updateMutation = useUpdateGlobalScoringConfig()
  const [draft, setDraft] = useState<ScoringConfig | null>(null)
  const [saved, setSaved] = useState(false)

  // Start from the stored config once it arrives; after that the draft is ours.
  useEffect(() => {
    if (configQuery.data && draft === null) setDraft(configQuery.data)
  }, [configQuery.data, draft])

  const isDirty =
    draft !== null &&
    configQuery.data !== undefined &&
    JSON.stringify(draft) !== JSON.stringify(configQuery.data)

  const handleChange = (config: ScoringConfig) => {
    setDraft(config)
    setSaved(false)
  }

  const handleSave = async () => {
    if (!draft) return
    try {
      await updateMutation.mutateAsync(draft)
      setSaved(true)
    } catch (error) {
      console.error('Error saving scoring config:', error)
    }
  }

  return (
    <div className="scoring-settings-container">
      <div className="scoring-settings-header">
        <button onClick={() => navigate('/')} className="scoring-settings-back" aria-label="Zurück">
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <h1 className="scoring-settings-title">Punkteregeln</h1>
      </div>

      <div className="scoring-settings-content">
        <p className="scoring-settings-intro">
          Standardregeln für neue Spiele. Laufende Spiele behalten ihre eigenen Regeln – die lassen
          sich im Spiel unter „Regeln“ ändern.
        </p>

        {configQuery.isPending ? (
          <p className="text-center text-gray-500">Lädt…</p>
        ) : configQuery.error ? (
          <p className="text-center text-red-600">Die Regeln konnten nicht geladen werden.</p>
        ) : (
          draft && (
            <ScoringConfigForm
              value={draft}
              onChange={handleChange}
              disabled={updateMutation.isPending}
            />
          )
        )}
      </div>

      {draft && (
        <div className="scoring-settings-footer">
          <div className="scoring-settings-footer-inner">
            <span className={`scoring-settings-status ${updateMutation.isError ? 'error' : ''}`}>
              {updateMutation.isError
                ? 'Speichern fehlgeschlagen'
                : saved && !isDirty
                  ? 'Gespeichert'
                  : isDirty
                    ? 'Ungespeicherte Änderungen'
                    : ''}
            </span>
            <button
              type="button"
              className="round-editor-btn"
              onClick={() => handleChange(DEFAULT_SCORING_CONFIG)}
              disabled={updateMutation.isPending}
            >
              Zurücksetzen
            </button>
            <button
              type="button"
              className="round-editor-btn primary"
              onClick={handleSave}
              disabled={!isDirty || updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Speichert…' : 'Speichern'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
