import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PlayerScoreChart } from '../components/PlayerScoreChart'

interface Player {
  id: number
  name: string
  created_at: string
  totalScore: number
  gamesPlayed: number
}


export function Leaderboard() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAddingPlayer, setIsAddingPlayer] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [includeOngoing, setIncludeOngoing] = useState(false)

  useEffect(() => {
    loadLeaderboard()
  }, [includeOngoing])

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

  if (loading) return <div className="text-center p-4">Loading...</div>
  if (error) return <div className="text-center text-red-500 p-4">Error: {error}</div>

  return (
    <div className="flex flex-col min-h-screen bg-white text-black">
      <div className="p-4 border-b">
        <h1 className="text-2xl font-bold text-center mb-4">Leaderboard</h1>
        <div className="flex justify-center items-center gap-4">
          <button
            onClick={() => setIsAddingPlayer(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add Player
          </button>

          <label className="inline-flex items-center cursor-pointer gap-2">
            <div className="relative">
              <input
                type="checkbox"
                checked={includeOngoing}
                onChange={(e) => setIncludeOngoing(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
            </div>
            <span className="text-sm font-medium text-gray-600">
              Include ongoing games
            </span>
          </label>
        </div>

        {isAddingPlayer && (
          <form onSubmit={handleAddPlayer} className="flex gap-2 justify-center mt-4">
            <input
              type="text"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              placeholder="Player name"
              className="px-3 py-2 border rounded-lg text-black"
              autoFocus
            />
            <button
              type="submit"
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAddingPlayer(false)
                setNewPlayerName('')
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              Cancel
            </button>
          </form>
        )}
      </div>

      <div className="flex-1 p-4">
        <div className="max-w-2xl mx-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left font-semibold">Rank</th>
                <th className="p-3 text-left font-semibold">Player</th>
                <th className="p-3 text-right font-semibold">Score</th>
                <th className="p-3 text-right font-semibold">Games</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player, index) => (
                <tr key={player.id} className="hover:bg-gray-50">
                  <td className="p-3 border-b">{index + 1}</td>
                  <td className="p-3 border-b font-medium">{player.name}</td>
                  <td className="p-3 border-b text-right">
                    {player.totalScore > 0 ? '+' : ''}{player.totalScore}
                  </td>
                  <td className="p-3 border-b text-right text-gray-600">
                    {player.gamesPlayed}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <PlayerScoreChart />
        </div>
      </div>
    </div>
  )
} 