import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { supabase } from '../../lib/supabase'
import type { TTFormat, TTSide } from '../../lib/supabase'
import { setsWon, matchWinner, ttFormatLabel } from '../../lib/tt'
import '../PastGames.css'

interface Player {
  id: number
  name: string
}

interface MatchPlayer {
  player_id: number
  side: TTSide
  player: Player
}

interface MatchRow {
  id: number
  name: string | null
  created_at: string
  format: TTFormat
  best_of: number
  exclude_from_overall: boolean
  tt_match_players: MatchPlayer[]
  tt_sets: { score_a: number; score_b: number }[]
}

export function TTPastMatches() {
  const navigate = useNavigate()
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPastMatches()
  }, [])

  async function loadPastMatches() {
    try {
      const { data, error } = await supabase
        .from('tt_matches')
        .select('id, name, created_at, format, best_of, exclude_from_overall, tt_match_players(player_id, side, player:Players(id, name)), tt_sets(score_a, score_b)')
        .eq('is_open', false)
        .order('created_at', { ascending: false })
      if (error) throw error
      setMatches((data as unknown as MatchRow[]) || [])
    } catch (error) {
      console.error('Error loading past TT matches:', error)
    } finally {
      setLoading(false)
    }
  }

  function teamName(m: MatchRow, side: TTSide): string {
    return m.tt_match_players
      .filter(mp => mp.side === side)
      .map(mp => mp.player?.name ?? `#${mp.player_id}`)
      .join(' & ') || '—'
  }

  return (
    <div className="past-games-container">
      <div className="past-games-header">
        <button onClick={() => navigate('/')} className="past-games-back-btn">
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <h1 className="past-games-title">Past Matches</h1>
      </div>

      <div className="past-games-content">
        {loading ? (
          <div className="text-center text-gray-600">Loading...</div>
        ) : matches.length === 0 ? (
          <div className="text-center text-gray-600">No past matches found</div>
        ) : (
          <div className="past-games-list">
            {matches.map(m => {
              const won = setsWon(m.tt_sets || [])
              const winner = matchWinner(m.tt_sets || [], m.best_of)
              return (
                <button
                  key={m.id}
                  onClick={() => navigate(`/tt/match/${m.id}`)}
                  className="past-game-card"
                >
                  <div className="past-game-name">
                    {m.name ? `${m.name} — ` : ''}
                    <span className={winner === 'A' ? 'text-blue-400 font-bold' : ''}>{teamName(m, 'A')}</span>
                    {'  '}<span className="text-gray-400">{won.a}:{won.b}</span>{'  '}
                    <span className={winner === 'B' ? 'text-emerald-400 font-bold' : ''}>{teamName(m, 'B')}</span>
                  </div>
                  <div className="past-game-date">
                    {ttFormatLabel(
                      m.format,
                      m.tt_match_players.filter(p => p.side === 'A').length,
                      m.tt_match_players.filter(p => p.side === 'B').length,
                    )} · BO{m.best_of} · {new Date(m.created_at).toLocaleDateString()}
                  </div>
                  <div className={`past-game-badge ${m.exclude_from_overall ? 'past-game-badge-excluded' : 'past-game-badge-included'}`}>
                    {m.exclude_from_overall ? 'Excluded' : 'Included'}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
