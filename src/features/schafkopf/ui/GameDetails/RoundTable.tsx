import { useMemo } from 'react'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import type { Player } from '@/shared/supabase/types'
import { roundSum } from '@/features/schafkopf/domain/scoring'
import { ScoreDisplay } from './ScoreCell'
import { PlayerTotal } from './PlayerTotal'
import { RoundSummary } from './RoundSummary'
import type { RoundRow } from './types'

interface Props {
  rows: RoundRow[]
  players: Player[]
  playerTotals: Record<number, number>
  isOpen: boolean
  onOpenRound: (roundId: number) => void
  onAddRound: () => void
}

/** The desktop score sheet. Clicking a round opens it in the round editor. */
export function RoundTable({
  rows,
  players,
  playerTotals,
  isOpen,
  onOpenRound,
  onAddRound,
}: Props) {
  const columnHelper = useMemo(() => createColumnHelper<RoundRow>(), [])
  // Games recorded before game modes existed look exactly as they always did.
  const showGameColumn = rows.some((row) => row.round.game_mode != null)

  const columns = useMemo(() => {
    const roundNumberColumn = columnHelper.accessor('roundNumber', {
      header: '#',
      cell: (info) => {
        const sum = roundSum(info.row.original.scores)
        const isInvalid = sum !== 0
        return (
          <div className="round-number-cell">
            <span className={`round-number-text ${isInvalid ? 'round-number-invalid' : ''}`}>
              {info.getValue()}
            </span>
            {isInvalid && (
              <span title={`Sum is ${sum} (should be 0)`} className="round-error-icon">
                !
              </span>
            )}
          </div>
        )
      },
      size: 50,
    })

    const gameColumn = columnHelper.display({
      id: 'game',
      header: () => <span className="game-column-header">Spiel</span>,
      cell: (info) => (
        <div className="game-column-cell">
          <RoundSummary row={info.row.original} players={players} />
        </div>
      ),
    })

    const playerColumns = players.map((player) =>
      columnHelper.accessor((row) => row.scores[player.id], {
        id: `player_${player.id}`,
        header: () => (
          <div className="player-header">
            <span className="player-name">{player.name}</span>
            <PlayerTotal total={playerTotals[player.id]} className="player-total-badge" />
          </div>
        ),
        cell: (info) => (
          <div className="score-cell">
            <ScoreDisplay
              score={info.getValue() ?? 0}
              role={info.row.original.roles[player.id] ?? null}
            />
          </div>
        ),
      }),
    )

    return showGameColumn
      ? [roundNumberColumn, gameColumn, ...playerColumns]
      : [roundNumberColumn, ...playerColumns]
  }, [players, playerTotals, columnHelper, showGameColumn])

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="score-table-container">
      <div className="score-table-wrapper">
        <table className="score-table">
          <thead className="table-header">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="table-th">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="table-body">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={isOpen ? () => onOpenRound(row.original.roundId) : undefined}
                className={`table-row ${isOpen ? 'table-row-editable' : ''} ${
                  roundSum(row.original.scores) !== 0 ? 'table-row-invalid' : ''
                }`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="table-td">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <div className="empty-state">
          <p>No rounds played yet.</p>
          {isOpen && (
            <button onClick={onAddRound} className="empty-state-btn">
              Start the game
            </button>
          )}
        </div>
      )}
    </div>
  )
}
