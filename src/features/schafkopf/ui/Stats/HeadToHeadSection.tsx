import { useMemo, useState, type ReactNode } from 'react'
import type { PlayerId } from '@/features/schafkopf/domain/scoring'
import {
  headToHead,
  MIN_SAMPLE,
  nemesisOf,
  opposedRate,
  pairKey,
  type PairRecord,
  type PlayerStats,
  type Rate,
} from '@/features/schafkopf/domain/statistics/aggregate'
import type { StatRound, StatTable } from '@/features/schafkopf/domain/statistics/normalize'
import { RateText, StatsSection } from './common'
import { formatPercent, formatSigned, scoreClass } from './format'

/** Players shown in the matrix: the regulars, most rounds first. */
const MATRIX_SIZE = 10

function CompareRow({
  label,
  left,
  right,
  leftValue,
  rightValue,
}: {
  label: string
  left: ReactNode
  right: ReactNode
  /** When given, the higher side is highlighted and a proportion bar drawn. */
  leftValue?: number
  rightValue?: number
}) {
  const comparable = leftValue !== undefined && rightValue !== undefined
  const total = comparable ? Math.abs(leftValue) + Math.abs(rightValue) : 0
  return (
    <div className="stats-compare-row">
      <div
        className={`stats-compare-side ${comparable && leftValue > rightValue ? 'stats-compare-lead' : ''}`}
      >
        {left}
      </div>
      <div className="stats-compare-label">
        {label}
        {comparable && total > 0 && leftValue >= 0 && rightValue >= 0 && (
          <div className="stats-compare-bar">
            <div
              className="stats-compare-bar-left"
              style={{ width: `${(leftValue / total) * 100}%` }}
            />
          </div>
        )}
      </div>
      <div
        className={`stats-compare-side stats-compare-right ${comparable && rightValue > leftValue ? 'stats-compare-lead' : ''}`}
      >
        {right}
      </div>
    </div>
  )
}

function rateOrDash(r: Rate) {
  return r.n > 0 ? <RateText rate={r} /> : <span className="stats-muted">–</span>
}

function heat(value: number | null, n: number): React.CSSProperties | undefined {
  if (value === null || n < MIN_SAMPLE) return undefined
  const strength = Math.min(1, Math.abs(value - 0.5) * 2) * 0.55
  return {
    backgroundColor: value >= 0.5 ? `rgb(5 150 105 / ${strength})` : `rgb(220 38 38 / ${strength})`,
  }
}

