import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LockOpenIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import { useTableRealtime } from '@/features/schafkopf/api/useTableRealtime'
import { schafkopfKeys } from '@/features/schafkopf/api/queries'
import {
  addPlayerToTable,
  addRound,
  getTableDetail,
  listRounds,
  upsertScore,
} from '@/features/schafkopf/api/rounds'
import { setTableFlags } from '@/features/schafkopf/api/tables'
import { searchPlayers } from '@/features/players/api/players'
import { useMediaQuery } from '@/shared/ui/useMediaQuery'
import type { Player } from '@/shared/supabase/types'
import '@/shared/styles/game-details.css'
import { RoundTable } from './GameDetails/RoundTable'
import { RoundCardList } from './GameDetails/RoundCardList'
import { AddPlayerDialog } from './GameDetails/AddPlayerDialog'
import { PlayerTotal } from './GameDetails/PlayerTotal'
import type { EditingCell, RoundRow } from './GameDetails/types'

export function GameDetailsPage() {
  const { id } = useParams<{ id: string }>()
  // The route param is a string; the id columns are bigint. PostgREST coerced
  // this silently before the client was typed — now it is explicit.
  const tableId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  /**
   * Matches the 820px breakpoint in game-details.css. The two score sheets are
   * mutually exclusive views of the same state, so only one may be mounted:
   * both render an autoFocus input for the cell being edited, and a hidden one
   * still takes focus.
   */
  const isDesktop = useMediaQuery('(min-width: 821px)')

  const [isAddingPlayer, setIsAddingPlayer] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [candidates, setCandidates] = useState<Player[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const [expandedRoundId, setExpandedRoundId] = useState<number | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)

  const detailQuery = useQuery({
    queryKey: schafkopfKeys.table(tableId),
    queryFn: () => getTableDetail(tableId),
    enabled: Number.isFinite(tableId),
  })
  const roundsQuery = useQuery({
    queryKey: schafkopfKeys.rounds(tableId),
    queryFn: () => listRounds(tableId),
    enabled: Number.isFinite(tableId),
  })

  useTableRealtime(tableId)

  const gameTable = detailQuery.data?.table ?? null
  const players = useMemo(() => detailQuery.data?.players ?? [], [detailQuery.data])
  const rounds = useMemo(() => roundsQuery.data?.rounds ?? [], [roundsQuery.data])
  const roundScores = useMemo(() => roundsQuery.data?.scores ?? [], [roundsQuery.data])
  const loading = detailQuery.isPending || roundsQuery.isPending
  const error = detailQuery.error ?? roundsQuery.error

  const refreshRounds = useCallback(
    () => queryClient.invalidateQueries({ queryKey: schafkopfKeys.rounds(tableId) }),
    [queryClient, tableId],
  )
  const refreshTable = useCallback(
    () => queryClient.invalidateQueries({ queryKey: schafkopfKeys.table(tableId) }),
    [queryClient, tableId],
  )

  // Scroll to bottom when rounds change
  useEffect(() => {
    if (rounds.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [rounds.length])

  // Crossing the breakpoint swaps which sheet is mounted, and an unmounting
  // input never fires blur. Close the editor rather than reopening it, focused,
  // in the other view.
  useEffect(() => {
    setEditingCell(null)
  }, [isDesktop])

  const rows: RoundRow[] = useMemo(
    () =>
      rounds.map((round) => {
        const row: RoundRow = { roundNumber: round.round_number, roundId: round.id, scores: {} }
        for (const score of roundScores) {
          if (score.round_id === round.id) row.scores[score.player_id] = score.raw_score
        }
        return row
      }),
    [rounds, roundScores],
  )

  const playerTotals = useMemo(() => {
    const totals: Record<number, number> = {}
    players.forEach((player) => (totals[player.id] = 0))
    roundScores.forEach((score) => {
      if (totals[score.player_id] !== undefined) totals[score.player_id] += score.raw_score
    })
    return totals
  }, [players, roundScores])

  const handleScoreUpdate = useCallback(
    async (roundId: number, playerId: number, newScore: number) => {
      try {
        await upsertScore(roundId, playerId, newScore)
        await refreshRounds()
      } catch (err) {
        console.error('Error updating score:', err)
      }
    },
    [refreshRounds],
  )

  const handleAddRound = useCallback(async () => {
    try {
      const round = await addRound({
        tableId,
        roundNumber: rounds.length + 1,
        playerIds: players.map((p) => p.id),
      })
      await refreshRounds()
      setExpandedRoundId(round.id)
    } catch (err) {
      console.error('Error adding round:', err)
    }
  }, [tableId, rounds.length, players, refreshRounds])

  const handleToggleIsOpen = async () => {
    if (!gameTable) return
    try {
      await setTableFlags(tableId, { is_open: !gameTable.is_open })
      await refreshTable()
    } catch (err) {
      console.error('Error toggling is_open:', err)
    }
  }

  const handleToggleExcludeFromOverall = async () => {
    if (!gameTable) return
    try {
      await setTableFlags(tableId, { exclude_from_overall: !gameTable.exclude_from_overall })
      await refreshTable()
    } catch (err) {
      console.error('Error toggling exclude_from_overall:', err)
    }
  }

  const handleAddPlayerToGame = async (playerId: number) => {
    try {
      await addPlayerToTable(
        tableId,
        playerId,
        rounds.map((r) => r.id),
      )
      await Promise.all([refreshTable(), refreshRounds()])
      setIsAddingPlayer(false)
      setSearchTerm('')
    } catch (err) {
      console.error('Failed to add player:', err)
    }
  }

  const runSearch = async (term: string) => {
    setSearchLoading(true)
    try {
      const found = await searchPlayers(term)
      setCandidates(found.filter((p) => !players.some((existing) => existing.id === p.id)))
    } catch (err) {
      console.error('Error searching players:', err)
    } finally {
      setSearchLoading(false)
    }
  }

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )

  if (error)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-red-500">
        Error: {error instanceof Error ? error.message : 'Failed to load the game'}
      </div>
    )

  return (
    <div className="game-details-container">
      <div className="game-navbar">
        <div className="nav-left">
          <button onClick={() => navigate('/')} className="nav-back-button">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </button>
          <div className="nav-title-group">
            <h1 className="game-title">{gameTable?.name}</h1>
            <p className="game-subtitle">
              {new Date(gameTable?.created_at || '').toLocaleDateString()} • {rounds.length} Rounds
            </p>
          </div>
        </div>

        <div className="nav-right">
          <button
            onClick={handleToggleIsOpen}
            title={gameTable?.is_open ? 'Open' : 'Closed'}
            className={`status-button ${
              gameTable?.is_open ? 'status-button-open' : 'status-button-closed'
            }`}
          >
            <span className="status-icon-mobile">
              {gameTable?.is_open ? (
                <LockOpenIcon className="w-5 h-5" />
              ) : (
                <LockClosedIcon className="w-5 h-5" />
              )}
            </span>
            <span className="status-label-desktop">{gameTable?.is_open ? 'Open' : 'Closed'}</span>
          </button>

          <button
            onClick={handleToggleExcludeFromOverall}
            title={gameTable?.exclude_from_overall ? 'Excluded' : 'Included'}
            className={`status-button ${
              gameTable?.exclude_from_overall ? 'status-button-excluded' : 'status-button-included'
            }`}
          >
            <span className="status-icon-mobile">
              {gameTable?.exclude_from_overall ? '✕' : '✓'}
            </span>
            <span className="status-label-desktop">
              {gameTable?.exclude_from_overall ? 'Excluded' : 'Included'}
            </span>
          </button>

          <button
            onClick={() => {
              setIsAddingPlayer(true)
              runSearch('')
            }}
            className="btn-add-player-nav"
          >
            <span className="min-[640px]:hidden">+P</span>
            <span className="hidden min-[640px]:inline">Add Player</span>
          </button>

          {gameTable?.is_open && (
            <button onClick={handleAddRound} className="btn-add-round">
              <span className="text-xl leading-none">+</span> Round
            </button>
          )}
        </div>
      </div>

      {/* Mobile-only sticky totals bar */}
      <div className="mobile-totals-bar">
        {players.map((player) => (
          <div key={player.id} className="mobile-totals-item">
            <span className="mobile-totals-name">{player.name}</span>
            <PlayerTotal total={playerTotals[player.id]} className="mobile-totals-score" />
          </div>
        ))}
      </div>

      <div className="main-score-sheet">
        {isDesktop ? (
          <RoundTable
            rows={rows}
            players={players}
            playerTotals={playerTotals}
            editingCell={editingCell}
            onEditCell={setEditingCell}
            onScoreUpdate={handleScoreUpdate}
            onAddRound={handleAddRound}
          />
        ) : (
          <RoundCardList
            rows={rows}
            players={players}
            editingCell={editingCell}
            onEditCell={setEditingCell}
            onScoreUpdate={handleScoreUpdate}
            onAddRound={handleAddRound}
            expandedRoundId={expandedRoundId}
            onToggleRound={setExpandedRoundId}
            isOpen={!!gameTable?.is_open}
            bottomRef={bottomRef}
          />
        )}
      </div>

      {isAddingPlayer && (
        <AddPlayerDialog
          searchTerm={searchTerm}
          onSearchTermChange={(term) => {
            setSearchTerm(term)
            runSearch(term)
          }}
          candidates={candidates}
          loading={searchLoading}
          onSelect={handleAddPlayerToGame}
          onCancel={() => setIsAddingPlayer(false)}
        />
      )}
    </div>
  )
}
