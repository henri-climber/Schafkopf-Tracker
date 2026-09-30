import { modeLabel, SUIT_META } from '@/features/schafkopf/domain/gameModes'
import type { KontraReStats, ModeStats } from '@/features/schafkopf/domain/statistics/aggregate'
import { EmptyModeData, RateText, RateTile, StatsSection, StatTile } from './common'
import { formatNumber, formatPercent, formatRate } from './format'

export function GameModesSection({ stats, legacyOnly }: { stats: ModeStats; legacyOnly: boolean }) {
  return (
    <StatsSection
      title="Spielmodi"
      subtitle={stats.total > 0 ? `${stats.total} Runden mit Spielmodus` : undefined}
    >
      {stats.total === 0 ? (
        <EmptyModeData legacyOnly={legacyOnly} />
      ) : (
        <>
          <div className="stats-table-wrapper">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Spiel</th>
                  <th className="stats-num">Anzahl</th>
                  <th className="stats-num">Spieler gewinnt</th>
                  <th className="stats-num">Ø Punkte</th>
                  <th className="stats-num">Schneider</th>
                  <th className="stats-num">Ø Laufende</th>
                  <th className="stats-num">Kontra</th>
                </tr>
              </thead>
              <tbody>
                {stats.modes.map((row) => (
                  <tr key={row.mode}>
                    <td className="stats-name">{modeLabel(row.mode)}</td>
                    <td className="stats-num">
                      <div className="stats-share">
                        <span>{row.count}</span>
                        <span className="stats-share-track">
                          <span
                            className="stats-share-fill"
                            style={{ width: `${row.share * 100}%` }}
                          />
                        </span>
                        <span className="stats-sample">{formatPercent(row.share)}</span>
                      </div>
                    </td>
                    <td className="stats-num">
                      {row.declarerWin ? (
                        <RateText rate={row.declarerWin} />
                      ) : (
                        <span className="stats-muted">–</span>
                      )}
                    </td>
                    <td className="stats-num">{formatNumber(row.avgDeclarerScore)}</td>
                    <td className="stats-num">{formatRate(row.schneider)}</td>
                    <td className="stats-num">{formatNumber(row.avgLaufende)}</td>
                    <td className="stats-num">{formatRate(row.kontra)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {stats.suits.length > 0 && (
            <>
              <h3 className="stats-subheading">Nach Farbe</h3>
              <div className="stats-chips">
                {stats.suits.map((row) => (
                  <div key={`${row.mode}-${row.suit}`} className="stats-chip">
                    <span>
                      {row.mode === 'sauspiel' ? 'Sau' : modeLabel(row.mode)}{' '}
                      {SUIT_META[row.suit].symbol}
                    </span>
                    <span className="stats-chip-value">{row.count}×</span>
                    <RateText rate={row.declarerWin} showSample={false} />
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </StatsSection>
  )
}

export function KontraReSection({
  stats,
  legacyOnly,
}: {
  stats: KontraReStats
  legacyOnly: boolean
}) {
  return (
    <StatsSection
      title="Kontra, Re & Klopfer"
      subtitle="Kontra gewinnt, wenn der Spieler verliert. Re gewinnt, wenn der Spieler trotzdem gewinnt."
    >
      {stats.games === 0 && stats.klopfer.n === 0 ? (
        <EmptyModeData legacyOnly={legacyOnly} />
      ) : (
        <>
          <div className="stats-tiles">
            <RateTile label="Kontra gegeben" rate={stats.kontra} />
            <RateTile label="Kontra gewinnt" rate={stats.kontraSuccess} />
            <RateTile label="Re nach Kontra" rate={stats.re} />
            <RateTile label="Re gewinnt" rate={stats.reSuccess} />
            <RateTile
              label="Spieler gewinnt ohne Kontra"
              rate={stats.winWithoutKontra}
              hint="zum Vergleich"
            />
            <StatTile
              label="Geklopft"
              value={formatRate(stats.klopfer)}
              hint={
                stats.avgKlopfer !== null
                  ? `Ø ${formatNumber(stats.avgKlopfer)} Klopfer, wenn geklopft`
                  : `${stats.klopfer.hits} von ${stats.klopfer.n}`
              }
            />
          </div>
          <div className="stats-inline-list">
            {stats.byFamily.map((f) => (
              <div key={f.family}>
                <span className="stats-muted">{f.family === 'team' ? 'Teamspiele' : 'Soli'}:</span>{' '}
                Kontra <RateText rate={f.kontra} />, davon gewonnen{' '}
                <RateText rate={f.kontraSuccess} />
              </div>
            ))}
          </div>
        </>
      )}
    </StatsSection>
  )
}
