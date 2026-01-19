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
  timestamp: string
  score: number
}

interface ChartData {
  timestamp: string
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

// Helper function to format timestamps
function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp)
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

interface Props {
  startDate: string
  endDate: string
}

export function PlayerScoreChart({ startDate, endDate }: Props) {
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [players, setPlayers] = useState<PlayerScore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadChartData()
  }, [startDate, endDate])

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
      let query = supabase
        .from('Tables')
        .select('id, created_at')
        .eq('exclude_from_overall', false)
        .eq('is_open', false)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: true })

      const { data: tablesData, error: tablesError } = await query

      if (tablesError) throw tablesError

      // Process each table
      const playerScores: PlayerScore[] = [...initialPlayers]
      const timestampScores = new Map<string, { [key: string]: number }>()

      for (const table of tablesData) {
        const timestamp = table.created_at // Use full timestamp

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
              timestamp,
              score: points[index] || 0
            }

            playerScores[playerIndex].scores.push(newScore)

            // Update timestamp-based scores
            if (!timestampScores.has(timestamp)) {
              timestampScores.set(timestamp, {})
            }
            const timestampEntry = timestampScores.get(timestamp)!
            timestampEntry[playerScores[playerIndex].name] = currentScore + (points[index] || 0)
          }
        })
      }

      // Convert timestampScores to chart data format
      const chartData = Array.from(timestampScores.entries())
        .map(([timestamp, scores]) => ({
          timestamp,
          ...scores
        }))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

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
    <div className="mt-8 px-4">
      <h2 className="text-xl font-semibold mb-4 text-center">Score Progression</h2>
      <div className="w-full h-[500px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 10, left: 0, bottom: 25 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e5e7eb"
              strokeWidth={1}
            />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTimestamp}
              angle={-45}
              textAnchor="end"
              height={60}
              interval="preserveStartEnd"
              tick={{ fill: '#4b5563', fontSize: 12 }}
              stroke="#9ca3af"
            />
            <YAxis
              tick={{ fill: '#4b5563', fontSize: 12 }}
              width={35}
              stroke="#9ca3af"
              domain={['dataMin - 1', 'dataMax + 1']}
              ticks={[-6, -4, -2, 0, 2, 4, 6]}
            />
            <Tooltip
              labelFormatter={formatTimestamp}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '0.375rem',
                fontSize: '14px',
                padding: '8px 12px'
              }}
            />
            <Legend
              wrapperStyle={{
                paddingTop: '10px'
              }}
              iconType="circle"
            />
            {players.map((player) => (
              <Line
                key={player.id}
                type="linear"
                dataKey={player.name}
                stroke={player.color}
                strokeWidth={2}
                dot={{ fill: player.color, r: 4, strokeWidth: 1, stroke: 'white' }}
                activeDot={{ r: 6, strokeWidth: 2, stroke: 'white' }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
} 