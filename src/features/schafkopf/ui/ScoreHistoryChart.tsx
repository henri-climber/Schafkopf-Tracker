import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import '@/features/schafkopf/ui/ScoreHistoryChart.css'
import type { Player as PlayerData } from '@/shared/supabase/types'
import type { SeriesPoint } from '@/features/schafkopf/domain/scoring'
import { useMediaQuery } from '@/shared/ui/useMediaQuery'

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
  '#E63946', // Rot
  '#F3722C', // Orange
  '#F9C74F', // Gelb
  '#90BE6D', // Hellgrün
  '#43AA8B', // Türkisgrün
  '#4D908E', // Türkis
  '#577590', // Blaugrau
  '#277DA1', // Blau
  '#4361EE', // Königsblau
  '#3A0CA3', // Indigo
  '#7209B7', // Violett
  '#B5179E', // Magenta
  '#F72585', // Pink
  '#FF99C8', // Hellpink
  '#9D4EDD', // Lavendel
  '#00BBF9', // Cyan
]

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp)
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatDate(timestamp: string) {
  const date = new Date(timestamp)
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
  }).format(date)
}

interface Props {
  /** Running totals per table, from the same query the leaderboard uses. */
  series: readonly SeriesPoint[]
  players: readonly PlayerData[]
}

/**
 * Purely presentational. It used to run its own copy of the leaderboard's fetch
 * and scoring pipeline, which meant the same screen loaded the same data twice
 * and the two panels could disagree — they filtered ongoing games differently.
 * Now it receives the computed series and only shapes it for Recharts.
 */
export function ScoreHistoryChart({ series, players: playerRows }: Props) {
  const isMobile = useMediaQuery('(max-width: 799px)')

  const { chartData, players } = useMemo(() => {
    const playerScores: PlayerScore[] = playerRows.map((player, index) => ({
      id: player.id,
      name: player.name,
      color: COLORS[index % COLORS.length],
      scores: [],
    }))
    const playersById = new Map(playerScores.map((player) => [player.id, player]))

    // Recharts wants one row per timestamp, keyed by player name. Players
    // absent from a table are absent from its row, which draws a gap.
    const timestampScores = new Map<string, { [key: string]: number }>()
    for (const point of series) {
      const row = timestampScores.get(point.timestamp) ?? {}
      for (const [playerId, total] of point.totals) {
        const player = playersById.get(playerId)
        if (!player) continue
        player.scores.push({ timestamp: point.timestamp, score: total })
        row[player.name] = total
      }
      timestampScores.set(point.timestamp, row)
    }

    const rows: ChartData[] = Array.from(timestampScores.entries())
      .map(([timestamp, scores]) => ({ timestamp, ...scores }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    return { chartData: rows, players: playerScores }
  }, [series, playerRows])

  if (!chartData.length) return <div className="chart-no-data">No data available for the chart</div>

  return (
    <div className="chart-container">
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeWidth={1} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={isMobile ? formatDate : formatTimestamp}
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
                padding: '8px 12px',
              }}
            />
            <Legend
              wrapperStyle={{
                paddingTop: '10px',
              }}
              iconType="circle"
            />
            {players
              .filter((player) => player.scores.length > 0)
              .map((player) => (
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
