import type { RefObject } from 'react'
import type { Player } from '@/shared/supabase/types'
import { roundSum } from '@/features/schafkopf/domain/scoring'
import { ScoreCell } from './ScoreCell'
import type { EditingCell, RoundRow } from './types'

interface Props {
  rows: RoundRow[]
  players: Player[]
  editingCell: EditingCell | null
  onEditCell: (cell: EditingCell | null) => void
  onScoreUpdate: (roundId: number, playerId: number, score: number) => void
  onAddRound: () => void
  expandedRoundId: number | null
  onToggleRound: (roundId: number | null) => void
  isOpen: boolean
  bottomRef: RefObject<HTMLDivElement | null>
}

/** The mobile score sheet: one expandable card per round. */
export function RoundCardList({
  rows,
  players,
  editingCell,
  onEditCell,
  onScoreUpdate,
  onAddRound,
  expandedRoundId,
  onToggleRound,
  isOpen,
  bottomRef,
}: Props) {
  return (
    <div className="card-view-container">
      {rows.length === 0 ? (
        <div className="empty-state">
          <p>No rounds played yet.</p>
          <button onClick={onAddRound} className="empty-state-btn">
            Start the game
          </button>
        </div>
      ) : (
        rows.map((row) => {
          const sum = roundSum(row.scores)
          const isInvalid = sum !== 0
          const isExpanded = expandedRoundId === row.roundId

          return (
            <div
              key={row.roundId}
              className={`round-card ${isInvalid ? 'round-card-invalid' : ''}`}
            >
              <div
                className="round-card-header"
                onClick={() => onToggleRound(isExpanded ? null : row.roundId)}
              >
                <span className={`round-card-number ${isInvalid ? 'round-number-invalid' : ''}`}>
                  Runde {row.roundNumber}
                </span>
                <div className="round-card-header-right">
                  {isInvalid && (
                    <span className="round-error-icon" title={`Sum is ${sum} (should be 0)`}>
                      !
                    </span>
                  )}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`round-card-chevron ${isExpanded ? 'round-card-chevron-open' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
              <div className={`round-card-body ${isExpanded ? 'round-card-body-open' : ''}`}>
                <div className="round-card-scores">
                  {players.map((player) => (
                    <div key={player.id} className="round-card-score-row">
                      <span className="round-card-player-name">{player.name}</span>
                      <ScoreCell
                        score={row.scores[player.id] ?? 0}
                        isEditing={
                          editingCell?.roundId === row.roundId &&
                          editingCell?.playerId === player.id
                        }
                        onStartEdit={() =>
                          onEditCell({ roundId: row.roundId, playerId: player.id })
                        }
                        onCommit={(value) => onScoreUpdate(row.roundId, player.id, value)}
                        onFinish={() => onEditCell(null)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })
      )}
      {isOpen && (
        <button onClick={onAddRound} className="btn-add-round-mobile">
          <span className="text-2xl leading-none">+</span>
        </button>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
