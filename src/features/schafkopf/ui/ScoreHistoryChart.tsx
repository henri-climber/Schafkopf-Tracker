import { useEffect, useState } from 'react'
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
import { supabase } from '@/shared/supabase/client'
import '@/features/schafkopf/ui/ScoreHistoryChart.css'
import type { Player as PlayerData } from '@/shared/supabase/types'
import {
  computeTableResults,
  cumulativeSeries,
  type TableWithScores,
} from '@/features/schafkopf/domain/scoring'

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
  startDate: string
  endDate: string
}

export function ScoreHistoryChart({ startDate, endDate }: Props) {
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [players, setPlayers] = useState<PlayerScore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 800)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 799px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    loadChartData()
  }, [startDate, endDate])

  async function loadChartData() {
    try {
      // 1. Get all players
      const { data: playersData, error: playersError } = await supabase.from('Players').select('*')

      if (playersError) throw playersError

      // Initialize players with colors
      const initialPlayers: PlayerScore[] = (playersData as PlayerData[]).map((player, index) => ({
        id: player.id,
        name: player.name,
        color: COLORS[index % COLORS.length],
        scores: [],
      }))

      // 2. Get all tables with their creation dates
      const query = supabase
        .from('Tables')
        .select('id, created_at')
        .eq('exclude_from_overall', false)
        .eq('is_open', false)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: true })

      const { data: tablesData, error: tablesError } = await query

      if (tablesError) throw tablesError

      // Gather each table's scores. Still one round-trip pair per table —
      // collapsing that is the next commit's job.
      const tables: TableWithScores[] = []
      for (const table of tablesData) {
        const { data: roundsData, error: roundsError } = await supabase
          .from('Rounds')
          .select('id')
          .eq('table_id', table.id)

        if (roundsError) throw roundsError
        if (!roundsData?.length) continue

        const roundIds = roundsData.map((r) => r.id)

        const { data: scoresData, error: scoresError } = await supabase
          .from('round_scores')
          .select('player_id, raw_score')
          .in('round_id', roundIds)

        if (scoresError) throw scoresError
        tables.push({ id: table.id, created_at: table.created_at, scores: scoresData })
      }

      // Rules live in the domain module — the same ones the leaderboard uses,
      // so the two panels can no longer disagree.
      const playerScores: PlayerScore[] = [...initialPlayers]
      const playersById = new Map(playerScores.map((player) => [player.id, player]))
      const series = cumulativeSeries(computeTableResults(tables))

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

      const chartData = Array.from(timestampScores.entries())
        .map(([timestamp, scores]) => ({
          timestamp,
          ...scores,
        }))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

      setPlayers(playerScores)
      setChartData(chartData)
    } catch (err) {
      console.error('Error loading chart data:', err)
      setError(
        err instanceof Error ? err.message : 'An error occurred while loading the chart data',
      )
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="chart-loading">Loading chart data...</div>
  if (error) return <div className="chart-error">Error: {error}</div>
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
