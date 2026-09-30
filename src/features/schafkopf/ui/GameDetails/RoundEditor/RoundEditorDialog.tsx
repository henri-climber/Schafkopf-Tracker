import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { MinusIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline'
import {
  MODE_META,
  MANUAL_LABEL,
  SUIT_META,
  availableModes,
  evaluateRound,
  type Breakdown,
  type GameMode,
  type RoundEvaluation,
  type RoundInput,
  type ScoringConfig,
} from '@/features/schafkopf/domain/gameModes'
import type { Player } from '@/shared/supabase/types'
import '@/shared/styles/round-editor.css'

/** Empty means zero; anything unparseable also means zero. */
function parseScoreInput(value: string): number {
  if (!value) return 0
  return parseInt(value) || 0
}

export type SuccessfulEvaluation = Extract<RoundEvaluation, { ok: true }>

interface Props {
  title: string
  players: Player[]
  config: ScoringConfig
  initial: RoundInput
  onSave: (evaluation: SuccessfulEvaluation) => Promise<void>
  onClose: () => void
}

/**
 * Records one round: who sat out, what was played, by whom, and how it went.
 * Scores are derived live from the game's tariff and shown before saving.
 */
export function RoundEditorDialog({ title, players, config, initial, onSave, onClose }: Props) {
  const [input, setInput] = useState<RoundInput>(initial)
  const [manualText, setManualText] = useState<Record<number, string>>(() =>
    textFromScores(initial.manualScores),
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const playerIds = useMemo(() => players.map((p) => p.id), [players])
  const nameOf = (id: number) => players.find((p) => p.id === id)?.name ?? '?'
  const evaluation = useMemo(
    () => evaluateRound(input, config, playerIds),
    [input, config, playerIds],
  )

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, saving])

  const update = (patch: Partial<RoundInput>) => setInput((prev) => ({ ...prev, ...patch }))

  const isManual = input.mode === 'manual'
  const meta = input.mode === 'manual' ? null : MODE_META[input.mode]
  const sitOutCount = players.length - 4
  const sittingOut = playerIds.filter((id) => !input.activePlayerIds.includes(id))
  const modes = availableModes(config, initial.mode)

  const selectMode = (mode: GameMode) => {
    if (mode === input.mode) return
    if (mode === 'manual') {
      // Carry the scores over, so switching to fix one number is not a retype.
      const scores = evaluation.ok ? evaluation.scores : input.manualScores
      setManualText(textFromScores(scores))
      update({ mode, manualScores: scores })
      return
    }
    const next = MODE_META[mode]
    setInput((prev) => ({
      ...prev,
      mode,
      suit: prev.suit && next.suits.includes(prev.suit) ? prev.suit : null,
      partnerId: next.family === 'team' ? prev.partnerId : null,
      tout: next.tout && prev.tout,
      sie: next.sie && prev.sie,
      // Every player takes part in a manual round; a scored one needs the four.
      activePlayerIds:
        prev.activePlayerIds.length === 4 ? prev.activePlayerIds : playerIds.slice(sitOutCount),
    }))
  }

  const toggleSittingOut = (id: number) => {
    let next: number[]
    if (sitOutCount === 1) next = [id]
    else if (sittingOut.includes(id)) next = sittingOut.filter((other) => other !== id)
    else next = [...sittingOut, id].slice(-sitOutCount)

    const active = playerIds.filter((player) => !next.includes(player))
    setInput((prev) => ({
      ...prev,
      activePlayerIds: active,
      declarerId:
        prev.declarerId !== null && active.includes(prev.declarerId) ? prev.declarerId : null,
      partnerId: prev.partnerId !== null && active.includes(prev.partnerId) ? prev.partnerId : null,
    }))
  }

  const handleSave = async () => {
    if (!evaluation.ok || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      await onSave(evaluation)
    } catch (error) {
      console.error('Error saving round:', error)
      setSaveError('Die Runde konnte nicht gespeichert werden. Bitte nochmal versuchen.')
      setSaving(false)
    }
  }

  const activePlayers = players.filter((p) => input.activePlayerIds.includes(p.id))
  const modeConfig = input.mode === 'manual' ? null : config.modes[input.mode]

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
        aria-labelledby="round-editor-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="round-editor-header">
          <h2 id="round-editor-title">{title}</h2>
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
          {!isManual && sitOutCount > 0 && (
            <Section label={sitOutCount === 1 ? 'Setzt aus' : 'Setzen aus'}>
              <div className="round-editor-chips">
                {players.map((player) => (
                  <Chip
                    key={player.id}
                    active={sittingOut.includes(player.id)}
                    tone="muted"
                    onClick={() => toggleSittingOut(player.id)}
                  >
                    {player.name}
                  </Chip>
                ))}
              </div>
            </Section>
          )}

          <Section label="Spiel">
            <div className="round-editor-modes">
              {modes.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`round-editor-mode ${input.mode === mode ? 'active' : ''}`}
                  onClick={() => selectMode(mode)}
                >
                  {MODE_META[mode].label}
                </button>
              ))}
              <button
                type="button"
                className={`round-editor-mode round-editor-mode-manual ${isManual ? 'active' : ''}`}
                onClick={() => selectMode('manual')}
              >
                {MANUAL_LABEL}
              </button>
            </div>
          </Section>

          {meta && meta.suit !== 'none' && (
            <Section label={meta.suit === 'optional' ? 'Gerufene Sau (optional)' : 'Farbe'}>
              <div className="round-editor-chips">
                {meta.suits.map((suit) => (
                  <Chip
                    key={suit}
                    active={input.suit === suit}
                    onClick={() =>
                      update({
                        suit: meta.suit === 'optional' && input.suit === suit ? null : suit,
                      })
                    }
                  >
                    {SUIT_META[suit].symbol} {SUIT_META[suit].label}
                  </Chip>
                ))}
              </div>
            </Section>
          )}

          {meta && (
            <Section
              label={
                meta.family === 'ramsch'
                  ? input.durchmarsch
                    ? 'Durchmarsch von'
                    : 'Verlierer'
                  : 'Spieler'
              }
            >
              <div className="round-editor-chips">
                {activePlayers.map((player) => (
                  <Chip
                    key={player.id}
                    active={input.declarerId === player.id}
                    onClick={() =>
                      update({
                        declarerId: player.id,
                        partnerId: input.partnerId === player.id ? null : input.partnerId,
                      })
                    }
                  >
                    {player.name}
                  </Chip>
                ))}
              </div>
            </Section>
          )}

          {meta?.family === 'team' && (
            <Section label="Mitspieler">
              <div className="round-editor-chips">
                {activePlayers
                  .filter((player) => player.id !== input.declarerId)
                  .map((player) => (
                    <Chip
                      key={player.id}
                      active={input.partnerId === player.id}
                      onClick={() => update({ partnerId: player.id })}
                    >
                      {player.name}
                    </Chip>
                  ))}
              </div>
            </Section>
          )}

          {meta && meta.family !== 'ramsch' && (
            <Section label="Ergebnis">
              <div className="round-editor-result">
                <button
                  type="button"
                  className={`round-editor-result-btn won ${input.won ? 'active' : ''}`}
                  onClick={() => update({ won: true })}
                >
                  Gewonnen
                </button>
                <button
                  type="button"
                  className={`round-editor-result-btn lost ${!input.won ? 'active' : ''}`}
                  onClick={() => update({ won: false })}
                >
                  Verloren
                </button>
              </div>
            </Section>
          )}

          {meta && modeConfig && (
            <Section label="Extras">
              <div className="round-editor-extras">
                {meta.countsExtras && (
                  <>
                    <div className="round-editor-chips">
                      <Chip
                        active={input.schneider}
                        onClick={() => update({ schneider: !input.schneider, schwarz: false })}
                      >
                        Schneider
                      </Chip>
                      <Chip
                        active={input.schwarz}
                        onClick={() =>
                          update({
                            schwarz: !input.schwarz,
                            schneider: input.schwarz ? input.schneider : true,
                          })
                        }
                      >
                        Schwarz
                      </Chip>
                    </div>
                    <Stepper
                      label="Laufende"
                      hint={`zählen ab ${modeConfig.minLaufende}`}
                      value={input.laufende}
                      max={14}
                      onChange={(laufende) => update({ laufende })}
                    />
                  </>
                )}
                <Stepper
                  label="Klopfer"
                  value={input.klopfer}
                  max={4}
                  onChange={(klopfer) => update({ klopfer })}
                />
                <div className="round-editor-chips">
                  {meta.family !== 'ramsch' && (
                    <>
                      <Chip
                        active={input.kontra}
                        onClick={() => update({ kontra: !input.kontra, re: false })}
                      >
                        Kontra
                      </Chip>
                      <Chip
                        active={input.re}
                        onClick={() =>
                          update({ re: !input.re, kontra: input.re ? input.kontra : true })
                        }
                      >
                        Re
                      </Chip>
                    </>
                  )}
                  {meta.tout && (config.tout.enabled || input.tout) && (
                    <Chip active={input.tout} onClick={() => update({ tout: !input.tout })}>
                      Tout
                    </Chip>
                  )}
                  {meta.sie && (config.sie.enabled || input.sie) && (
                    <Chip active={input.sie} onClick={() => update({ sie: !input.sie })}>
                      Sie
                    </Chip>
                  )}
                  {meta.family === 'ramsch' && (
                    <>
                      <Chip
                        active={input.durchmarsch}
                        onClick={() => update({ durchmarsch: !input.durchmarsch, jungfrau: false })}
                      >
                        Durchmarsch
                      </Chip>
                      {!input.durchmarsch && (
                        <Chip
                          active={input.jungfrau}
                          onClick={() => update({ jungfrau: !input.jungfrau })}
                        >
                          Jungfrau
                        </Chip>
                      )}
                    </>
                  )}
                </div>
              </div>
            </Section>
          )}

          {isManual ? (
            <Section label="Punkte">
              <div className="round-editor-manual">
                {players.map((player) => (
                  <label key={player.id} className="round-editor-manual-row">
                    <span>{player.name}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      className="round-editor-manual-input"
                      value={manualText[player.id] ?? ''}
                      placeholder="0"
                      onChange={(e) => {
                        const text = e.target.value
                        setManualText((prev) => ({ ...prev, [player.id]: text }))
                        setInput((prev) => ({
                          ...prev,
                          manualScores: {
                            ...prev.manualScores,
                            [player.id]: parseScoreInput(text),
                          },
                        }))
                      }}
                    />
                  </label>
                ))}
              </div>
            </Section>
          ) : (
            evaluation.ok && (
              <div className="round-editor-preview">
                {evaluation.breakdown && (
                  <div className="round-editor-breakdown">
                    {formatBreakdown(evaluation.breakdown).map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                )}
                <div className="round-editor-preview-scores">
                  {players.map((player) => {
                    const score = evaluation.scores[player.id]
                    const role = evaluation.roles[player.id]
                    return (
                      <div
                        key={player.id}
                        className={`round-editor-preview-row ${role === 'sitting_out' ? 'sitting-out' : ''}`}
                      >
                        <span>
                          {nameOf(player.id)}
                          {role === 'declarer' && (
                            <em>
                              {' '}
                              {meta?.family !== 'ramsch'
                                ? 'Spieler'
                                : input.durchmarsch
                                  ? 'Durchmarsch'
                                  : 'Verlierer'}
                            </em>
                          )}
                          {role === 'partner' && <em> Mitspieler</em>}
                        </span>
                        <span
                          className={
                            score > 0
                              ? 'score-positive'
                              : score < 0
                                ? 'score-negative'
                                : 'score-zero'
                          }
                        >
                          {role === 'sitting_out' ? '–' : score > 0 ? `+${score}` : score}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          )}
        </div>

        <div className="round-editor-footer">
          {(saveError || !evaluation.ok) && (
            <p className={`round-editor-hint ${saveError ? 'error' : ''}`}>
              {saveError ?? (!evaluation.ok ? evaluation.error : null)}
            </p>
          )}
          <div className="round-editor-actions">
            <button type="button" className="round-editor-btn" onClick={onClose} disabled={saving}>
              Abbrechen
            </button>
            <button
              type="button"
              className="round-editor-btn primary"
              onClick={handleSave}
              disabled={!evaluation.ok || saving}
            >
              {saving ? 'Speichert…' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function textFromScores(scores: Record<number, number>): Record<number, string> {
  const text: Record<number, string> = {}
  for (const [id, score] of Object.entries(scores))
    text[Number(id)] = score === 0 ? '' : String(score)
  return text
}

/** "Solo 20 + Schneider 10 = 30", then "×2 Kontra = 60". */
function formatBreakdown(breakdown: Breakdown): string[] {
  const base = breakdown.parts.reduce((total, part) => total + part.value, 0)
  const lines = [
    breakdown.parts.map((part) => `${part.label} ${part.value}`).join(' + ') +
      (breakdown.parts.length > 1 ? ` = ${base}` : ''),
  ]
  if (breakdown.multipliers.length > 0) {
    lines.push(
      breakdown.multipliers.map((m) => `×${m.factor} ${m.label}`).join(' · ') +
        ` = ${breakdown.value}`,
    )
  }
  return lines
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="round-editor-section">
      <h3>{label}</h3>
      {children}
    </section>
  )
}

function Chip({
  active,
  tone = 'brand',
  onClick,
  children,
}: {
  active: boolean
  tone?: 'brand' | 'muted'
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`round-editor-chip ${active ? `active ${tone}` : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function Stepper({
  label,
  hint,
  value,
  max,
  onChange,
}: {
  label: string
  hint?: string
  value: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <div className="round-editor-stepper">
      <div>
        <span className="round-editor-stepper-label">{label}</span>
        {hint && <span className="round-editor-stepper-hint">{hint}</span>}
      </div>
      <div className="round-editor-stepper-controls">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value === 0}
          aria-label={`${label} verringern`}
        >
          <MinusIcon className="w-4 h-4" />
        </button>
        <span className="round-editor-stepper-value">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value === max}
          aria-label={`${label} erhöhen`}
        >
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
