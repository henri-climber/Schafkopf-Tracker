import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface Table {
  id: number
  name: string
  created_at: string
  is_open: boolean
  exclude_from_overall: boolean
}

export function PastGames() {
  const navigate = useNavigate()
  const [pastGames, setPastGames] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPastGames()
  }, [])

  async function loadPastGames() {
    try {
      const { data, error } = await supabase
        .from('Tables')
        .select('*')
        .eq('is_open', false)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPastGames(data || [])
    } catch (error) {
      console.error('Error loading past games:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-white text-black">
      <div className="p-4 border-b">
        <h1 className="text-2xl font-bold text-center">Past Games</h1>
      </div>

      <div className="flex-1 p-4">
        {loading ? (
          <div className="text-center text-gray-600">Loading...</div>
        ) : pastGames.length === 0 ? (
          <div className="text-center text-gray-600">No past games found</div>
        ) : (
          <div className="max-w-md mx-auto space-y-3">
            {pastGames.map((game) => (
              <button
                key={game.id}
                onClick={() => navigate(`/game-details/${game.id}`)}
                style={{ backgroundColor: '#1F1F1F' }}
                className="w-full p-4 text-left rounded-lg hover:opacity-90 transition-opacity relative"
              >
                <div className="font-medium text-white">{game.name}</div>
                <div className="text-sm text-gray-400">
                  Played on {new Date(game.created_at).toLocaleDateString()}
                </div>
                <div className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium ${
                  game.exclude_from_overall 
                    ? 'bg-yellow-600 text-white' 
                    : 'bg-green-600 text-white'
                }`}>
                  {game.exclude_from_overall ? 'Excluded' : 'Included'}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 