import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabase'

interface PlayerData {
  id: number
  name: string
  created_at: string
}

interface PlayerScore {
  id: number
  name: string
  color: string
  scores: ScoreEntry[]
}

interface ScoreEntry {
  date: string
  score: number
}

interface ChartData {
  date: string
  [key: string]: string | number
}

const COLORS = [
  '#2563eb', // blue-600
  '#dc2626', // red-600
  '#16a34a', // green-600
  '#9333ea', // purple-600
  '#ea580c', // orange-600
  '#0891b2', // cyan-600
  '#4f46e5', // indigo-600
  '#c026d3', // fuchsia-600
]

export function PlayerScoreChart() {
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [players, setPlayers] = useState<PlayerScore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadChartData()
  }, [])

  async function loadChartData() {
    try {
      // 1. Get all players
      const { data: playersData, error: playersError } = await supabase
        .from('Players')
        .select('*')

      if (playersError) throw playersError

      // Initialize players with colors
      const initialPlayers: PlayerScore[] = (playersData as PlayerData[]).map((player, index) => ({
        id: player.id,
        name: player.name,
        color: COLORS[index % COLORS.length],
        scores: []
      }))

      // 2. Get all tables with their creation dates
      const { data: tablesData, error: tablesError } = await supabase
        .from('Tables')
        .select('id, created_at')
        .eq('exclude_from_overall', false)
        .eq('is_open', false)
        .order('created_at', { ascending: true })

      if (tablesError) throw tablesError

      // Process each table
      const playerScores: PlayerScore[] = [...initialPlayers]
      const dateScores = new Map<string, { [key: string]: number }>()

      for (const table of tablesData) {
        const date = new Date(table.created_at).toISOString().split('T')[0]

        // Get rounds for this table
        const { data: roundsData, error: roundsError } = await supabase
          .from('Rounds')
          .select('id')
          .eq('table_id', table.id)

        if (roundsError) throw roundsError
        if (!roundsData?.length) continue

        const roundIds = roundsData.map(r => r.id)

        // Get scores for these rounds
        const { data: scoresData, error: scoresError } = await supabase
          .from('round_scores')
          .select('player_id, raw_score')
          .in('round_id', roundIds)

        if (scoresError) throw scoresError

        // Calculate scores for this table
        const tableScores = scoresData.reduce((acc, score) => {
          if (!acc[score.player_id]) acc[score.player_id] = 0
          acc[score.player_id] += score.raw_score
          return acc
        }, {} as Record<number, number>)

        // Sort players by score and assign points
        const sortedPlayers = Object.entries(tableScores)
          .map(([playerId, score]) => ({
            playerId: parseInt(playerId),
            score
          }))
          .sort((a, b) => b.score - a.score)

        const points = getPointsDistribution(sortedPlayers.length)

        // Update running totals for each player
        sortedPlayers.forEach((player, index) => {
          const playerIndex = playerScores.findIndex(p => p.id === player.playerId)
          if (playerIndex !== -1) {
            const currentScore = playerScores[playerIndex].scores
              .reduce((total: number, entry: ScoreEntry) => total + entry.score, 0)
            
            const newScore: ScoreEntry = {
              date,
              score: points[index] || 0
            }
            
            playerScores[playerIndex].scores.push(newScore)

            // Update date-based scores
            if (!dateScores.has(date)) {
              dateScores.set(date, {})
            }
            const dateEntry = dateScores.get(date)!
            dateEntry[playerScores[playerIndex].name] = currentScore + (points[index] || 0)
          }
        })
      }

      // Convert dateScores to chart data format
      const chartData = Array.from(dateScores.entries())
        .map(([date, scores]) => ({
          date,
          ...scores
        }))
        .sort((a, b) => a.date.localeCompare(b.date))

      setPlayers(playerScores)
      setChartData(chartData)
    } catch (err) {
      console.error('Error loading chart data:', err)
      setError(err instanceof Error ? err.message : 'An error occurred while loading the chart data')
    } finally {
      setLoading(false)
    }
  }

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

  if (loading) return <div className="text-center p-4">Loading chart data...</div>
  if (error) return <div className="text-center text-red-500 p-4">Error: {error}</div>
  if (!chartData.length) return <div className="text-center p-4">No data available for the chart</div>

  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold mb-4 text-center">Score Progression</h2>
      <div className="w-full h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#4b5563' }}
            />
            <YAxis
              tick={{ fill: '#4b5563' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '0.375rem'
              }}
            />
            <Legend />
            {players.map((player) => (
              <Line
                key={player.id}
                type="monotone"
                dataKey={player.name}
                stroke={player.color}
                strokeWidth={2}
                dot={{ fill: player.color }}
                activeDot={{ r: 8 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
} 