import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router'
import { supabase } from '../../lib/supabase'
import type { TTMatch, TTSet, TTSide } from '../../lib/supabase'
import { matchWinner, setsWon, setsNeeded, isSetDecided } from '../../lib/tt'
import { LockOpenIcon, LockClosedIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import '../GameDetails.css'
import './TTMatchDetails.css'

interface Player {
  id: number
  name: string
}

interface MatchPlayer {
  player_id: number
  side: TTSide
  player: Player
}

export function TTMatchDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [match, setMatch] = useState<TTMatch | null>(null)
  const [matchPlayers, setMatchPlayers] = useState<MatchPlayer[]>([])
  const [sets, setSets] = useState<TTSet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadMatch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: matchData, error: matchError } = await supabase
        .from('tt_matches')
        .select('*')
        .eq('id', id)
        .single()
      if (matchError) throw matchError
      setMatch(matchData)

      const { data: playersData, error: playersError } = (await supabase
        .from('tt_match_players')
        .select('player_id, side, player:Players(id, name)')
        .eq('match_id', id)) as { data: MatchPlayer[] | null; error: unknown }
      if (playersError) throw playersError
      setMatchPlayers(playersData || [])

      const { data: setsData, error: setsError } = await supabase
        .from('tt_sets')
        .select('*')
        .eq('match_id', id)
        .order('set_number', { ascending: true })
      if (setsError) throw setsError
      setSets(setsData || [])
    } catch (err) {
      console.error('Error loading match:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (!id) return
    loadMatch()
  }, [id, loadMatch])

  const teamA = matchPlayers.filter((mp) => mp.side === 'A')
  const teamB = matchPlayers.filter((mp) => mp.side === 'B')
  const teamName = (team: MatchPlayer[]) =>
    team.map((mp) => mp.player?.name ?? `#${mp.player_id}`).join(' & ') || '—'

  const won = setsWon(sets)
  const winner = match ? matchWinner(sets, match.best_of) : null
  const needed = match ? setsNeeded(match.best_of) : 0
  const canAddSet = !!match && match.is_open && winner === null && sets.length < match.best_of

  // Lokale Anzeige aktualisieren + persistieren
  function updateLocalSet(setId: number, field: 'score_a' | 'score_b', value: number) {
    setSets((prev) => prev.map((s) => (s.id === setId ? { ...s, [field]: value } : s)))
  }

  async function persistSet(setId: number, field: 'score_a' | 'score_b', value: number) {
    const { error: err } = await supabase
      .from('tt_sets')
      .update({ [field]: value })
      .eq('id', setId)
    if (err) {
      console.error('Error updating set:', err)
      loadMatch()
    }
  }

  async function handleAddSet() {
    if (!canAddSet || !match) return
    const nextNumber = sets.length + 1
    const { data, error: err } = await supabase
      .from('tt_sets')
      .insert([{ match_id: match.id, set_number: nextNumber, score_a: 0, score_b: 0 }])
      .select()
      .single()
    if (err) {
      console.error('Error adding set:', err)
      return
    }
    setSets((prev) => [...prev, data])
  }

  async function handleDeleteSet(setId: number) {
    if (!match || !match.is_open) return

    const { error: delErr } = await supabase.from('tt_sets').delete().eq('id', setId)
    if (delErr) {
      console.error('Error deleting set:', delErr)
      loadMatch()
      return
    }

    // Verbleibende Saetze fortlaufend neu nummerieren (1..n), damit keine
    // Luecken entstehen (set_number ist unique pro Match).
    const remaining = sets.filter((s) => s.id !== setId)
    for (let i = 0; i < remaining.length; i++) {
      const desired = i + 1
      if (remaining[i].set_number !== desired) {
        const { error: upErr } = await supabase
          .from('tt_sets')
          .update({ set_number: desired })
          .eq('id', remaining[i].id)
        if (upErr) {
          console.error('Error renumbering sets:', upErr)
          loadMatch()
          return
        }
        remaining[i] = { ...remaining[i], set_number: desired }
      }
    }
    setSets(remaining)
  }

  async function handleChangeBestOf(next: number) {
    if (!match) return
    const min = Math.max(1, sets.length) // nicht unter die bereits gespielten Saetze
    const value = Math.max(min, next)
    if (value === match.best_of) return
    setMatch((prev) => (prev ? { ...prev, best_of: value } : null)) // optimistisch
    const { error: err } = await supabase
      .from('tt_matches')
      .update({ best_of: value })
      .eq('id', match.id)
    if (err) {
      console.error('Error updating best_of:', err)
      loadMatch()
    }
  }

  async function handleToggleIsOpen() {
    if (!match) return
    // Schliessen nur erlaubt, wenn es einen Gewinner gibt (Wiederoeffnen immer).
    if (match.is_open && winner === null) return
    const newValue = !match.is_open
    const { error: err } = await supabase
      .from('tt_matches')
      .update({ is_open: newValue })
      .eq('id', match.id)
    if (err) {
      console.error('Error toggling is_open:', err)
      return
    }
    setMatch((prev) => (prev ? { ...prev, is_open: newValue } : null))
  }

  async function handleToggleExclude() {
    if (!match) return
    const newValue = !match.exclude_from_overall
    const { error: err } = await supabase
      .from('tt_matches')
      .update({ exclude_from_overall: newValue })
      .eq('id', match.id)
    if (err) {
      console.error('Error toggling exclude:', err)
      return
    }
    setMatch((prev) => (prev ? { ...prev, exclude_from_overall: newValue } : null))
  }

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )

  if (error || !match)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-red-500">
        Error: {error ?? 'Match not found'}
      </div>
    )

  const title = match.name || `${teamName(teamA)} vs ${teamName(teamB)}`

  return (
    <div className="game-details-container">
      {/* Navbar */}
      <div className="game-navbar">
        <div className="nav-left">
          <button onClick={() => navigate('/')} className="nav-back-button">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </button>
          <div className="nav-title-group">
            <h1 className="game-title">{title}</h1>
            <p className="game-subtitle">
              {new Date(match.created_at).toLocaleDateString()} •{' '}
              {match.format === 'singles' ? 'Einzel' : 'Doppel'} • BO{match.best_of}
            </p>
          </div>
        </div>

        <div className="nav-right">
          <button
            onClick={handleToggleIsOpen}
            disabled={match.is_open && winner === null}
            title={
              match.is_open
                ? winner === null
                  ? 'Schließen erst möglich, wenn ein Satz-Sieger feststeht'
                  : 'Match schließen'
                : 'Match wieder öffnen'
            }
            className={`status-button ${match.is_open ? 'status-button-open' : 'status-button-closed'} disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <span className="status-icon-mobile">
              {match.is_open ? (
                <LockOpenIcon className="w-5 h-5" />
              ) : (
                <LockClosedIcon className="w-5 h-5" />
              )}
            </span>
            <span className="status-label-desktop">{match.is_open ? 'Open' : 'Closed'}</span>
          </button>

          <button
            onClick={handleToggleExclude}
            title={match.exclude_from_overall ? 'Excluded' : 'Included'}
            className={`status-button ${match.exclude_from_overall ? 'status-button-excluded' : 'status-button-included'}`}
          >
            <span className="status-icon-mobile">{match.exclude_from_overall ? '✕' : '✓'}</span>
            <span className="status-label-desktop">
              {match.exclude_from_overall ? 'Excluded' : 'Included'}
            </span>
          </button>
        </div>
      </div>

      <div className="tt-match-content">
        {/* Scoreboard */}
        <div className="tt-scoreboard">
          <div className={`tt-score-team tt-side-a ${winner === 'A' ? 'tt-winner' : ''}`}>
            <span className="tt-score-name">{teamName(teamA)}</span>
            <span className="tt-score-sets">{won.a}</span>
          </div>
          <div className="tt-score-vs">VS</div>
          <div className={`tt-score-team tt-side-b ${winner === 'B' ? 'tt-winner' : ''}`}>
            <span className="tt-score-name">{teamName(teamB)}</span>
            <span className="tt-score-sets">{won.b}</span>
          </div>
        </div>

        {winner && (
          <div className="tt-winner-banner">
            🏆 {winner === 'A' ? teamName(teamA) : teamName(teamB)} gewinnt ({won.a}:{won.b})
            {match.is_open && ' — Match schließen, um es zu werten'}
          </div>
        )}

        {/* Sets */}
        <div className="tt-sets-card">
          <div className="tt-sets-header">
            <span>Sätze · erster auf {needed} gewinnt</span>
            <div className="tt-bestof">
              <span className="tt-bestof-label">Best of</span>
              {match.is_open ? (
                <>
                  <button
                    type="button"
                    className="tt-bestof-btn"
                    onClick={() => handleChangeBestOf(match.best_of - 1)}
                    disabled={match.best_of <= Math.max(1, sets.length)}
                    aria-label="Best of verringern"
                  >
                    −
                  </button>
                  <span className="tt-bestof-value">{match.best_of}</span>
                  <button
                    type="button"
                    className="tt-bestof-btn"
                    onClick={() => handleChangeBestOf(match.best_of + 1)}
                    aria-label="Best of erhöhen"
                  >
                    +
                  </button>
                </>
              ) : (
                <span className="tt-bestof-value">{match.best_of}</span>
              )}
            </div>
          </div>

          {sets.length === 0 ? (
            <div className="tt-sets-empty">Noch keine Sätze. Füge den ersten Satz hinzu.</div>
          ) : (
            <div className="tt-sets-list">
              {sets.map((set) => {
                const decided = isSetDecided(set.score_a, set.score_b)
                const aWonSet = decided && set.score_a > set.score_b
                const bWonSet = decided && set.score_b > set.score_a
                return (
                  <div key={set.id} className="tt-set-row">
                    <span className="tt-set-label">Satz {set.set_number}</span>
                    <div className="tt-set-scores">
                      <span className={`tt-set-tag tt-set-tag-a ${aWonSet ? '' : 'opacity-0'}`}>
                        ✓
                      </span>
                      <input
                        type="number"
                        min={0}
                        className="tt-set-input"
                        value={set.score_a}
                        disabled={!match.is_open}
                        onChange={(e) =>
                          updateLocalSet(set.id, 'score_a', parseInt(e.target.value) || 0)
                        }
                        onBlur={(e) => persistSet(set.id, 'score_a', parseInt(e.target.value) || 0)}
                        onFocus={(e) => e.target.select()}
                      />
                      <span className="tt-set-colon">:</span>
                      <input
                        type="number"
                        min={0}
                        className="tt-set-input tt-set-input-b"
                        value={set.score_b}
                        disabled={!match.is_open}
                        onChange={(e) =>
                          updateLocalSet(set.id, 'score_b', parseInt(e.target.value) || 0)
                        }
                        onBlur={(e) => persistSet(set.id, 'score_b', parseInt(e.target.value) || 0)}
                        onFocus={(e) => e.target.select()}
                      />
                      <span className={`tt-set-tag tt-set-tag-b ${bWonSet ? '' : 'opacity-0'}`}>
                        ✓
                      </span>
                    </div>
                    {match.is_open && (
                      <button
                        type="button"
                        className="tt-set-delete"
                        onClick={() => handleDeleteSet(set.id)}
                        title="Satz löschen"
                        aria-label={`Satz ${set.set_number} löschen`}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {canAddSet && (
            <button onClick={handleAddSet} className="tt-add-set-btn">
              <PlusIcon className="w-5 h-5" /> Satz hinzufügen
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
