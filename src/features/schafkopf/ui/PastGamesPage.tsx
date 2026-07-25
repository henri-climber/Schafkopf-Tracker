import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import '@/shared/styles/past-games.css'
import type { Player as PlayerRow } from '@/shared/supabase/types'
import { useTables } from '@/features/schafkopf/api/queries'

type Player = Pick<PlayerRow, 'id' | 'name'>

export function PastGamesPage() {
  const navigate = useNavigate()
  const [selectedFilterIds, setSelectedFilterIds] = useState<number[]>([])

  const { data: pastGamesData, isPending: loading } = useTables({ isOpen: false })
  const pastGames = pastGamesData ?? []

  function toggleFilterPlayer(id: number) {
    setSelectedFilterIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
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

  const displayedGames =
    selectedFilterIds.length === 0
      ? pastGames
      : pastGames.filter((game) =>
          selectedFilterIds.every((id) => game.table_players?.some((tp) => tp.player_id === id)),
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
                <div
                  className={`past-game-badge ${
                    game.exclude_from_overall
                      ? 'past-game-badge-excluded'
                      : 'past-game-badge-included'
                  }`}
                >
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
