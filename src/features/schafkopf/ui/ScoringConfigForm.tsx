import type { ReactNode } from 'react'
import {
  MODE_META,
  SCORED_MODES,
  type ModeConfig,
  type ScoredMode,
  type ScoringConfig,
} from '@/features/schafkopf/domain/gameModes'
import '@/shared/styles/scoring-config.css'

interface Props {
  value: ScoringConfig
  onChange: (config: ScoringConfig) => void
  disabled?: boolean
}

/**
 * The tariff editor, shared by the global default and a single game's rules.
 * Every amount is per opponent: a soloist settles it with each of the three.
 */
export function ScoringConfigForm({ value, onChange, disabled = false }: Props) {
  const setMode = (mode: ScoredMode, patch: Partial<ModeConfig>) =>
    onChange({ ...value, modes: { ...value.modes, [mode]: { ...value.modes[mode], ...patch } } })

  return (
    <fieldset className="scoring-form" disabled={disabled}>
      <section>
        <h3 className="scoring-form-heading">Spiele</h3>
        <div className="scoring-form-modes">
          <div className="scoring-form-modes-head">
            <span>Spiel</span>
            <span>Tarif</span>
            <span>Laufende ab</span>
          </div>
          {SCORED_MODES.map((mode) => {
            const config = value.modes[mode]
            return (
              <div
                key={mode}
                className={`scoring-form-mode ${config.enabled ? '' : 'scoring-form-mode-off'}`}
              >
                <label className="scoring-form-toggle">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) => setMode(mode, { enabled: e.target.checked })}
                  />
                  <span>{MODE_META[mode].label}</span>
                </label>
                <NumberInput
                  label={`Tarif ${MODE_META[mode].label}`}
                  value={config.tariff}
                  onChange={(tariff) => setMode(mode, { tariff })}
                />
                {MODE_META[mode].countsExtras ? (
                  <NumberInput
                    label={`Laufende ab (${MODE_META[mode].label})`}
                    value={config.minLaufende}
                    onChange={(minLaufende) => setMode(mode, { minLaufende })}
                  />
                ) : (
                  <span className="scoring-form-na">–</span>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <h3 className="scoring-form-heading">Zuschläge</h3>
        <Field label="Schneider">
          <NumberInput
            label="Schneider"
            value={value.schneider}
            onChange={(schneider) => onChange({ ...value, schneider })}
          />
        </Field>
        <Field label="Schwarz" hint="zusätzlich zu Schneider">
          <NumberInput
            label="Schwarz"
            value={value.schwarz}
            onChange={(schwarz) => onChange({ ...value, schwarz })}
          />
        </Field>
        <Field label="Pro Laufendem">
          <NumberInput
            label="Pro Laufendem"
            value={value.laufende}
            onChange={(laufende) => onChange({ ...value, laufende })}
          />
        </Field>
      </section>

      <section>
        <h3 className="scoring-form-heading">Verdoppeln</h3>
        <p className="scoring-form-note">Klopfer, Kontra und Re verdoppeln jeweils.</p>
        <Field
          label={
            <label className="scoring-form-toggle">
              <input
                type="checkbox"
                checked={value.tout.enabled}
                onChange={(e) =>
                  onChange({ ...value, tout: { ...value.tout, enabled: e.target.checked } })
                }
              />
              <span>Tout</span>
            </label>
          }
          hint="Faktor"
        >
          <NumberInput
            label="Faktor Tout"
            value={value.tout.multiplier}
            onChange={(multiplier) => onChange({ ...value, tout: { ...value.tout, multiplier } })}
          />
        </Field>
        <Field
          label={
            <label className="scoring-form-toggle">
              <input
                type="checkbox"
                checked={value.sie.enabled}
                onChange={(e) =>
                  onChange({ ...value, sie: { ...value.sie, enabled: e.target.checked } })
                }
              />
              <span>Sie</span>
            </label>
          }
          hint="Faktor"
        >
          <NumberInput
            label="Faktor Sie"
            value={value.sie.multiplier}
            onChange={(multiplier) => onChange({ ...value, sie: { ...value.sie, multiplier } })}
          />
        </Field>
        <Field label="Jungfrau (Ramsch)" hint="Faktor">
          <NumberInput
            label="Faktor Jungfrau"
            value={value.jungfrauMultiplier}
            onChange={(jungfrauMultiplier) => onChange({ ...value, jungfrauMultiplier })}
          />
        </Field>
      </section>
    </fieldset>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: ReactNode
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="scoring-form-field">
      <div className="scoring-form-field-label">
        {label}
        {hint && <span className="scoring-form-hint">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      aria-label={label}
      className="scoring-form-number"
      value={value}
      onChange={(e) => onChange(Math.max(0, parseInt(e.target.value) || 0))}
    />
  )
}
