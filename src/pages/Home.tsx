import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

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
    <div className="min-h-screen flex flex-col items-center bg-white text-black">
      {/* Header */}
      <div className="w-full max-w-md text-center py-8">
        <h1 className="text-4xl font-bold">
          Schafkopf Tracker
        </h1>
      </div>

      {/* Main Actions */}
      <div className="w-full max-w-md flex flex-col gap-4 px-4">
        <button
          onClick={() => navigate('/leaderboard')}
          style={{ backgroundColor: '#3B82F6' }}
          className="w-full p-4 text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          Leaderboard
        </button>
        <button
          onClick={() => setIsDialogOpen(true)}
          style={{ backgroundColor: '#22C55E' }}
          className="w-full p-4 text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          Create Game
        </button>
      </div>

      {/* Active Games Section */}
      <div className="w-full max-w-md mt-12 px-4">
        <h2 className="text-2xl font-semibold mb-4 text-center">
          Active Games
        </h2>
        {loading ? (
          <div className="text-center text-gray-600">Loading...</div>
        ) : activeTables.length === 0 ? (
          <div className="text-center text-gray-600">No active games</div>
        ) : (
          <div className="space-y-3">
            {activeTables.map((table) => (
              <button
                key={table.id}
                onClick={() => navigate(`/game-details/${table.id}`)}
                style={{ backgroundColor: '#1F1F1F' }}
                className="w-full p-4 text-left rounded-lg hover:opacity-90 transition-opacity"
              >
                <div className="font-medium text-white">{table.name}</div>
                <div className="text-sm text-gray-400">
                  Created {new Date(table.created_at).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create Game Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Start New Game</h2>

            <form onSubmit={handleCreateTable} className="flex-1 overflow-hidden flex flex-col">
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Game Name</label>
                <input
                  type="text"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  placeholder="e.g. Monday Night Schafkopf"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                  autoFocus
                />
              </div>

              <div className="mb-6 flex-1 overflow-hidden flex flex-col">
                <div className="flex flex-col gap-2 mb-3">
                  <div className="flex justify-between items-center">
                    <label className="block text-sm font-medium text-gray-700">Select Players</label>
                    <span className={`text-sm ${selectedPlayerIds.includes(players.find(p => p.id === selectedPlayerIds[0])?.id || -1) ? 'text-green-600' : 'text-gray-500'}`}>
                      {selectedPlayerIds.length} selected
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Search players..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAddPlayerInput(!showAddPlayerInput)}
                      className="px-3 py-2 text-sm text-green-600 font-medium border border-green-600 rounded-lg hover:bg-green-50 transition-colors whitespace-nowrap"
                    >
                      + New
                    </button>
                  </div>
                </div>

                {showAddPlayerInput && (
                  <div className="flex gap-2 mb-3 bg-green-50 p-3 rounded-lg border border-green-100">
                    <input
                      type="text"
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                      placeholder="New Player Name"
                      className="flex-1 px-3 py-2 border rounded-lg text-sm"
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
                      className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                )}

                <div className="border border-gray-200 rounded-lg overflow-y-auto flex-1 p-2 space-y-1 bg-gray-50 min-h-[150px] max-h-[300px]">
                  {loadingPlayers ? (
                    <div className="text-center py-4 text-gray-500">Loading players...</div>
                  ) : filteredPlayers.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>No players found.</p>
                      {searchTerm && (
                        <p className="text-xs mt-1">Try adding a new player.</p>
                      )}
                    </div>
                  ) : (
                    filteredPlayers.map((player) => (
                      <label
                        key={player.id}
                        className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${selectedPlayerIds.includes(player.id)
                          ? 'bg-green-50 border-green-200 border'
                          : 'hover:bg-white border border-transparent'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPlayerIds.includes(player.id)}
                          onChange={() => togglePlayerSelection(player.id)}
                          className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500 accent-green-600 bg-white mr-3"
                        />
                        <span className="font-medium text-gray-800">{player.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setIsDialogOpen(false)
                    setTableName('')
                    setSelectedPlayerIds([])
                  }}
                  className="px-6 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!tableName.trim() || selectedPlayerIds.length === 0}
                  className="px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  Create Game
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer - Past Games Button */}
      <div className="w-full max-w-md px-4 py-8 mt-auto fixed bottom-0 bg-white">
        <button
          onClick={() => navigate('/past-games')}
          style={{ backgroundColor: '#1F2937' }}
          className="w-full p-4 text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          Past Games
        </button>
      </div>
    </div>
  )
} 