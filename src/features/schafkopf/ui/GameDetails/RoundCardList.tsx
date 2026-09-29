import type { RefObject } from 'react'
import { PencilSquareIcon } from '@heroicons/react/24/outline'
import type { Player } from '@/shared/supabase/types'
import { roundSum } from '@/features/schafkopf/domain/scoring'
import { ScoreDisplay } from './ScoreCell'
import { RoundSummary } from './RoundSummary'
import type { RoundRow } from './types'

interface Props {
  rows: RoundRow[]
  players: Player[]
  onOpenRound: (roundId: number) => void
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
  onOpenRound,
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
          {isOpen && (
            <button onClick={onAddRound} className="empty-state-btn">
              Start the game
            </button>
          )}
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
                <div className="round-card-title">
                  <span className={`round-card-number ${isInvalid ? 'round-number-invalid' : ''}`}>
                    Runde {row.roundNumber}
                  </span>
                  <RoundSummary row={row} players={players} />
                </div>
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
                      <div className="score-cell">
                        <ScoreDisplay
                          score={row.scores[player.id] ?? 0}
                          role={row.roles[player.id] ?? null}
                        />
                      </div>
                    </div>
                  ))}
                  {isOpen && (
                    <button
                      type="button"
                      className="round-card-edit"
                      onClick={() => onOpenRound(row.roundId)}
                    >
                      <PencilSquareIcon className="w-4 h-4" />
                      Bearbeiten
                    </button>
                  )}
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
