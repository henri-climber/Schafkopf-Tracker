import { useMemo, useState, type ReactNode } from 'react'
import type { PlayerId } from '@/features/schafkopf/domain/scoring'
import {
  MIN_SAMPLE,
  type Duo,
  type PlayerStats,
  type RamschStats,
  type Rate,
} from '@/features/schafkopf/domain/statistics/aggregate'
import { RateText, StatsSection } from './common'
import { formatPercent, formatSigned, scoreClass } from './format'

interface Column {
  key: string
  label: string
  title?: string
  /** Sort value; null sorts last. */
  value: (s: PlayerStats) => number | null
  render: (s: PlayerStats) => ReactNode
  modeOnly?: boolean
}

const rateValue = (r: Rate) => (r.n > 0 ? r.rate : null)

const COLUMNS: Column[] = [
  { key: 'rounds', label: 'Runden', value: (s) => s.rounds, render: (s) => s.rounds },
  {
    key: 'won',
    label: 'Siege',
    title: 'Runden mit Plus',
    value: (s) => rateValue(s.won),
    render: (s) => <RateText rate={s.won} showSample={false} />,
  },
  {
    key: 'avg',
    label: 'Ø Pkt',
    title: 'Punkte pro Runde',
    value: (s) => s.avgPoints,
    render: (s) => <span className={scoreClass(s.avgPoints)}>{formatSigned(s.avgPoints)}</span>,
  },
  {
    key: 'team',
    label: 'Teamspiel',
    title: 'Gewonnene Teamspiele (2 gegen 2)',
    value: (s) => rateValue(s.team),
    render: (s) => <RateText rate={s.team} showSample={false} />,
  },
  {
    key: 'solosWon',
    label: 'Soli gew.',
    title: 'Gewonnene Soli, aus den Punkten erkannt',
    value: (s) => s.solosWon,
    render: (s) => s.solosWon,
  },
  {
    key: 'singleLosses',
    label: 'Solo verl./Ramsch',
    title: 'Allein verloren: verlorenes Solo oder Ramsch — bei alten Runden nicht unterscheidbar',
    value: (s) => s.singleLosses,
    render: (s) => s.singleLosses,
  },
  {
    key: 'best',
    label: 'Beste',
    value: (s) => s.best,
    render: (s) => <span className="stats-positive">{formatSigned(s.best)}</span>,
  },
  {
    key: 'worst',
    label: 'Schlechteste',
    value: (s) => s.worst,
    render: (s) => <span className="stats-negative">{formatSigned(s.worst)}</span>,
  },
  {
    key: 'streak',
    label: 'Serie',
    title: 'Längste Sieges- / Niederlagenserie',
    value: (s) => s.longestWinStreak,
    render: (s) => (
      <>
        <span className="stats-positive">{s.longestWinStreak}</span>
        {' / '}
        <span className="stats-negative">{s.longestLossStreak}</span>
      </>
    ),
  },
  {
    key: 'declarer',
    label: 'Als Spieler',
    title: 'Siegquote als Spieler (Runden mit Spielmodus)',
    value: (s) => rateValue(s.asDeclarer),
    render: (s) => <RateText rate={s.asDeclarer} />,
    modeOnly: true,
  },
  {
    key: 'partner',
    label: 'Als Partner',
    title: 'Siegquote als Mitspieler (Runden mit Spielmodus)',
    value: (s) => rateValue(s.asPartner),
    render: (s) => <RateText rate={s.asPartner} />,
    modeOnly: true,
  },
  {
    key: 'opponent',
    label: 'Als Gegner',
    title: 'Siegquote als Gegenspieler (Runden mit Spielmodus)',
    value: (s) => rateValue(s.asOpponent),
    render: (s) => <RateText rate={s.asOpponent} />,
    modeOnly: true,
  },
  {
    key: 'solos',
    label: 'Soli',
    title: 'Gewonnene / gespielte Soli (Runden mit Spielmodus)',
    value: (s) => rateValue(s.solos),
    render: (s) => <RateText rate={s.solos} />,
    modeOnly: true,
  },
]

