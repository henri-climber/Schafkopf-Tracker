import { useNavigate } from 'react-router'
import { useState, useEffect, useMemo } from 'react'
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
import { SportToggle } from '@/shared/sport-mode/SportToggle'
import '@/shared/styles/home.css'
import type { Player as PlayerRow } from '@/shared/supabase/types'
import { useCreateTable, useTables } from '@/features/schafkopf/api/queries'
import { useCreatePlayer, usePlayers } from '@/features/players/api/queries'

/** Only the columns the player list actually selects. */
type Player = Pick<PlayerRow, 'id' | 'name'>

export function HomePage() {
  const navigate = useNavigate()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [tableName, setTableName] = useState('')
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([])
  const [showAddPlayerInput, setShowAddPlayerInput] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFilterIds, setSelectedFilterIds] = useState<number[]>([])

  const { data: activeTablesData, isPending: loading } = useTables({ isOpen: true })
  const activeTables = activeTablesData ?? []

  const playersQuery = usePlayers()
  const loadingPlayers = playersQuery.isPending
  const players: Player[] = useMemo(
    () => [...(playersQuery.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [playersQuery.data],
  )
  const createPlayer = useCreatePlayer()
  const createTableMutation = useCreateTable()

  const filteredPlayers = players.filter((player) =>
    player.name.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  useEffect(() => {
    if (!isDialogOpen) {
      setSearchTerm('')
      setShowAddPlayerInput(false)
      setNewPlayerName('')
    }
  }, [isDialogOpen])

  function toggleFilterPlayer(id: number) {
    setSelectedFilterIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function togglePlayerSelection(playerId: number) {
    setSelectedPlayerIds((prev) =>
      prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId],
    )
  }

  async function handleAddPlayer(e: React.FormEvent) {
    e.preventDefault()
    if (!newPlayerName.trim()) return

    try {
      const player = await createPlayer.mutateAsync(newPlayerName)
      setSelectedPlayerIds((prev) => [...prev, player.id])
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
      const newTable = await createTableMutation.mutateAsync({
        name: tableName.trim(),
        playerIds: selectedPlayerIds,
      })

      setTableName('')
      setSelectedPlayerIds([])
      setIsDialogOpen(false)

      navigate(`/game-details/${newTable.id}`)
    } catch (error) {
      console.error('Error creating table:', error)
      alert('Failed to create table')
    }
  }

  return (
    <div className="home-container">
      {/* Header */}
      <header className="home-header">
        <SportToggle />
        <h1 className="home-title">Schafkopf Tracker</h1>
        <p className="home-subtitle">Track your games and scores</p>
      </header>

      {/* Main Actions */}
      <div className="main-actions">
        <div onClick={() => setIsDialogOpen(true)} className="action-card action-card-green">
          <div className="action-card-icon-wrapper">
            <PlusIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="action-card-title">New Game</h2>
            <p className="action-card-description">Start a new session</p>
          </div>
        </div>

        <div onClick={() => navigate('/leaderboard')} className="action-card action-card-blue">
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

        {(() => {
          const seen = new Set<number>()
          const filterPlayers: Player[] = []
          for (const table of activeTables) {
            for (const tp of table.table_players ?? []) {
              if (!seen.has(tp.player.id)) {
                seen.add(tp.player.id)
                filterPlayers.push(tp.player)
              }
            }
          }
          filterPlayers.sort((a, b) => a.name.localeCompare(b.name))
          return filterPlayers.length > 0 ? (
            <div className="player-filter-bar">
              {filterPlayers.map((player) => (
                <button
                  key={player.id}
                  onClick={() => toggleFilterPlayer(player.id)}
                  className={`player-filter-chip${selectedFilterIds.includes(player.id) ? ' active' : ''}`}
                >
                  {player.name}
                </button>
              ))}
              {selectedFilterIds.length > 0 && (
                <button onClick={() => setSelectedFilterIds([])} className="player-filter-clear">
                  ✕ Zurücksetzen
                </button>
              )}
            </div>
          ) : null
        })()}

        {(() => {
          const displayedTables =
            selectedFilterIds.length === 0
              ? activeTables
              : activeTables.filter((table) =>
                  selectedFilterIds.every((id) =>
                    table.table_players?.some((tp) => tp.player_id === id),
                  ),
                )

          if (loading) {
            return (
              <div className="loading-spinner-wrapper">
                <div className="loading-spinner"></div>
              </div>
            )
          }
          if (activeTables.length === 0) {
            return (
              <div className="empty-state">
                <TableCellsIcon className="empty-state-icon" />
                <p className="empty-state-text">No active games found</p>
                <button onClick={() => setIsDialogOpen(true)} className="empty-state-action">
                  Start a new game
                </button>
              </div>
            )
          }
          if (displayedTables.length === 0) {
            return (
              <div className="empty-state">
                <TableCellsIcon className="empty-state-icon" />
                <p className="empty-state-text">Keine Spiele mit diesen Spielern</p>
                <button onClick={() => setSelectedFilterIds([])} className="empty-state-action">
                  Filter zurücksetzen
                </button>
              </div>
            )
          }
          return (
            <div className="active-games-grid">
              {displayedTables.map((table) => (
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
          )
        })()}
      </div>

      {/* Past Games Floating Button */}
      <button onClick={() => navigate('/past-games')} className="past-games-button">
        <ClockIcon className="w-5 h-5" />
        <span>Past Games</span>
      </button>

      {/* Create Game Dialog */}
      {isDialogOpen && (
        <div className="dialog-overlay">
          <div className="dialog-content animate-in fade-in zoom-in-95 duration-200">
            <div className="dialog-header">
              <h2 className="dialog-title">Start New Game</h2>
              <button onClick={() => setIsDialogOpen(false)} className="dialog-close">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateTable} className="dialog-form">
              <div className="dialog-body">
                <div className="form-field">
                  <label className="form-label">Game Name</label>
                  <input
                    type="text"
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    placeholder="e.g. Friday Night Rounds"
                    className="form-input"
                    autoFocus
                  />
                </div>

                <div className="player-section">
                  <div className="player-section-header">
                    <label className="player-section-label">
                      <UserGroupIcon className="w-4 h-4" />
                      Select Players
                    </label>
                    <span className="player-count-badge">{selectedPlayerIds.length} selected</span>
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
                        filteredPlayers.map((player) => (
                          <div
                            key={player.id}
                            onClick={() => togglePlayerSelection(player.id)}
                            className={`player-item ${selectedPlayerIds.includes(player.id) ? 'selected' : ''}`}
                          >
                            <div
                              className={`w-5 h-5 rounded-md border flex items-center justify-center mr-3 transition-colors ${
                                selectedPlayerIds.includes(player.id)
                                  ? 'bg-blue-600 border-blue-600'
                                  : 'border-gray-300 bg-white'
                              }`}
                            >
                              {selectedPlayerIds.includes(player.id) && (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                  className="w-3.5 h-3.5 text-white"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
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
                <button type="submit" disabled={!tableName.trim()} className="btn-create">
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
