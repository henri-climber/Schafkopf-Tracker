import type { Player } from '@/shared/supabase/types'

interface Props {
  searchTerm: string
  onSearchTermChange: (term: string) => void
  candidates: Player[]
  loading: boolean
  onSelect: (playerId: number) => void
  onCancel: () => void
}

/** Search-and-pick dialog for adding a player to an in-progress table. */
export function AddPlayerDialog({
  searchTerm,
  onSearchTermChange,
  candidates,
  loading,
  onSelect,
  onCancel,
}: Props) {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 className="modal-title">Add Player</h2>
        <input
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          placeholder="Search player name..."
          className="modal-search-input"
          autoFocus
        />
        {loading ? (
          <p className="modal-loading">Loading...</p>
        ) : (
          <div className="modal-list-container">
            {candidates.length === 0 && searchTerm && (
              <p className="modal-empty-search">No players found</p>
            )}
            {candidates.map((player) => (
              <button
                key={player.id}
                onClick={() => onSelect(player.id)}
                className="modal-player-btn"
              >
                {player.name}
              </button>
            ))}
          </div>
        )}
        <div className="modal-footer">
          <button onClick={onCancel} className="modal-cancel-btn">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
