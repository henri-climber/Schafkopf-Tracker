import { useMemo, useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useGlobalScoringConfig } from '@/features/schafkopf/api/queries'
import {
  recalculateRounds,
  type RecalculatedRound,
  type ScoringConfig,
  type StoredRound,
} from '@/features/schafkopf/domain/gameModes'
import type { Player } from '@/shared/supabase/types'
import { ScoringConfigForm } from '../ScoringConfigForm'
import '@/shared/styles/round-editor.css'

interface Props {
  config: ScoringConfig
  rounds: StoredRound[]
  players: Player[]
  /** Closed games are read-only: changing them would shift finished standings. */
  editable: boolean
  onSave: (config: ScoringConfig, changed: RecalculatedRound[]) => Promise<void>
  onClose: () => void
}

/**
 * One game's tariff. Saving rescores every mode-based round in the game under
 * the new rules, after showing what that does to each player's total. Manual
 * and pre-mode rounds keep their typed numbers.
 */
export function TableRulesDialog({ config, rounds, players, editable, onSave, onClose }: Props) {
  const globalConfig = useGlobalScoringConfig()
  const [draft, setDraft] = useState(config)
  const [pending, setPending] = useState<RecalculatedRound[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const playerIds = useMemo(() => players.map((p) => p.id), [players])

  const deltas = useMemo(() => {
    if (!pending) return []
    return players.map((player) => {
      let delta = 0
      for (const change of pending) {
        const before = rounds
          .find((round) => round.id === change.roundId)
          ?.scores.find((s) => s.player_id === player.id)?.raw_score
        const after = change.scores.find((s) => s.player_id === player.id)?.raw_score
        delta += (after ?? 0) - (before ?? 0)
      }
      return { player, delta }
    })
  }, [pending, players, rounds])

  const save = async (changed: RecalculatedRound[]) => {
    setSaving(true)
    setError(null)
    try {
      await onSave(draft, changed)
    } catch (saveError) {
      console.error('Error saving rules:', saveError)
      setError('Die Regeln konnten nicht gespeichert werden. Bitte nochmal versuchen.')
      setSaving(false)
    }
  }

  const handleSave = () => {
    const changed = recalculateRounds(rounds, draft, playerIds)
    if (changed.length > 0) setPending(changed)
    else save([])
  }

  return (
    <div
      className="round-editor-overlay"
      role="presentation"
      onClick={saving ? undefined : onClose}
    >
      <div
        className="round-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="table-rules-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="round-editor-header">
          <h2 id="table-rules-title">Regeln für dieses Spiel</h2>
          <button
            type="button"
            className="round-editor-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Schließen"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="round-editor-body">
          {pending ? (
            <div className="scoring-recalc">
              <p>
                {pending.length === 1
                  ? '1 Runde wird neu berechnet.'
                  : `${pending.length} Runden werden neu berechnet.`}{' '}
                So ändern sich die Punktestände:
              </p>
              <div className="scoring-recalc-deltas">
                {deltas.map(({ player, delta }) => (
                  <div key={player.id} className="scoring-recalc-delta">
                    <span>{player.name}</span>
                    <span
                      className={
                        delta > 0 ? 'score-positive' : delta < 0 ? 'score-negative' : 'score-zero'
                      }
                    >
                      {delta > 0 ? `+${delta}` : delta === 0 ? '±0' : delta}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {!editable && (
                <p className="round-editor-hint">
                  Das Spiel ist geschlossen. Zum Ändern der Regeln erst wieder öffnen.
                </p>
              )}
              <ScoringConfigForm value={draft} onChange={setDraft} disabled={!editable || saving} />
            </>
          )}
        </div>

        <div className="round-editor-footer">
          {error && <p className="round-editor-hint error">{error}</p>}
          <div className="round-editor-actions">
            {pending ? (
              <>
                <button
                  type="button"
                  className="round-editor-btn"
                  onClick={() => setPending(null)}
                  disabled={saving}
                >
                  Zurück
                </button>
                <button
                  type="button"
                  className="round-editor-btn primary"
                  onClick={() => save(pending)}
                  disabled={saving}
                >
                  {saving ? 'Speichert…' : 'Neu berechnen & speichern'}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="round-editor-btn"
                  onClick={() => globalConfig.data && setDraft(globalConfig.data)}
                  disabled={!editable || saving || !globalConfig.data}
                  title="Die aktuellen Standardregeln übernehmen"
                >
                  Standard übernehmen
                </button>
                <button
                  type="button"
                  className="round-editor-btn primary"
                  onClick={handleSave}
                  disabled={!editable || saving}
                >
                  {saving ? 'Speichert…' : 'Speichern'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
