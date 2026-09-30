import type { ReactNode } from 'react'
import type { Rate } from '@/features/schafkopf/domain/statistics/aggregate'
import { formatRate, isThin } from './format'

export function StatsSection({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <section className="stats-section">
      <header className="stats-section-header">
        <h2 className="stats-section-title">{title}</h2>
        {subtitle && <p className="stats-section-subtitle">{subtitle}</p>}
      </header>
      {children}
    </section>
  )
}

export function StatTile({
  label,
  value,
  hint,
  thin = false,
  tone,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  /** Too few samples to mean much: shown greyed out. */
  thin?: boolean
  tone?: 'positive' | 'negative'
}) {
  return (
    <div className={`stats-tile ${thin ? 'stats-thin' : ''}`}>
      <div className="stats-tile-label">{label}</div>
      <div className={`stats-tile-value ${tone ? `stats-${tone}` : ''}`}>{value}</div>
      {hint && <div className="stats-tile-hint">{hint}</div>}
    </div>
  )
}

/** A percentage with its sample, e.g. "63 % (12/19)", greyed out when thin. */
export function RateText({ rate, showSample = true }: { rate: Rate | null; showSample?: boolean }) {
  if (!rate || rate.n === 0) return <span className="stats-muted">–</span>
  return (
    <span className={isThin(rate) ? 'stats-thin' : undefined}>
      {formatRate(rate)}
      {showSample && (
        <span className="stats-sample">
          {' '}
          ({rate.hits}/{rate.n})
        </span>
      )}
    </span>
  )
}

export function RateTile({ label, rate, hint }: { label: string; rate: Rate; hint?: ReactNode }) {
  return (
    <StatTile
      label={label}
      value={formatRate(rate)}
      hint={hint ?? `${rate.hits} von ${rate.n}`}
      thin={isThin(rate)}
    />
  )
}

export interface BarSegment {
  key: string
  label: string
  value: number
  className: string
}

/** A single stacked bar with a legend, for splits like team vs. solo. */
export function SplitBar({ segments }: { segments: BarSegment[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  if (total === 0) return null
  const visible = segments.filter((s) => s.value > 0)
  return (
    <div>
      <div className="stats-split-bar">
        {visible.map((s) => (
          <div
            key={s.key}
            className={`stats-split-segment ${s.className}`}
            style={{ width: `${(s.value / total) * 100}%` }}
            title={`${s.label}: ${s.value}`}
          />
        ))}
      </div>
      <ul className="stats-legend">
        {visible.map((s) => (
          <li key={s.key} className="stats-legend-item">
            <span className={`stats-legend-dot ${s.className}`} />
            {s.label}
            <span className="stats-legend-value">
              {s.value} · {Math.round((s.value / total) * 100)} %
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Shown in place of a mode-only section when the selection has no mode rounds. */
export function EmptyModeData({ legacyOnly }: { legacyOnly: boolean }) {
  return (
    <div className="stats-empty">
      {legacyOnly
        ? 'Nur alte Runden ausgewählt. Diese Auswertung braucht Runden mit Spielmodus.'
        : 'Noch keine Runden mit Spielmodus in dieser Auswahl. Sobald Runden über den Runden-Editor erfasst werden, erscheinen sie hier.'}
    </div>
  )
}
