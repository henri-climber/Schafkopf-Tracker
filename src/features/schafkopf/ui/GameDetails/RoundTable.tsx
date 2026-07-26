import { useMemo } from 'react'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import type { Player } from '@/shared/supabase/types'
import { roundSum } from '@/features/schafkopf/domain/scoring'
import { ScoreCell } from './ScoreCell'
import { PlayerTotal } from './PlayerTotal'
import type { EditingCell, RoundRow } from './types'

interface Props {
  rows: RoundRow[]
  players: Player[]
  playerTotals: Record<number, number>
  editingCell: EditingCell | null
  onEditCell: (cell: EditingCell | null) => void
  onScoreUpdate: (roundId: number, playerId: number, score: number) => void
  onAddRound: () => void
}

/** The desktop score sheet. */
export function RoundTable({
  rows,
  players,
  playerTotals,
  editingCell,
  onEditCell,
  onScoreUpdate,
  onAddRound,
}: Props) {
  const columnHelper = useMemo(() => createColumnHelper<RoundRow>(), [])

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

    const playerColumns = players.map((player) =>
      columnHelper.accessor((row) => row.scores[player.id], {
        id: `player_${player.id}`,
        header: () => (
          <div className="player-header">
            <span className="player-name">{player.name}</span>
            <PlayerTotal total={playerTotals[player.id]} className="player-total-badge" />
          </div>
        ),
        cell: (info) => {
          const roundId = info.row.original.roundId
          return (
            <ScoreCell
              score={info.getValue() ?? 0}
              isEditing={editingCell?.roundId === roundId && editingCell?.playerId === player.id}
              onStartEdit={() => onEditCell({ roundId, playerId: player.id })}
              onCommit={(value) => onScoreUpdate(roundId, player.id, value)}
              onFinish={() => onEditCell(null)}
              onTabNavigate={(direction) => {
                const next = players.findIndex((p) => p.id === player.id) + direction
                if (next < 0 || next >= players.length) return false
                onEditCell({ roundId, playerId: players[next].id })
                return true
              }}
            />
          )
        },
      }),
    )

    return [roundNumberColumn, ...playerColumns]
  }, [players, playerTotals, editingCell, columnHelper, onEditCell, onScoreUpdate])

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
                className={`table-row ${roundSum(row.original.scores) !== 0 ? 'table-row-invalid' : ''}`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="table-td">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            <tr></tr>
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <div className="empty-state">
          <p>No rounds played yet.</p>
          <button onClick={onAddRound} className="empty-state-btn">
            Start the game
          </button>
        </div>
      )}
    </div>
  )
}
