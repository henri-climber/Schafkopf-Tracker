import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import './PastGames.css'

interface Player {
  id: number
  name: string
}

interface TablePlayer {
  player_id: number
  player: Player
}

interface Table {
  id: number
  name: string
  created_at: string
  is_open: boolean
  exclude_from_overall: boolean
  table_players?: TablePlayer[]
}

export function PastGames() {
  const navigate = useNavigate()
  const [pastGames, setPastGames] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFilterIds, setSelectedFilterIds] = useState<number[]>([])

  useEffect(() => {
    loadPastGames()
  }, [])

  async function loadPastGames() {
    try {
      const { data, error } = await supabase
        .from('Tables')
        .select('*, table_players(player_id, player:Players(id, name))')
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

  function toggleFilterPlayer(id: number) {
    setSelectedFilterIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const seen = new Set<number>()
  const filterPlayers: Player[] = []
  for (const game of pastGames) {
    for (const tp of game.table_players ?? []) {
      if (!seen.has(tp.player.id)) {
        seen.add(tp.player.id)
        filterPlayers.push(tp.player)
      }
    }
  }
  filterPlayers.sort((a, b) => a.name.localeCompare(b.name))

  const displayedGames = selectedFilterIds.length === 0
    ? pastGames
    : pastGames.filter(game =>
        selectedFilterIds.every(id =>
          game.table_players?.some(tp => tp.player_id === id)
        )
      )

  return (
    <div className="past-games-container">
      <div className="past-games-header">
        <button onClick={() => navigate('/')} className="past-games-back-btn">
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <h1 className="past-games-title">Past Games</h1>
      </div>

      <div className="past-games-content">
        {filterPlayers.length > 0 && (
          <div className="player-filter-bar">
            {filterPlayers.map(player => (
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
        )}

        {loading ? (
          <div className="text-center text-gray-600">Loading...</div>
        ) : pastGames.length === 0 ? (
          <div className="text-center text-gray-600">No past games found</div>
        ) : displayedGames.length === 0 ? (
          <div className="past-games-empty">
            <p>Keine Spiele mit diesen Spielern</p>
            <button onClick={() => setSelectedFilterIds([])} className="past-games-empty-reset">
              Filter zurücksetzen
            </button>
          </div>
        ) : (
          <div className="past-games-list">
            {displayedGames.map((game) => (
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
