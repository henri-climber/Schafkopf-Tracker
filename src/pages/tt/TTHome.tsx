import { useNavigate } from 'react-router'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type { TTFormat, TTSide } from '../../lib/supabase'
import {
  TrophyIcon,
  PlusIcon,
  PlayIcon,
  CalendarIcon,
  UserGroupIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  ArrowRightIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline'
import { SportToggle } from '../../components/SportToggle'
import '../Home.css'

interface Player {
  id: number
  name: string
}

interface MatchPlayer {
  player_id: number
  side: TTSide
  player: Player
}

interface TTMatchRow {
  id: number
  name: string | null
  created_at: string
  format: TTFormat
  best_of: number
  is_open: boolean
  tt_match_players?: MatchPlayer[]
}

const BEST_OF_PRESETS = [1, 3, 5, 7] as const

export function TTHome() {
  const navigate = useNavigate()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [matchName, setMatchName] = useState('')
  const [format, setFormat] = useState<TTFormat>('singles')
  const [bestOf, setBestOf] = useState<number>(3)
  const [sideA, setSideA] = useState<number[]>([])
  const [sideB, setSideB] = useState<number[]>([])
  const [activeTarget, setActiveTarget] = useState<TTSide>('A')

  const [activeMatches, setActiveMatches] = useState<TTMatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [players, setPlayers] = useState<Player[]>([])
  const [loadingPlayers, setLoadingPlayers] = useState(false)
  const [showAddPlayerInput, setShowAddPlayerInput] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [creating, setCreating] = useState(false)

  const perSide = format === 'singles' ? 1 : 2
  const filteredPlayers = players.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()),
  )
  const canCreate = sideA.length === perSide && sideB.length === perSide

  useEffect(() => {
    loadActiveMatches()
  }, [])

  useEffect(() => {
    if (isDialogOpen) {
      loadPlayers()
    } else {
      setSearchTerm('')
      setShowAddPlayerInput(false)
      setNewPlayerName('')
    }
  }, [isDialogOpen])

  // Bei Format-Wechsel ueberzaehlige Spieler abschneiden
  useEffect(() => {
    setSideA((prev) => prev.slice(0, perSide))
    setSideB((prev) => prev.slice(0, perSide))
  }, [perSide])

  async function loadActiveMatches() {
    try {
      const { data, error } = await supabase
        .from('tt_matches')
        .select('*, tt_match_players(player_id, side, player:Players(id, name))')
        .eq('is_open', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setActiveMatches((data as unknown as TTMatchRow[]) || [])
    } catch (error) {
      console.error('Error loading active TT matches:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadPlayers() {
    setLoadingPlayers(true)
    try {
      const { data, error } = await supabase.from('Players').select('id, name').order('name')

      if (error) throw error
      setPlayers(data || [])
    } catch (error) {
      console.error('Error loading players:', error)
    } finally {
      setLoadingPlayers(false)
    }
  }

  function assignPlayer(playerId: number) {
    const inA = sideA.includes(playerId)
    const inB = sideB.includes(playerId)

    // Bereits zugeordnet -> entfernen (Toggle)
    if (inA) {
      setSideA((prev) => prev.filter((id) => id !== playerId))
      return
    }
    if (inB) {
      setSideB((prev) => prev.filter((id) => id !== playerId))
      return
    }

    // Dem aktiven Team hinzufuegen, solange Platz ist
    if (activeTarget === 'A') {
      if (sideA.length >= perSide) return
      setSideA((prev) => [...prev, playerId])
    } else {
      if (sideB.length >= perSide) return
      setSideB((prev) => [...prev, playerId])
    }
  }

  function sideOf(playerId: number): TTSide | null {
    if (sideA.includes(playerId)) return 'A'
    if (sideB.includes(playerId)) return 'B'
    return null
  }

  const playerName = (id: number) => players.find((p) => p.id === id)?.name ?? `#${id}`

  async function handleAddPlayer(e: React.FormEvent) {
    e.preventDefault()
    if (!newPlayerName.trim()) return

    try {
      const { data, error } = await supabase
        .from('Players')
        .insert([{ name: newPlayerName.trim() }])
        .select()
        .single()

      if (error) throw error

      setPlayers((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setNewPlayerName('')
      setShowAddPlayerInput(false)
    } catch (error) {
      console.error('Error adding player:', error)
    }
  }

  async function handleCreateMatch(e: React.FormEvent) {
    e.preventDefault()
    if (!canCreate || creating) return
    setCreating(true)

    try {
      const { data: newMatch, error } = await supabase
        .from('tt_matches')
        .insert([
          {
            name: matchName.trim() || null,
            format,
            best_of: bestOf,
            is_open: true,
            exclude_from_overall: false,
          },
        ])
        .select()
        .single()

      if (error) throw error

      const rows = [
        ...sideA.map((player_id) => ({ match_id: newMatch.id, player_id, side: 'A' as TTSide })),
        ...sideB.map((player_id) => ({ match_id: newMatch.id, player_id, side: 'B' as TTSide })),
      ]
      const { error: playersError } = await supabase.from('tt_match_players').insert(rows)
      if (playersError) throw playersError

      // Reset
      setMatchName('')
      setSideA([])
      setSideB([])
      setIsDialogOpen(false)
      navigate(`/tt/match/${newMatch.id}`)
    } catch (error) {
      console.error('Error creating TT match:', error)
      alert('Failed to create match')
    } finally {
      setCreating(false)
    }
  }

  function sideNames(match: TTMatchRow, side: TTSide): string {
    return (
      (match.tt_match_players ?? [])
        .filter((mp) => mp.side === side)
        .map((mp) => mp.player?.name ?? `#${mp.player_id}`)
        .join(' & ') || '—'
    )
  }

  return (
    <div className="home-container">
      {/* Header */}
      <header className="home-header">
        <SportToggle />
        <h1 className="home-title">Tischtennis Tracker</h1>
        <p className="home-subtitle">Track your matches and Elo</p>
      </header>

      {/* Main Actions */}
      <div className="main-actions">
        <div onClick={() => setIsDialogOpen(true)} className="action-card action-card-green">
          <div className="action-card-icon-wrapper">
            <PlusIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="action-card-title">New Match</h2>
            <p className="action-card-description">Start a new match</p>
          </div>
        </div>

        <div onClick={() => navigate('/tt/leaderboard')} className="action-card action-card-blue">
          <div className="action-card-icon-wrapper">
            <TrophyIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="action-card-title">Leaderboard</h2>
            <p className="action-card-description">View Elo rankings</p>
          </div>
        </div>
      </div>

      {/* Active Matches Section */}
      <div className="active-games-section">
        <div className="section-header">
          <h2 className="section-title">
            <PlayIcon className="w-5 h-5 text-blue-600" />
            Active Matches
          </h2>
        </div>

        {loading ? (
          <div className="loading-spinner-wrapper">
            <div className="loading-spinner"></div>
          </div>
        ) : activeMatches.length === 0 ? (
          <div className="empty-state">
            <TableCellsIcon className="empty-state-icon" />
            <p className="empty-state-text">No active matches found</p>
            <button onClick={() => setIsDialogOpen(true)} className="empty-state-action">
              Start a new match
            </button>
          </div>
        ) : (
          <div className="active-games-grid">
            {activeMatches.map((match) => (
              <div
                key={match.id}
                onClick={() => navigate(`/tt/match/${match.id}`)}
                className="game-card group"
              >
                <div>
                  <div className="game-card-header">
                    <span className="game-card-badge">Active</span>
                    <span className="tt-format-badge">
                      {match.format === 'singles' ? 'Einzel' : 'Doppel'} · BO{match.best_of}
                    </span>
                  </div>
                  {match.name && <div className="game-card-title">{match.name}</div>}
                  <div className="tt-match-teams mt-2">
                    <span className="tt-match-side">{sideNames(match, 'A')}</span>
                    <span className="tt-match-vs">vs</span>
                    <span className="tt-match-side">{sideNames(match, 'B')}</span>
                  </div>
                </div>

                <div className="game-card-footer">
                  <div className="game-card-date">
                    <CalendarIcon className="w-4 h-4" />
                    {new Date(match.created_at).toLocaleDateString()}
                  </div>
                  <div className="game-card-arrow">
                    <ArrowRightIcon className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past Matches Floating Button */}
      <button onClick={() => navigate('/tt/past-matches')} className="past-games-button">
        <ClockIcon className="w-5 h-5" />
        <span>Past Matches</span>
      </button>

      {/* Create Match Dialog */}
      {isDialogOpen && (
        <div className="dialog-overlay">
          <div className="dialog-content animate-in fade-in zoom-in-95 duration-200">
            <div className="dialog-header">
              <h2 className="dialog-title">Start New Match</h2>
              <button onClick={() => setIsDialogOpen(false)} className="dialog-close">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateMatch} className="dialog-form">
              <div className="dialog-body">
                <div className="form-field">
                  <label className="form-label">Match Name (optional)</label>
                  <input
                    type="text"
                    value={matchName}
                    onChange={(e) => setMatchName(e.target.value)}
                    placeholder="e.g. Finale"
                    className="form-input"
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">Format</label>
                  <div className="tt-segment">
                    <button
                      type="button"
                      onClick={() => setFormat('singles')}
                      className={`tt-segment-btn${format === 'singles' ? ' active' : ''}`}
                    >
                      Einzel (1v1)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormat('doubles')}
                      className={`tt-segment-btn${format === 'doubles' ? ' active' : ''}`}
                    >
                      Doppel (2v2)
                    </button>
                  </div>
                </div>

                <div className="form-field">
                  <label className="form-label">
                    Best of — erster auf {Math.floor(bestOf / 2) + 1}{' '}
                    {Math.floor(bestOf / 2) + 1 === 1 ? 'Satz' : 'Sätze'}
                  </label>
                  <div className="tt-stepper">
                    <button
                      type="button"
                      className="tt-stepper-btn"
                      onClick={() => setBestOf((n) => Math.max(1, n - 1))}
                      disabled={bestOf <= 1}
                      aria-label="Weniger Sätze"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      className="tt-stepper-input"
                      value={bestOf}
                      onChange={(e) => setBestOf(Math.max(1, parseInt(e.target.value) || 1))}
                      onFocus={(e) => e.target.select()}
                    />
                    <button
                      type="button"
                      className="tt-stepper-btn"
                      onClick={() => setBestOf((n) => n + 1)}
                      aria-label="Mehr Sätze"
                    >
                      +
                    </button>
                  </div>
                  <div className="tt-presets">
                    {BEST_OF_PRESETS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setBestOf(n)}
                        className={`tt-preset${bestOf === n ? ' active' : ''}`}
                      >
                        BO{n}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="player-section">
                  <div className="player-section-header">
                    <label className="player-section-label">
                      <UserGroupIcon className="w-4 h-4" />
                      Teams ({perSide} pro Seite)
                    </label>
                  </div>

                  {/* Team-Boxen */}
                  <div className="tt-teams">
                    {(['A', 'B'] as TTSide[]).map((side) => {
                      const ids = side === 'A' ? sideA : sideB
                      return (
                        <div
                          key={side}
                          onClick={() => setActiveTarget(side)}
                          className={`tt-team-box${activeTarget === side ? ' active' : ''}`}
                        >
                          <div className="tt-team-title">
                            <span>Team {side}</span>
                            {activeTarget === side && (
                              <span className="tt-team-target">Auswahl</span>
                            )}
                          </div>
                          {ids.length === 0 ? (
                            <span className="tt-team-empty">Spieler wählen…</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {ids.map((id) => (
                                <span key={id} className="tt-chip">
                                  {playerName(id)}
                                  <span
                                    className="tt-chip-remove"
                                    onClick={(ev) => {
                                      ev.stopPropagation()
                                      assignPlayer(id)
                                    }}
                                  >
                                    ×
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div className="player-search-container">
                    <div className="relative">
                      <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search players..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="player-search-input pl-9"
                      />
                    </div>

                    <div className="player-list custom-scrollbar">
                      {loadingPlayers ? (
                        <div className="text-center py-8 text-gray-400 text-sm">
                          Loading players...
                        </div>
                      ) : filteredPlayers.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-sm">
                          <p>No players found</p>
                        </div>
                      ) : (
                        filteredPlayers.map((player) => {
                          const side = sideOf(player.id)
                          return (
                            <div
                              key={player.id}
                              onClick={() => assignPlayer(player.id)}
                              className={`player-item ${side ? 'selected' : ''}`}
                            >
                              <div
                                className={`w-6 h-6 rounded-md border flex items-center justify-center mr-3 transition-colors text-xs font-bold ${
                                  side === 'A'
                                    ? 'bg-blue-600 border-blue-600 text-white'
                                    : side === 'B'
                                      ? 'bg-emerald-600 border-emerald-600 text-white'
                                      : 'border-gray-300 bg-white text-transparent'
                                }`}
                              >
                                {side ?? ''}
                              </div>
                              <span className="player-name">{player.name}</span>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>

                  {!showAddPlayerInput ? (
                    <button
                      type="button"
                      onClick={() => setShowAddPlayerInput(true)}
                      className="btn-add-player-link"
                    >
                      <PlusIcon className="w-4 h-4" /> Add new player
                    </button>
                  ) : (
                    <div className="new-player-wrapper animate-in fade-in slide-in-from-top-2 duration-200">
                      <input
                        type="text"
                        value={newPlayerName}
                        onChange={(e) => setNewPlayerName(e.target.value)}
                        placeholder="New Player Name"
                        className="new-player-input"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddPlayer(e)
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleAddPlayer}
                        disabled={!newPlayerName.trim()}
                        className="btn-new-player"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddPlayerInput(false)
                          setNewPlayerName('')
                        }}
                        className="btn-cancel-player"
                      >
                        <XMarkIcon className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="dialog-footer">
                <button type="button" onClick={() => setIsDialogOpen(false)} className="btn-cancel">
                  Cancel
                </button>
                <button type="submit" disabled={!canCreate || creating} className="btn-create">
                  Create Match
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