export function HeadToHeadSection({
  tables,
  rounds,
  players,
  records,
  nameOf,
  hasModeRounds,
}: {
  tables: StatTable[]
  rounds: StatRound[]
  /** Most rounds first. */
  players: PlayerStats[]
  records: Map<string, PairRecord>
  nameOf: (id: PlayerId) => string
  hasModeRounds: boolean
}) {
  const [picked, setPicked] = useState<{ a: PlayerId | null; b: PlayerId | null }>({
    a: null,
    b: null,
  })
  const [matrixMode, setMatrixMode] = useState<'partner' | 'opposed'>('partner')

  const ids = players.map((p) => p.playerId)
  // Fall back to the two most frequent players, also when a filter change drops a pick.
  const a = picked.a !== null && ids.includes(picked.a) ? picked.a : (ids[0] ?? null)
  const b =
    picked.b !== null && ids.includes(picked.b) && picked.b !== a
      ? picked.b
      : (ids.find((id) => id !== a) ?? null)

  const h = useMemo(
    () => (a !== null && b !== null ? headToHead(tables, rounds, a, b) : null),
    [tables, rounds, a, b],
  )

  const matrixIds = ids.slice(0, MATRIX_SIZE)

  if (a === null || b === null || !h) {
    return (
      <StatsSection title="Direkter Vergleich">
        <div className="stats-empty">Mindestens zwei Spieler nötig.</div>
      </StatsSection>
    )
  }

  const record = h.record
  const opposedA = record ? opposedRate(record, a) : { hits: 0 }
  const opposedB = record ? opposedRate(record, b) : { hits: 0 }
  const nemesisA = nemesisOf(records, a)
  const nemesisB = nemesisOf(records, b)

  const select = (value: PlayerId, onChange: (id: PlayerId) => void, exclude: PlayerId) => (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="semester-select stats-player-select"
    >
      {players
        .filter((p) => p.playerId !== exclude)
        .map((p) => (
          <option key={p.playerId} value={p.playerId}>
            {nameOf(p.playerId)} ({p.rounds})
          </option>
        ))}
    </select>
  )

  return (
    <StatsSection title="Direkter Vergleich">
      <div className="stats-versus">
        {select(a, (id) => setPicked({ a: id, b }), b)}
        <span className="stats-versus-label">vs</span>
        {select(b, (id) => setPicked({ a, b: id }), a)}
      </div>

      <div className="stats-compare">
        <div className="stats-compare-center">
          <strong>{h.sharedTables}</strong> gemeinsame Spiele ·{' '}
          <strong>{record?.shared ?? 0}</strong> gemeinsame Runden
        </div>
        <CompareRow
          label="Im Spiel vor dem anderen"
          left={h.aAbove}
          right={h.bAbove}
          leftValue={h.aAbove}
          rightValue={h.bAbove}
        />
        <CompareRow
          label="Gegeneinander gewonnen"
          left={opposedA.hits}
          right={opposedB.hits}
          leftValue={opposedA.hits}
          rightValue={opposedB.hits}
        />
        <CompareRow
          label="Punkte in Runden gegeneinander"
          left={<span className={scoreClass(h.aNetOpposed)}>{formatSigned(h.aNetOpposed)}</span>}
          right={<span className={scoreClass(h.bNetOpposed)}>{formatSigned(h.bNetOpposed)}</span>}
        />
        <div className="stats-compare-center">
          Zusammen im Team:{' '}
          {record && record.partner.n > 0 ? (
            <>
              <strong>{record.partner.hits}</strong> von {record.partner.n} gewonnen (
              {formatPercent(record.partner.rate)})
            </>
          ) : (
            <span className="stats-muted">noch nie</span>
          )}
        </div>
        {hasModeRounds && (
          <>
            <CompareRow
              label="Den anderen als Partner"
              left={rateOrDash(h.aWithB)}
              right={rateOrDash(h.bWithA)}
            />
            <CompareRow
              label="Solo gegen den anderen"
              left={rateOrDash(h.aSoloVsB)}
              right={rateOrDash(h.bSoloVsA)}
            />
          </>
        )}
        <CompareRow
          label="Angstgegner"
          left={
            nemesisA ? (
              <>
                {nameOf(nemesisA.opponentId)}{' '}
                <span className="stats-sample">{formatPercent(nemesisA.record.rate)}</span>
              </>
            ) : (
              '–'
            )
          }
          right={
            nemesisB ? (
              <>
                {nameOf(nemesisB.opponentId)}{' '}
                <span className="stats-sample">{formatPercent(nemesisB.record.rate)}</span>
              </>
            ) : (
              '–'
            )
          }
        />
      </div>

      {matrixIds.length >= 3 && (
        <>
          <div className="stats-matrix-header">
            <h3 className="stats-subheading">Alle gegen alle</h3>
            <div className="stats-segmented stats-segmented-small">
              <button
                type="button"
                className={`stats-segment ${matrixMode === 'partner' ? 'stats-segment-active' : ''}`}
                onClick={() => setMatrixMode('partner')}
              >
                Als Team
              </button>
              <button
                type="button"
                className={`stats-segment ${matrixMode === 'opposed' ? 'stats-segment-active' : ''}`}
                onClick={() => setMatrixMode('opposed')}
              >
                Gegeneinander
              </button>
            </div>
          </div>
          <p className="stats-section-subtitle">
            {matrixMode === 'partner'
              ? 'Siegquote, wenn beide im selben Team spielten.'
              : 'Siegquote der Zeile gegen die Spalte. Tippen zum Vergleichen.'}
          </p>
          <div className="stats-table-wrapper">
            <table className="stats-matrix">
              <thead>
                <tr>
                  <th />
                  {matrixIds.map((id) => (
                    <th key={id} className="stats-matrix-col">
                      <span>{nameOf(id)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixIds.map((row) => (
                  <tr key={row}>
                    <th className="stats-matrix-row">{nameOf(row)}</th>
                    {matrixIds.map((col) => {
                      if (row === col) return <td key={col} className="stats-matrix-self" />
                      const r = records.get(pairKey(row, col))
                      const cell = r
                        ? matrixMode === 'partner'
                          ? r.partner
                          : opposedRate(r, row)
                        : null
                      const selected = (row === a && col === b) || (row === b && col === a)
                      return (
                        <td
                          key={col}
                          className={`stats-matrix-cell ${selected ? 'stats-matrix-selected' : ''}`}
                          style={heat(cell?.rate ?? null, cell?.n ?? 0)}
                          title={cell ? `${cell.hits} von ${cell.n}` : undefined}
                          onClick={() => setPicked({ a: row, b: col })}
                        >
                          {cell && cell.n > 0 ? (
                            <span className={cell.n < MIN_SAMPLE ? 'stats-thin' : undefined}>
                              {formatPercent(cell.rate)}
                            </span>
                          ) : (
                            <span className="stats-muted">·</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </StatsSection>
  )
}
