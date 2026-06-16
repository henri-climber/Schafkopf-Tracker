import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { TTSide } from '../../lib/supabase'
import { computeTTRatingsSplit, type TTEloMatchInput, type TTPlayerRating, type TTPool } from '../../lib/elo'
import { matchWinner } from '../../lib/tt'
import '../Leaderboard.css'

interface Row {
  id: number
  name: string
  rating: number
  games: number
  wins: number
}

interface MatchRow {
  id: number
  best_of: number
  tt_match_players: { player_id: number; side: TTSide }[]
  tt_sets: { score_a: number; score_b: number }[]
}

export function TTLeaderboard() {
  const navigate = useNavigate()
  const [einzelRows, setEinzelRows] = useState<Row[]>([])
  const [doppelRows, setDoppelRows] = useState<Row[]>([])
  const [pool, setPool] = useState<TTPool>('einzel')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadLeaderboard()
  }, [])

  async function loadLeaderboard() {
    setLoading(true)
    setError(null)
    try {
      const { data: playersData, error: playersError } = await supabase
        .from('Players')
        .select('id, name')
      if (playersError) throw playersError
      const nameById = new Map<number, string>((playersData || []).map(p => [p.id, p.name]))

      const { data: matchesData, error: matchesError } = await supabase
        .from('tt_matches')
        .select('id, best_of, tt_match_players(player_id, side), tt_sets(score_a, score_b)')
        .eq('is_open', false)
        .eq('exclude_from_overall', false)
        .order('created_at', { ascending: true })
      if (matchesError) throw matchesError

      const inputs: TTEloMatchInput[] = []
      for (const m of (matchesData as MatchRow[]) || []) {
        const winner = matchWinner(m.tt_sets || [], m.best_of)
        if (!winner) continue
        const sideA = m.tt_match_players.filter(p => p.side === 'A').map(p => p.player_id)
        const sideB = m.tt_match_players.filter(p => p.side === 'B').map(p => p.player_id)
        if (sideA.length === 0 || sideB.length === 0) continue
        inputs.push({ sideA, sideB, winner })
      }

      const toRows = (ratings: Map<number, TTPlayerRating>): Row[] =>
        Array.from(ratings.values())
          .filter(r => r.games > 0)
          .map(r => ({
            id: r.playerId,
            name: nameById.get(r.playerId) ?? `#${r.playerId}`,
            rating: Math.round(r.rating),
            games: r.games,
            wins: r.wins,
          }))
          .sort((a, b) => b.rating - a.rating || b.wins - a.wins || a.name.localeCompare(b.name))

      const { einzel, doppel } = computeTTRatingsSplit(inputs)
      setEinzelRows(toRows(einzel))
      setDoppelRows(toRows(doppel))
    } catch (err) {
      console.error('Error loading TT leaderboard:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="loading-container">
      <div className="spinner"></div>
    </div>
  )

  if (error) return <div className="error-container">Error: {error}</div>

  const rows = pool === 'einzel' ? einzelRows : doppelRows
  const top3 = rows.slice(0, 3)

  const poolToggle = (
    <div className="tt-pool-toggle" role="tablist" aria-label="Wertung wählen">
      <button
        type="button"
        role="tab"
        aria-selected={pool === 'einzel'}
        onClick={() => setPool('einzel')}
        className={`tt-pool-btn${pool === 'einzel' ? ' active' : ''}`}
      >
        Einzel
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={pool === 'doppel'}
        onClick={() => setPool('doppel')}
        className={`tt-pool-btn${pool === 'doppel' ? ' active' : ''}`}
      >
        Doppel
      </button>
    </div>
  )

  return (
    <div className="leaderboard-page">
      <div className="header-sticky">
        <div className="header-content">
          <div className="mobile-header">
            <h1 className="page-title">TT Leaderboard</h1>
          </div>
          <h1 className="page-title desktop-title">Tischtennis Leaderboard</h1>
        </div>
      </div>

      <div className="mobile-scrollable-controls">
        <div className="mobile-action-row">
          <button onClick={() => navigate('/')} className="back-btn" title="Zurück zur Hauptansicht">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {poolToggle}
        </div>
      </div>

      <div className="desktop-scrollable-controls">
        <div className="header-content">
          <div className="desktop-controls-row">
            <button onClick={() => navigate('/')} className="back-btn" title="Zurück zur Hauptansicht">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            {poolToggle}
          </div>
        </div>
      </div>

      <div className="main-content">
        {top3.length > 0 && (
          <div className="podium-container">
            {top3[1] && (
              <div className="podium-card podium-card-2">
                <div className="podium-stripe podium-stripe-2"></div>
                <div className="podium-number podium-number-2">2</div>
                <div className="text-center">
                  <div className="podium-name">{top3[1].name}</div>
                  <div className="podium-score">{top3[1].rating}</div>
                </div>
                <div className="podium-games">{top3[1].games} matches</div>
              </div>
            )}
            {top3[0] && (
              <div className="podium-card podium-card-1">
                <div className="podium-stripe podium-stripe-1"></div>
                <div className="podium-number podium-number-1">👑</div>
                <div className="text-center">
                  <div className="podium-name">{top3[0].name}</div>
                  <div className="podium-score-1">{top3[0].rating}</div>
                </div>
                <div className="podium-games-1">{top3[0].games} matches</div>
              </div>
            )}
            {top3[2] && (
              <div className="podium-card podium-card-3">
                <div className="podium-stripe podium-stripe-3"></div>
                <div className="podium-number podium-number-3">3</div>
                <div className="text-center">
                  <div className="podium-name">{top3[2].name}</div>
                  <div className="podium-score">{top3[2].rating}</div>
                </div>
                <div className="podium-games">{top3[2].games} matches</div>
              </div>
            )}
          </div>
        )}

        {rows.length > 0 ? (
          <div className="list-card">
            <div className="table-wrapper">
              <table className="t-table">
                <thead className="t-head">
                  <tr>
                    <th className="t-header-cell">Rank</th>
                    <th className="t-header-cell">Player</th>
                    <th className="t-header-cell-right">Matches</th>
                    <th className="t-header-cell-right">Wins</th>
                    <th className="t-header-cell-right">Elo</th>
                  </tr>
                </thead>
                <tbody className="t-body">
                  {rows.map((player, index) => {
                    const isTop3 = index < 3
                    const rank = index + 1
                    return (
                      <tr key={player.id} className={`t-row group ${isTop3 ? 'min-[800px]:hidden' : ''}`}>
                        <td className="t-cell">
                          <span className={`rank-badge ${rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-other'}`}>
                            {rank}
                          </span>
                        </td>
                        <td className="t-cell">
                          <div className="player-name-text">{player.name}</div>
                        </td>
                        <td className="t-cell-right">
                          <span className="games-text">{player.games}</span>
                        </td>
                        <td className="t-cell-right">
                          <span className="games-text">{player.wins}</span>
                        </td>
                        <td className="t-cell-right">
                          <span className="score-text text-blue-600">{player.rating}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-12">
            Noch keine abgeschlossenen {pool === 'einzel' ? 'Einzel' : 'Doppel'}-Matches. Spiele ein Match und schließe es, um Elo zu sehen.
          </div>
        )}
      </div>
    </div>
  )
}
