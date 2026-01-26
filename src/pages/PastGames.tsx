import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './PastGames.css'

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
    <div className="past-games-container">
      <div className="past-games-header">
        <h1 className="past-games-title">Past Games</h1>
      </div>

      <div className="past-games-content">
        {loading ? (
          <div className="text-center text-gray-600">Loading...</div>
        ) : pastGames.length === 0 ? (
          <div className="text-center text-gray-600">No past games found</div>
        ) : (
          <div className="past-games-list">
            {pastGames.map((game) => (
              <button
                key={game.id}
                onClick={() => navigate(`/game-details/${game.id}`)}
                className="past-game-card"
              >
                <div className="past-game-name">{game.name}</div>
                <div className="past-game-date">
                  Played on {new Date(game.created_at).toLocaleDateString()}
                </div>
                <div className={`past-game-badge ${game.exclude_from_overall
                    ? 'past-game-badge-excluded'
                    : 'past-game-badge-included'
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