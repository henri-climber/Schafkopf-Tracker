import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { ScoreHistoryChart } from '@/features/schafkopf/ui/ScoreHistoryChart'
import '@/shared/styles/leaderboard.css'
import type { Player as PlayerRow } from '@/shared/supabase/types'
import {
  accumulateLeaderboard,
  computeTableResults,
  cumulativeSeries,
} from '@/features/schafkopf/domain/scoring'
import {
  currentSemester,
  offsetsFor,
  SEMESTERS,
  semesterById,
} from '@/features/schafkopf/domain/semesters'
import { useTablesWithScores } from '@/features/schafkopf/api/queries'
import { useCreatePlayer, usePlayers } from '@/features/players/api/queries'

/** A player row plus the standings the leaderboard computes for it. */
interface Player extends PlayerRow {
  totalScore: number
  gamesPlayed: number
}

export function LeaderboardPage() {
  const navigate = useNavigate()
  const [isAddingPlayer, setIsAddingPlayer] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [includeOngoing, setIncludeOngoing] = useState(false)
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>(() => currentSemester().id)
  const selectedSemester = semesterById(selectedSemesterId) ?? currentSemester()

  const playersQuery = usePlayers()
  const createPlayer = useCreatePlayer()
  const tablesQuery = useTablesWithScores(
    { from: selectedSemester.startDate, to: selectedSemester.endDate },
    { includeOngoing },
  )

  const loading = playersQuery.isPending || tablesQuery.isPending
  const error = playersQuery.error ?? tablesQuery.error

  // One fetch, computed once, feeding both the table and the chart below it.
  const { players, series } = useMemo(() => {
    const results = computeTableResults(tablesQuery.data ?? [])
    const standings = accumulateLeaderboard(results)
    const offsets = offsetsFor(selectedSemester.id)

    const ranked: Player[] = (playersQuery.data ?? [])
      .map((player) => {
        const entry = standings.get(player.id)
        return {
          ...player,
          totalScore: (entry?.totalPoints ?? 0) + (offsets[player.id] ?? 0),
          gamesPlayed: entry?.gamesPlayed ?? 0,
        }
      })
      .filter((player) => player.gamesPlayed > 0)
      .sort(
        (a, b) =>
          b.totalScore - a.totalScore ||
          b.gamesPlayed - a.gamesPlayed ||
          a.name.localeCompare(b.name),
      )

    return { players: ranked, series: cumulativeSeries(results) }
  }, [playersQuery.data, tablesQuery.data, selectedSemester.id])

  async function handleAddPlayer(e: React.FormEvent) {
    e.preventDefault()
    if (!newPlayerName.trim()) return

    try {
      await createPlayer.mutateAsync(newPlayerName)
      setNewPlayerName('')
      setIsAddingPlayer(false)
    } catch (error) {
      console.error('Error adding player:', error)
    }
  }

  if (loading)
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    )

  if (error)
    return (
      <div className="error-container">
        Error: {error instanceof Error ? error.message : 'Failed to load the leaderboard'}
      </div>
    )

  const top3 = players.slice(0, 3)

  return (
    <div className="leaderboard-page">
      {/* Header Section */}
      <div className="header-sticky">
        <div className="header-content">
          {/* Mobile layout (< 800px): only title stays sticky */}
          <div className="mobile-header">
            <h1 className="page-title">Leaderboard</h1>
          </div>

          {/* Desktop layout (>= 800px): only title stays sticky */}
          <h1 className="page-title desktop-title">Leaderboard</h1>
        </div>
      </div>

      {/* Mobile controls: scrolls away on scroll */}
      <div className="mobile-scrollable-controls">
        <select
          value={selectedSemesterId}
          onChange={(e) => setSelectedSemesterId(e.target.value)}
          className="semester-select"
        >
          {SEMESTERS.map((semester) => (
            <option key={semester.id} value={semester.id}>
              {semester.label}
            </option>
          ))}
        </select>
        <div className="mobile-action-row">
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
          <button
            onClick={() => setIsAddingPlayer(true)}
            className="add-player-btn"
            title="Add Player"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span>Add Player</span>
          </button>
        </div>
        <div className="toggle-wrapper">
          <label className="toggle-label">
            <div className="relative">
              <input
                type="checkbox"
                checked={includeOngoing}
                onChange={(e) => setIncludeOngoing(e.target.checked)}
                className="toggle-input peer"
              />
              <div className="toggle-switch"></div>
            </div>
            <span className="toggle-text">Include ongoing games</span>
          </label>
        </div>
      </div>

      {/* Desktop controls: scrolls away on scroll */}
      <div className="desktop-scrollable-controls">
        <div className="header-content">
          <div className="desktop-controls-row">
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
            <div className="controls-group">
              <select
                value={selectedSemesterId}
                onChange={(e) => setSelectedSemesterId(e.target.value)}
                className="semester-select"
              >
                {SEMESTERS.map((semester) => (
                  <option key={semester.id} value={semester.id}>
                    {semester.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setIsAddingPlayer(true)}
                className="add-player-btn"
                title="Add Player"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span>Add Player</span>
              </button>
            </div>
          </div>
          <div className="toggle-wrapper">
            <label className="toggle-label">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={includeOngoing}
                  onChange={(e) => setIncludeOngoing(e.target.checked)}
                  className="toggle-input peer"
                />
                <div className="toggle-switch"></div>
              </div>
              <span className="toggle-text">Include ongoing games</span>
            </label>
          </div>
        </div>
      </div>

      {isAddingPlayer && (
        <div className="modal-overlay">
          <form onSubmit={handleAddPlayer} className="modal-panel">
            <h3 className="modal-title">Add New Player</h3>
            <input
              type="text"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              placeholder="Player name"
              className="modal-input"
              autoFocus
            />
            <div className="modal-actions">
              <button
                type="button"
                onClick={() => {
                  setIsAddingPlayer(false)
                  setNewPlayerName('')
                }}
                className="btn-cancel"
              >
                Cancel
              </button>
              <button type="submit" className="btn-save">
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="main-content">
        {/* Podium Section - Only visible >= 800px */}
        {top3.length > 0 && (
          <div className="podium-container">
            {/* Second Place */}
            {top3[1] && (
              <div className="podium-card podium-card-2">
                <div className="podium-stripe podium-stripe-2"></div>
                <div className="podium-number podium-number-2">2</div>
                <div className="text-center">
                  <div className="podium-name">{top3[1].name}</div>
                  <div className="podium-score">
                    {top3[1].totalScore > 0 ? '+' : ''}
                    {top3[1].totalScore}
                  </div>
                </div>
                <div className="podium-games">{top3[1].gamesPlayed} games</div>
              </div>
            )}

            {/* First Place */}
            {top3[0] && (
              <div className="podium-card podium-card-1">
                <div className="podium-stripe podium-stripe-1"></div>
                <div className="podium-number podium-number-1">👑</div>
                <div className="text-center">
                  <div className="podium-name">{top3[0].name}</div>
                  <div className="podium-score-1">
                    {top3[0].totalScore > 0 ? '+' : ''}
                    {top3[0].totalScore}
                  </div>
                </div>
                <div className="podium-games-1">{top3[0].gamesPlayed} games</div>
              </div>
            )}

            {/* Third Place */}
            {top3[2] && (
              <div className="podium-card podium-card-3">
                <div className="podium-stripe podium-stripe-3"></div>
                <div className="podium-number podium-number-3">3</div>
                <div className="text-center">
                  <div className="podium-name">{top3[2].name}</div>
                  <div className="podium-score">
                    {top3[2].totalScore > 0 ? '+' : ''}
                    {top3[2].totalScore}
                  </div>
                </div>
                <div className="podium-games">{top3[2].gamesPlayed} games</div>
              </div>
            )}
          </div>
        )}

        {/* Players List - Shows ALL players < 800px, but only Rest > 800px */}
        {players.length > 0 && (
          <div className="list-card">
            <div className="table-wrapper">
              <table className="t-table">
                <thead className="t-head">
                  <tr>
                    <th className="t-header-cell">Rank</th>
                    <th className="t-header-cell">Player</th>
                    <th className="t-header-cell-right">Games</th>
                    <th className="t-header-cell-right">Score</th>
                  </tr>
                </thead>
                <tbody className="t-body">
                  {players.map((player, index) => {
                    // Hide top 3 players on desktop since they are in the podium
                    // Show everyone on mobile (< 800px)
                    const isTop3 = index < 3
                    const rank = index + 1

                    return (
                      <tr
                        key={player.id}
                        className={`t-row group ${isTop3 ? 'min-[800px]:hidden' : ''}`}
                      >
                        <td className="t-cell">
                          <span
                            className={`rank-badge ${
                              rank === 1
                                ? 'rank-1'
                                : rank === 2
                                  ? 'rank-2'
                                  : rank === 3
                                    ? 'rank-3'
                                    : 'rank-other'
                            }`}
                          >
                            {rank}
                          </span>
                        </td>
                        <td className="t-cell">
                          <div className="player-name-text">{player.name}</div>
                        </td>
                        <td className="t-cell-right">
                          <span className="games-text">{player.gamesPlayed}</span>
                        </td>
                        <td className="t-cell-right">
                          <span
                            className={`score-text ${
                              player.totalScore > 0
                                ? 'score-positive'
                                : player.totalScore < 0
                                  ? 'score-negative'
                                  : 'score-neutral'
                            }`}
                          >
                            {player.totalScore > 0 ? '+' : ''}
                            {player.totalScore}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Chart Section */}
        <div className="chart-container">
          <h3 className="chart-title">Performance History</h3>
          <ScoreHistoryChart series={series} players={playersQuery.data ?? []} />
        </div>
      </div>
    </div>
  )
}
