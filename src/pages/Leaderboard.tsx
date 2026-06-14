import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PlayerScoreChart } from '../components/PlayerScoreChart'
import { computeSchafkopfLeaderboard, type TableInput } from '../lib/schafkopfElo'
import './Leaderboard.css'

interface Player {
  id: number
  name: string
  elo: number
  hands: number
  tablesCounted: number
  lb: number
  settlement: number
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
    label: 'Semester 1 (September 2024 - March 2025)',
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
    label: 'Semester 3 (September 2025 - April 2026)',
    startDate: '2025-09-01T00:00:00.000Z',
    endDate: '2026-02-27T23:59:59.999Z'
  },
  {
    id: 'sem4',
    label: 'Semester 4 (April 2026 - October 2026)',
    startDate: '2026-02-28T00:00:00.000Z',
    endDate: '2026-09-30T23:59:59.999Z'
  }
]

export function Leaderboard() {
  const navigate = useNavigate()
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAddingPlayer, setIsAddingPlayer] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [includeOngoing, setIncludeOngoing] = useState(false)
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>(SEMESTERS[SEMESTERS.length - 1].id)
  const selectedSemester = SEMESTERS.find(s => s.id === selectedSemesterId) || SEMESTERS[0]

  useEffect(() => {
    loadLeaderboard()
  }, [includeOngoing, selectedSemesterId])

  async function loadLeaderboard() {
    setLoading(true)
    setError(null)
    try {
      // 1. Spielernamen (id -> name)
      const { data: playersData, error: playersError } = await supabase
        .from('Players')
        .select('id, name')
      if (playersError) throw playersError
      const nameById = new Map<number, string>((playersData || []).map(p => [p.id, p.name]))

      // 2. Tische bis zum Semesterende, nicht ausgeschlossen.
      //    Die gesamte Historie VOR dem Semester wird mitgeladen, damit das
      //    Stärke-Elo über Semester hinweg fortgeschrieben wird (Carry-over).
      //    Nur Tische IM Semesterfenster zählen für LB/Strich (siehe Flag unten).
      let query = supabase
        .from('Tables')
        .select('id, created_at, exclude_from_overall')
        .eq('exclude_from_overall', false)
        .lte('created_at', selectedSemester.endDate)
      if (!includeOngoing) {
        query = query.eq('is_open', false)
      }
      const { data: tablesData, error: tablesError } = await query
      if (tablesError) throw tablesError

      // 3. Pro Tisch: Runden (chronologisch) + Scores laden -> TableInput
      const tableInputs: TableInput[] = []
      for (const table of tablesData || []) {
        const { data: roundsData, error: roundsError } = await supabase
          .from('Rounds')
          .select('id, round_number')
          .eq('table_id', table.id)
          .order('round_number', { ascending: true })
        if (roundsError) throw roundsError
        if (!roundsData?.length) continue

        const roundIds = roundsData.map(r => r.id)
        const { data: scoresData, error: scoresError } = await supabase
          .from('round_scores')
          .select('round_id, player_id, raw_score')
          .in('round_id', roundIds)
        if (scoresError) throw scoresError

        const byRound = new Map<number, { playerId: number; rawScore: number }[]>()
        for (const s of scoresData || []) {
          if (!byRound.has(s.round_id)) byRound.set(s.round_id, [])
          byRound.get(s.round_id)!.push({ playerId: s.player_id, rawScore: s.raw_score })
        }

        const rounds = roundsData
          .map(r => ({ scores: byRound.get(r.id) || [] }))
          .filter(r => r.scores.length > 0)

        tableInputs.push({
          tableId: table.id,
          createdAt: table.created_at,
          rounds,
          countsForLeaderboard: table.created_at >= selectedSemester.startDate,
        })
      }

      // 4. Chronologischer Replay: Stärke-Elo + gewichtetes Leaderboard
      const results = computeSchafkopfLeaderboard(tableInputs)
      const rows: Player[] = Array.from(results.values())
        .filter(r => r.tablesCounted > 0)
        .map(r => ({
          id: r.playerId,
          name: nameById.get(r.playerId) ?? `#${r.playerId}`,
          elo: Math.round(r.elo),
          hands: r.hands,
          tablesCounted: r.tablesCounted,
          // LB = Können pro Spiel (Ø), nicht Summe -> keine Vielspieler-Bevorzugung.
          lb: r.lbTotal / r.tablesCounted,
          settlement: r.settlementTotal,
        }))
        .sort((a, b) => b.lb - a.lb || b.elo - a.elo || a.name.localeCompare(b.name))

      setPlayers(rows)
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

  const fmtLb = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}`

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
          <button onClick={() => navigate('/')} className="back-btn" title="Zurück zur Hauptansicht">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button onClick={() => setIsAddingPlayer(true)} className="add-player-btn" title="Add Player">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
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
            <button onClick={() => navigate('/')} className="back-btn" title="Zurück zur Hauptansicht">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
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
              <button onClick={() => setIsAddingPlayer(true)} className="add-player-btn" title="Add Player">
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
                  <div className="podium-score">{fmtLb(top3[1].lb)}</div>
                </div>
                <div className="podium-games">{top3[1].tablesCounted} Spiele · {top3[1].elo}</div>
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
                    {fmtLb(top3[0].lb)}
                  </div>
                </div>
                <div className="podium-games-1">{top3[0].tablesCounted} Spiele · {top3[0].elo}</div>
              </div>
            )}

            {/* Third Place */}
            {top3[2] && (
              <div className="podium-card podium-card-3">
                <div className="podium-stripe podium-stripe-3"></div>
                <div className="podium-number podium-number-3">3</div>
                <div className="text-center">
                  <div className="podium-name">{top3[2].name}</div>
                  <div className="podium-score">{fmtLb(top3[2].lb)}</div>
                </div>
                <div className="podium-games">{top3[2].tablesCounted} Spiele · {top3[2].elo}</div>
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
                    <th className="t-header-cell-right">Spiele</th>
                    <th className="t-header-cell-right">Elo</th>
                    <th className="t-header-cell-right">Ø LB</th>
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
                          <span className="games-text">{player.tablesCounted}</span>
                        </td>
                        <td className="t-cell-right">
                          <span className="score-text text-blue-600">{player.elo}</span>
                        </td>
                        <td className="t-cell-right">
                          <span className={`score-text ${player.lb > 0 ? 'score-positive' :
                            player.lb < 0 ? 'score-negative' : 'score-neutral'
                            }`}>
                            {fmtLb(player.lb)}
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
