import type { PlayerId } from '@/features/schafkopf/domain/scoring'
import type { TableStats } from '@/features/schafkopf/domain/statistics/aggregate'
import { StatsSection, StatTile } from './common'
import { formatNumber, formatPercent, formatSigned, scoreClass } from './format'

const PLACES = ['1.', '2.', '3.', '4.', '5.', '6.']

export function TableWinnersSection({
  stats,
  nameOf,
}: {
  stats: TableStats
  nameOf: (id: PlayerId) => string
}) {
  const { winnerTotal } = stats
  return (
    <StatsSection
      title="Punkte zum Sieg"
      subtitle="Über ganze, abgeschlossene Spiele — unabhängig vom Runden-Filter."
    >
      {stats.tables === 0 || !winnerTotal ? (
        <div className="stats-empty">Keine abgeschlossenen Spiele in dieser Auswahl.</div>
      ) : (
        <>
          <div className="stats-tiles">
            <StatTile
              label="Ø Punkte des Siegers"
              value={formatSigned(winnerTotal.avg)}
              hint={`über ${stats.tables} Spiele`}
            />
            <StatTile
              label="Knappster Sieg"
              value={formatSigned(winnerTotal.min)}
              hint="weniger hat nie gereicht"
            />
            <StatTile label="Höchster Sieg" value={formatSigned(winnerTotal.max)} />
          </div>

          {stats.bySize.map((size) => (
            <div key={size.size}>
              <h3 className="stats-subheading">
                Ø Punkte nach Platz · {size.size} Spieler ({size.tables} Spiele)
              </h3>
              <div className="stats-places">
                {size.placeAverages.map((avg, place) => (
                  <div key={place} className="stats-place">
                    <span className="stats-place-rank">{PLACES[place]}</span>
                    <span className={`stats-place-value ${scoreClass(avg)}`}>
                      {formatSigned(Math.round(avg))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <h3 className="stats-subheading">Spielsiege</h3>
          <div className="stats-table-wrapper">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Spieler</th>
                  <th className="stats-num">Spiele</th>
                  <th className="stats-num">Siege</th>
                  <th className="stats-num">Quote</th>
                  <th className="stats-num">Ø Platz</th>
                </tr>
              </thead>
              <tbody>
                {stats.players.map((p) => (
                  <tr key={p.playerId}>
                    <td className="stats-name">{nameOf(p.playerId)}</td>
                    <td className="stats-num">{p.tables}</td>
                    <td className="stats-num">{p.wins}</td>
                    <td className="stats-num">{formatPercent(p.wins / p.tables)}</td>
                    <td className="stats-num">{formatNumber(p.avgPlace)}</td>
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
