import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PlayerScoreChart } from '../components/PlayerScoreChart'
import './Leaderboard.css'

interface Player {
  id: number
  name: string
  created_at: string
  totalScore: number
  gamesPlayed: number
}

interface Semester {
  id: string
  label: string
  startDate: string
  endDate: string
}

const SEMESTERS: Semester[] = [
  {
    id: 'sem1',
    label: 'Semester 1 (Sep 2024 - March 2025)',
    startDate: '2024-09-01T00:00:00.000Z',
    endDate: '2025-03-31T23:59:59.999Z'
  },
  {
    id: 'sem2',
    label: 'Semester 2 (April 2025 - August 2025)',
    startDate: '2025-04-01T00:00:00.000Z',
    endDate: '2025-08-31T23:59:59.999Z'
  },
  {
    id: 'sem3',
    label: 'Semester 3 (Sep 2025 - Apr 2026)',
    startDate: '2025-09-01T00:00:00.000Z',
    endDate: '2026-04-30T23:59:59.999Z'
  }
]

const SEMESTER_3_OFFSETS: Record<string, number> = {
  'Nikita': -2,
  'Quentin': -1,
  'Jost': 1,
  'Finy': -4,
  'Riccardo': 5,
  'Emil': 0,
  'Henri': 4,
  'Timon': -2,
  'Lukas': 1,
  'Pfirrmann': -2
}