export function PlayersSection({
  players,
  nameOf,
  hasModeRounds,
}: {
  players: PlayerStats[]
  nameOf: (id: PlayerId) => string
  hasModeRounds: boolean
}) {
  const [sort, setSort] = useState<{ key: string; desc: boolean }>({ key: 'rounds', desc: true })
  const columns = COLUMNS.filter((column) => hasModeRounds || !column.modeOnly)

  const sorted = useMemo(() => {
    const column = COLUMNS.find((c) => c.key === sort.key) ?? COLUMNS[0]
    return [...players].sort((a, b) => {
      const va = column.value(a)
      const vb = column.value(b)
      if (va === null && vb === null) return b.rounds - a.rounds
      if (va === null) return 1
      if (vb === null) return -1
      return (sort.desc ? vb - va : va - vb) || b.rounds - a.rounds
    })
  }, [players, sort])

  function toggleSort(key: string) {
    setSort((current) => (current.key === key ? { key, desc: !current.desc } : { key, desc: true }))
  }

  return (
    <StatsSection
      title="Spieler"
      subtitle="Zum Sortieren auf eine Spalte tippen. Blasse Werte beruhen auf weniger als 5 Runden."
    >
      {players.length === 0 ? (
        <div className="stats-empty">Keine Runden in dieser Auswahl.</div>
      ) : (
        <div className="stats-table-wrapper">
          <table className="stats-table">
            <thead>
              <tr>
                <th className="stats-sticky-col">Spieler</th>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className="stats-num stats-sortable"
                    title={column.title}
                    onClick={() => toggleSort(column.key)}
                    aria-sort={
                      sort.key === column.key ? (sort.desc ? 'descending' : 'ascending') : 'none'
                    }
                  >
                    {column.label}
                    {sort.key === column.key && (sort.desc ? ' ↓' : ' ↑')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s.playerId} className={s.rounds < MIN_SAMPLE ? 'stats-thin' : undefined}>
                  <td className="stats-name stats-sticky-col">{nameOf(s.playerId)}</td>
                  {columns.map((column) => (
                    <td key={column.key} className="stats-num">
                      {column.render(s)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </StatsSection>
  )
}

// ── Honours ─────────────────────────────────────────────────────────────────

interface Honour {
  key: string
  icon: string
  title: string
  who: string
  value: string
}

function top<T>(items: readonly T[], score: (item: T) => number): T | null {
  let best: T | null = null
  for (const item of items) if (!best || score(item) > score(best)) best = item
  return best && score(best) > 0 ? best : null
}

/** Rounds a player needs for the win-rate award, so a lucky guest cannot take it. */
const MIN_ROUNDS_FOR_RATE = 20

export function HonoursSection({
  players,
  duos,
  ramsch,
  nameOf,
}: {
  players: PlayerStats[]
  duos: { best: Duo | null; worst: Duo | null }
  ramsch: RamschStats
  nameOf: (id: PlayerId) => string
}) {
  const honours: Honour[] = []
  const add = <T,>(
    key: string,
    icon: string,
    title: string,
    item: T | null,
    who: (item: T) => string,
    value: (item: T) => string,
  ) => {
    if (item) honours.push({ key, icon, title, who: who(item), value: value(item) })
  }
  const name = (s: PlayerStats) => nameOf(s.playerId)
  const regulars = players.filter((s) => s.rounds >= MIN_ROUNDS_FOR_RATE)

  add(
    'soloKing',
    '👑',
    'Solo-König',
    top(players, (s) => s.solosWon),
    name,
    (s) => `${s.solosWon} Soli gewonnen`,
  )
  add(
    'soloBad',
    '🥀',
    'Allein untergegangen',
    top(players, (s) => s.singleLosses),
    name,
    (s) => `${s.singleLosses}× Solo verloren oder Ramsch`,
  )
  add(
    'bestRate',
    '🎯',
    'Beste Siegquote',
    top(regulars, (s) => s.won.rate ?? 0),
    name,
    (s) => `${formatPercent(s.won.rate)} von ${s.rounds} Runden`,
  )
  add(
    'streak',
    '🔥',
    'Längste Siegesserie',
    top(players, (s) => s.longestWinStreak),
    name,
    (s) => `${s.longestWinStreak} Runden am Stück`,
  )
  add(
    'lossStreak',
    '🌧️',
    'Längste Pechsträhne',
    top(players, (s) => s.longestLossStreak),
    name,
    (s) => `${s.longestLossStreak} Runden am Stück`,
  )
  add(
    'best',
    '💰',
    'Größter Einzelgewinn',
    top(players, (s) => s.best),
    name,
    (s) => formatSigned(s.best),
  )
  add(
    'soloRate',
    '🃏',
    'Beste Solo-Quote',
    top(
      players.filter((s) => s.solos.n >= MIN_SAMPLE),
      (s) => s.solos.rate ?? 0,
    ),
    name,
    (s) => `${s.solos.hits} von ${s.solos.n} Soli`,
  )
  add(
    'soloLost',
    '💸',
    'Meiste Soli verloren',
    top(players, (s) => s.solos.n - s.solos.hits),
    name,
    (s) => `${s.solos.n - s.solos.hits} von ${s.solos.n} Soli`,
  )
  add(
    'ramsch',
    '🐷',
    'Ramsch-Opfer',
    ramsch.losers[0]?.lost ? ramsch.losers[0] : null,
    (l) => nameOf(l.playerId),
    (l) => `${l.lost}× Ramsch verloren`,
  )
  add(
    'bestDuo',
    '🤝',
    'Bestes Duo',
    duos.best,
    (d) => `${nameOf(d.a)} & ${nameOf(d.b)}`,
    (d) => `${formatPercent(d.partner.rate)} von ${d.partner.n} Teamspielen`,
  )
  add(
    'worstDuo',
    '🙈',
    'Schlechtestes Duo',
    duos.worst && duos.worst !== duos.best ? duos.worst : null,
    (d) => `${nameOf(d.a)} & ${nameOf(d.b)}`,
    (d) => `${formatPercent(d.partner.rate)} von ${d.partner.n} Teamspielen`,
  )

  if (honours.length === 0) return null

  return (
    <StatsSection title="Ehrentafel">
      <div className="stats-honours">
        {honours.map((h) => (
          <div key={h.key} className="stats-honour">
            <div className="stats-honour-icon">{h.icon}</div>
            <div className="min-w-0">
              <div className="stats-honour-title">{h.title}</div>
              <div className="stats-honour-who">{h.who}</div>
              <div className="stats-honour-value">{h.value}</div>
            </div>
          </div>
        ))}
      </div>
    </StatsSection>
  )
}
