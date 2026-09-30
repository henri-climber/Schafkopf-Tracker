import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import '@/shared/styles/leaderboard.css'
import '@/shared/styles/stats.css'
import { useStatsTables } from '@/features/schafkopf/api/queries'
import { usePlayers } from '@/features/players/api/queries'
import { currentSemester, SEMESTERS, semesterById } from '@/features/schafkopf/domain/semesters'
import {
  DEFAULT_STATS_FILTERS,
  filterTables,
  selectRounds,
  toStatTables,
  type StatsFilters,
} from '@/features/schafkopf/domain/statistics/normalize'
import {
  duos,
  kontraReStats,
  modeStats,
  overview,
  pairRecords,
  playerStats,
  ramschStats,
  tableStats,
} from '@/features/schafkopf/domain/statistics/aggregate'
import { StatsFiltersBar } from './Stats/StatsFilters'
import { OverviewSection } from './Stats/OverviewSection'
import { GameModesSection, KontraReSection } from './Stats/GameModesSection'
import { HonoursSection, PlayersSection } from './Stats/PlayersSection'
import { TableWinnersSection } from './Stats/TableWinnersSection'
import { HeadToHeadSection } from './Stats/HeadToHeadSection'
import { ALL_SEMESTERS, playerNames } from './Stats/format'

const ALL_TIME = {
  from: SEMESTERS[0].startDate,
  to: SEMESTERS[SEMESTERS.length - 1].endDate,
}

export function StatsPage() {
  const navigate = useNavigate()
  const [semesterId, setSemesterId] = useState<string>(() => currentSemester().id)
  const [filters, setFilters] = useState<StatsFilters>(DEFAULT_STATS_FILTERS)

  const semester = semesterId === ALL_SEMESTERS ? null : semesterById(semesterId)
  const range = semester ? { from: semester.startDate, to: semester.endDate } : ALL_TIME

  const playersQuery = usePlayers()
  const tablesQuery = useStatsTables(range)

  const allTables = useMemo(() => toStatTables(tablesQuery.data ?? []), [tablesQuery.data])
  const nameOf = useMemo(() => playerNames(playersQuery.data ?? []), [playersQuery.data])

  const stats = useMemo(() => {
    const tables = filterTables(allTables, filters)
    const rounds = selectRounds(tables, filters.source)
    const records = pairRecords(rounds)
    const players = playerStats(rounds)
    return {
      tables,
      rounds,
      records,
      players,
      overview: overview(rounds),
      modes: modeStats(rounds),
      kontraRe: kontraReStats(rounds),
      ramsch: ramschStats(rounds),
      tableStats: tableStats(tables),
      duos: duos(records),
    }
  }, [allTables, filters])

  const loading = playersQuery.isPending || tablesQuery.isPending
  const error = playersQuery.error ?? tablesQuery.error
  const legacyOnly = filters.source === 'legacy'
  const hasModeRounds = stats.overview.modeRounds > 0

  return (
    <div className="leaderboard-page">
      <div className="header-sticky">
        <div className="header-content stats-header">
          <button
            onClick={() => navigate('/')}
            className="back-btn"
            title="Zurück zur Hauptansicht"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h1 className="page-title">Statistiken</h1>
          <span className="w-9" />
        </div>
      </div>

      <div className="stats-content">
        <StatsFiltersBar
          semesterId={semesterId}
          onSemesterChange={setSemesterId}
          filters={filters}
          onFiltersChange={setFilters}
        />

        {loading ? (
          <div className="stats-loading">
            <div className="spinner"></div>
          </div>
        ) : error ? (
          <div className="stats-empty stats-negative">
            Fehler:{' '}
            {error instanceof Error ? error.message : 'Statistiken konnten nicht geladen werden'}
          </div>
        ) : (
          <>
            <p className="stats-caption">
              {stats.overview.rounds} Runden aus {stats.tables.length} Spielen · davon{' '}
              {stats.overview.modeRounds} mit Spielmodus
            </p>

            <OverviewSection overview={stats.overview} nameOf={nameOf} />
            <HonoursSection
              players={stats.players}
              duos={stats.duos}
              ramsch={stats.ramsch}
              nameOf={nameOf}
            />
            <PlayersSection players={stats.players} nameOf={nameOf} hasModeRounds={hasModeRounds} />
            <HeadToHeadSection
              tables={stats.tables}
              rounds={stats.rounds}
              players={stats.players}
              records={stats.records}
              nameOf={nameOf}
              hasModeRounds={hasModeRounds}
            />
            <GameModesSection stats={stats.modes} legacyOnly={legacyOnly} />
            <KontraReSection stats={stats.kontraRe} legacyOnly={legacyOnly} />
            <TableWinnersSection stats={stats.tableStats} nameOf={nameOf} />
          </>
        )}
      </div>
    </div>
  )
}
