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

export function Home() {
  const navigate = useNavigate()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [tableName, setTableName] = useState('')
  const [activeTables, setActiveTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadActiveTables()
  }, [])

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

  async function handleCreateTable(e: React.FormEvent) {
    e.preventDefault()
    if (!tableName.trim()) return

    try {
      const { error } = await supabase
        .from('Tables')
        .insert([{ 
          name: tableName.trim(),
          is_open: true,
          exclude_from_overall: false
        }])

      if (error) throw error

      setTableName('')
      setIsDialogOpen(false)
      loadActiveTables() // Reload the tables after creating a new one
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h2 className="text-xl font-semibold mb-4">Create New Game</h2>
            <form onSubmit={handleCreateTable}>
              <input
                type="text"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="Enter table name"
                className="w-full px-3 py-2 border rounded-lg mb-4 text-black"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsDialogOpen(false)
                    setTableName('')
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: '#22C55E' }}
                  className="px-4 py-2 text-white rounded-lg hover:opacity-90 transition-opacity"
                >
                  Create
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