export function Leaderboard() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAddingPlayer, setIsAddingPlayer] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [includeOngoing, setIncludeOngoing] = useState(false)
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>(SEMESTERS[2].id)

  const selectedSemester = SEMESTERS.find(s => s.id === selectedSemesterId) || SEMESTERS[0]

  useEffect(() => {
    loadLeaderboard()
  }, [includeOngoing, selectedSemesterId])

  function getPointsDistribution(playerCount: number): number[] {
    switch (playerCount) {
      case 4:
        return [2, 1, -1, -2]
      case 5:
        return [2, 1, 0, -1, -2]
      case 6:
        return [3, 2, 1, -1, -2, -3]
      default:
        console.warn(`Unexpected player count: ${playerCount}`)
        return []
    }
  }

  async function loadLeaderboard() {
    setLoading(true)
    setError(null)
    try {
      // 1. First, get all players
      const { data: playersData, error: playersError } = await supabase
        .from('Players')
        .select('*')

      if (playersError) throw playersError

      // Initialize players with zero scores
      const playerMap = new Map(
        playersData.map(p => [p.id, { ...p, totalScore: 0, gamesPlayed: 0 }])
      )

      // 2. Get all tables that aren't excluded
      let query = supabase
        .from('Tables')
        .select('id, name, exclude_from_overall')
        .eq('exclude_from_overall', false)
        .gte('created_at', selectedSemester.startDate)
        .lte('created_at', selectedSemester.endDate)

      // Only add is_open filter if we're not including ongoing games
      if (!includeOngoing) {
        query = query.eq('is_open', false)
      }

      const { data: tablesData, error: tablesError } = await query

      if (tablesError) throw tablesError
      console.log(tablesData)
      // 3. For each table, get players and their scores
      for (const table of tablesData) {
        // First get all round IDs for this table
        const { data: roundsData, error: roundsError } = await supabase
          .from('Rounds')
          .select('id')
          .eq('table_id', table.id)

        if (roundsError) throw roundsError
        if (!roundsData?.length) continue // Skip if no rounds found

        const roundIds = roundsData.map(r => r.id)

        // Then get all scores for these rounds
        const { data: scoresData, error: scoresError } = await supabase
          .from('round_scores')
          .select('player_id, raw_score')
          .in('round_id', roundIds)

        if (scoresError) throw scoresError
        console.log(scoresData)
        // Calculate total raw score per player for this table
        const playerScores = scoresData.reduce((acc, score) => {
          if (!acc[score.player_id]) {
            acc[score.player_id] = 0
          }
          acc[score.player_id] += score.raw_score
          return acc
        }, {} as Record<number, number>)

        // Convert to array and sort by score
        const sortedPlayers = Object.entries(playerScores)
          .map(([playerId, total_raw_score]) => ({
            player_id: parseInt(playerId),
            total_raw_score
          }))
          .sort((a, b) => b.total_raw_score - a.total_raw_score)

        console.log(sortedPlayers)
        // Get points distribution based on player count
        const points = getPointsDistribution(sortedPlayers.length)

        // Assign points to players
        sortedPlayers.forEach((player, index) => {
          const currentPlayer = playerMap.get(player.player_id)
          if (currentPlayer) {
            currentPlayer.totalScore += points[index] || 0
            currentPlayer.gamesPlayed += 1
          }
        })
      }

      // Convert player map to sorted array
      const sortedPlayers = Array.from(playerMap.values())
        .map(player => {
          // Apply Semester 3 offsets
          if (selectedSemester.id === 'sem3') {
            const offset = SEMESTER_3_OFFSETS[player.name] || 0
            return {
              ...player,
              totalScore: player.totalScore + offset
            }
          }
          return player
        })
        .filter(player => {
          // Remove Danilo from Semester 3 onwards
          if (selectedSemester.id === 'sem3' && player.name === 'Danilo') {
            return false
          }
          return true
        })
        .sort((a, b) => b.totalScore - a.totalScore)

      setPlayers(sortedPlayers)
    } catch (err) {
      console.error('Error loading leaderboard:', err)
      setError(err instanceof Error ? err.message : 'An error occurred while loading the leaderboard')
    } finally {
      setLoading(false)
    }
  }

  async function handleAddPlayer(e: React.FormEvent) {
    e.preventDefault()
    if (!newPlayerName.trim()) return

    try {
      const { error } = await supabase
        .from('Players')
        .insert([{ name: newPlayerName.trim() }])

      if (error) throw error

      setNewPlayerName('')
      setIsAddingPlayer(false)
      loadLeaderboard() // Reload the leaderboard to include the new player
    } catch (error) {
      console.error('Error adding player:', error)
    }
  }

  if (loading) return (
    <div className="loading-container">
      <div className="spinner"></div>
    </div>
  )

  if (error) return (
    <div className="error-container">
      Error: {error}
    </div>
  )

  const top3 = players.slice(0, 3)

  return (
    <div className="leaderboard-page">
      {/* Header Section */}
      <div className="header-sticky">
        <div className="header-content">
          <div className="header-row">
            <h1 className="page-title">
              Leaderboard
            </h1>

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
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
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
              <span className="toggle-text">
                Include ongoing games
              </span>
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
              <button
                type="submit"
                className="btn-save"
              >
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
                  <div className="podium-score">{top3[1].totalScore > 0 ? '+' : ''}{top3[1].totalScore}</div>
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
                    {top3[0].totalScore > 0 ? '+' : ''}{top3[0].totalScore}
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
                  <div className="podium-score">{top3[2].totalScore > 0 ? '+' : ''}{top3[2].totalScore}</div>
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
                    const isTop3 = index < 3;
                    const rank = index + 1;

                    return (
                      <tr key={player.id} className={`t-row group ${isTop3 ? 'min-[800px]:hidden' : ''}`}>
                        <td className="t-cell">
                          <span className={`rank-badge ${rank === 1 ? 'rank-1' :
                            rank === 2 ? 'rank-2' :
                              rank === 3 ? 'rank-3' :
                                'rank-other'
                            }`}>
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
                          <span className={`score-text ${player.totalScore > 0 ? 'score-positive' :
                            player.totalScore < 0 ? 'score-negative' : 'score-neutral'
                            }`}>
                            {player.totalScore > 0 ? '+' : ''}{player.totalScore}
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
          <PlayerScoreChart
            startDate={selectedSemester.startDate}
            endDate={selectedSemester.endDate}
          />
        </div>
      </div>
    </div>
  )
}