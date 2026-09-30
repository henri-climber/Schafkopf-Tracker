import { Link } from 'react-router'
import type { PlayerId } from '@/features/schafkopf/domain/scoring'
import type { Overview } from '@/features/schafkopf/domain/statistics/aggregate'
import { describeRound } from '@/features/schafkopf/domain/gameModes'
import { SplitBar, StatsSection, StatTile } from './common'
import { formatNumber } from './format'

export function OverviewSection({
  overview,
  nameOf,
}: {
  overview: Overview
  nameOf: (id: PlayerId) => string
}) {
  const { shapes, families, biggest } = overview
  const biggestWinners = biggest?.seats
    .filter((seat) => seat.side === 'up')
    .map((seat) => nameOf(seat.playerId))
    .join(' & ')

  return (
    <StatsSection title="Überblick">
      <div className="stats-tiles">
        <StatTile label="Runden" value={overview.rounds} hint={`${overview.tables} Spiele`} />
        <StatTile label="Spieler" value={overview.players} />
        <StatTile
          label="Ø Rundenwert"
          value={formatNumber(overview.avgStake)}
          hint="Punkte, die pro Runde den Besitzer wechseln"
        />
        <StatTile
          label="Größte Runde"
          value={biggest ? biggest.stake : '–'}
          hint={
            biggest && (
              <Link to={`/game-details/${biggest.tableId}`} className="stats-link">
                {biggest.facts ? `${describeRound(biggest.facts)} · ` : ''}
                {biggestWinners}
              </Link>
            )
          }
        />
      </div>

      <h3 className="stats-subheading">Spielarten (alle Runden, aus den Punkten erkannt)</h3>
      <SplitBar
        segments={[
          { key: 'team', label: 'Teamspiel', value: shapes.team, className: 'stats-fill-team' },
          {
            key: 'won',
            label: 'Solo gewonnen',
            value: shapes.soloWon,
            className: 'stats-fill-won',
          },
          {
            key: 'loss',
            label: 'Solo verloren / Ramsch',
            value: shapes.singleLoss,
            className: 'stats-fill-loss',
          },
          { key: 'other', label: 'Sonstige', value: shapes.other, className: 'stats-fill-other' },
        ]}
      />

      {overview.modeRounds > 0 && (
        <>
          <h3 className="stats-subheading">Genau (nur Runden mit Spielmodus)</h3>
          <SplitBar
            segments={[
              {
                key: 'team',
                label: 'Teamspiel',
                value: families.team,
                className: 'stats-fill-team',
              },
              {
                key: 'won',
                label: 'Solo gewonnen',
                value: families.soloWon,
                className: 'stats-fill-won',
              },
              {
                key: 'lost',
                label: 'Solo verloren',
                value: families.soloLost,
                className: 'stats-fill-loss',
              },
              {
                key: 'ramsch',
                label: 'Ramsch',
                value: families.ramsch,
                className: 'stats-fill-ramsch',
              },
            ]}
          />
        </>
      )}
    </StatsSection>
  )
}
