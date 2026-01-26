import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
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
  TableCellsIcon
} from '@heroicons/react/24/outline'
import './Home.css'

interface Table {
  id: number
  name: string
  created_at: string
  is_open: boolean
  exclude_from_overall: boolean
}

interface Player {
  id: number
  name: string
}

export function Home() {
  const navigate = useNavigate()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [tableName, setTableName] = useState('')
  const [activeTables, setActiveTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [players, setPlayers] = useState<Player[]>([])
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([])
  const [loadingPlayers, setLoadingPlayers] = useState(false)
  const [showAddPlayerInput, setShowAddPlayerInput] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const filteredPlayers = players.filter(player =>
    player.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  useEffect(() => {
    loadActiveTables()
  }, [])

  useEffect(() => {
    if (isDialogOpen) {
      loadPlayers()
    }
  }, [isDialogOpen])

  async function loadActiveTables() {
    try {
      const { data, error } = await supabase
        .from('Tables')
        .select('*')
        .eq('is_open', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setActiveTables(data || [])
    } catch (error) {
      console.error('Error loading active tables:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadPlayers() {
    setLoadingPlayers(true)
    try {
      const { data, error } = await supabase
        .from('Players')
        .select('id, name')
        .order('name')

      if (error) throw error
      setPlayers(data || [])
    } catch (error) {
      console.error('Error loading players:', error)
    } finally {
      setLoadingPlayers(false)
    }
  }

  function togglePlayerSelection(playerId: number) {
    setSelectedPlayerIds(prev =>
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    )
  }

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

      setPlayers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setSelectedPlayerIds(prev => [...prev, data.id]) // Auto-select new player
      setNewPlayerName('')
      setShowAddPlayerInput(false)
    } catch (error) {
      console.error('Error adding player:', error)
    }
  }

  async function handleCreateTable(e: React.FormEvent) {
    e.preventDefault()
    if (!tableName.trim()) return

    try {
      const { data: newTable, error } = await supabase
        .from('Tables')
        .insert([{
          name: tableName.trim(),
          is_open: true,
          exclude_from_overall: false
        }])
        .select()
        .single()

      if (error) throw error

      if (selectedPlayerIds.length > 0 && newTable) {
        const { error: playersError } = await supabase
          .from('table_players')
          .insert(selectedPlayerIds.map(playerId => ({
            table_id: newTable.id,
            player_id: playerId
          })))

        if (playersError) throw playersError
      }

      setTableName('')
      setSelectedPlayerIds([])
      setIsDialogOpen(false)
      loadActiveTables()

      if (newTable) {
        navigate(`/game-details/${newTable.id}`)
      }
    } catch (error) {
      console.error('Error creating table:', error)
      alert('Failed to create table')
    }
  }

  return (
    <div className="home-container">
      {/* Header */}
      <header className="home-header">
        <h1 className="home-title">
          Schafkopf Tracker
        </h1>
        <p className="home-subtitle">Track your games and scores</p>
      </header>

      {/* Main Actions */}
      <div className="main-actions">
        <div
          onClick={() => setIsDialogOpen(true)}
          className="action-card action-card-green"
        >
          <div className="action-card-icon-wrapper">
            <PlusIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="action-card-title">New Game</h2>
            <p className="action-card-description">Start a new session</p>
          </div>
        </div>

        <div
          onClick={() => navigate('/leaderboard')}
          className="action-card action-card-blue"
        >
          <div className="action-card-icon-wrapper">
            <TrophyIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="action-card-title">Leaderboard</h2>
            <p className="action-card-description">View active rankings</p>
          </div>
        </div>
      </div>

      {/* Active Games Section */}
      <div className="active-games-section">
        <div className="section-header">
          <h2 className="section-title">
            <PlayIcon className="w-5 h-5 text-blue-600" />
            Active Games
          </h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : activeTables.length === 0 ? (
          <div className="empty-state">
            <TableCellsIcon className="empty-state-icon" />
            <p className="empty-state-text">No active games found</p>
            <button
              onClick={() => setIsDialogOpen(true)}
              className="mt-4 text-blue-600 font-medium hover:underline"
            >
              Start a new game
            </button>
          </div>
        ) : (
          <div className="active-games-grid">
            {activeTables.map((table) => (
              <div
                key={table.id}
                onClick={() => navigate(`/game-details/${table.id}`)}
                className="game-card group"
              >
                <div>
                  <div className="game-card-header">
                    <span className="game-card-badge">Active</span>
                  </div>
                  <div className="game-card-title">{table.name}</div>
                </div>

                <div className="game-card-footer">
                  <div className="game-card-date">
                    <CalendarIcon className="w-4 h-4" />
                    {new Date(table.created_at).toLocaleDateString()}
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

      {/* Past Games Floating Button */}
      <button
        onClick={() => navigate('/past-games')}
        className="past-games-button"
      >
        <ClockIcon className="w-5 h-5" />
        <span>Past Games</span>
      </button>

      {/* Create Game Dialog */}
      {isDialogOpen && (
        <div className="dialog-overlay">
          <div className="dialog-content animate-in fade-in zoom-in-95 duration-200">
            <div className="dialog-header">
              <h2 className="dialog-title">Start New Game</h2>
              <button
                onClick={() => setIsDialogOpen(false)}
                className="dialog-close"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateTable} className="flex flex-col flex-1 overflow-hidden">
              <div className="dialog-body">
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Game Name
                  </label>
                  <input
                    type="text"
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    placeholder="e.g. Friday Night Rounds"
                    className="form-input"
                    autoFocus
                  />
                </div>

                <div className="flex flex-col h-[300px]">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <UserGroupIcon className="w-4 h-4" />
                      Select Players
                    </label>
                    <span className="text-xs font-medium px-2 py-1 bg-blue-50 text-blue-700 rounded-full">
                      {selectedPlayerIds.length} selected
                    </span>
                  </div>

                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex flex-col flex-1 overflow-hidden">
                    <div className="relative mb-2">
                      <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
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
                        <div className="text-center py-8 text-gray-400 text-sm">Loading players...</div>
                      ) : filteredPlayers.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-sm">
                          <p>No players found</p>
                        </div>
                      ) : (
                        filteredPlayers.map((player) => (
                          <div
                            key={player.id}
                            onClick={() => togglePlayerSelection(player.id)}
                            className={`player-item ${selectedPlayerIds.includes(player.id) ? 'selected' : ''}`}
                          >
                            <div className={`w-5 h-5 rounded-md border flex items-center justify-center mr-3 transition-colors ${selectedPlayerIds.includes(player.id)
                              ? 'bg-blue-600 border-blue-600'
                              : 'border-gray-300 bg-white'
                              }`}>
                              {selectedPlayerIds.includes(player.id) && (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-white">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <span className="player-name">{player.name}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {!showAddPlayerInput ? (
                    <button
                      type="button"
                      onClick={() => setShowAddPlayerInput(true)}
                      className="mt-3 text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1 self-start ml-1"
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
                        className="p-2 text-gray-400 hover:text-gray-600"
                      >
                        <XMarkIcon className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="dialog-footer">
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                  className="btn-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!tableName.trim()}
                  className="btn-create"
                >
                  Create Game
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}