import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  LockOpenIcon,
  LockClosedIcon,
  ChartBarIcon,
  UserPlusIcon,
  PlusIcon,
  PhotoIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline'
import { useTableRealtime } from '@/features/schafkopf/api/useTableRealtime'
import { schafkopfKeys } from '@/features/schafkopf/api/queries'
import {
  addPlayerToTable,
  getTableDetail,
  listRounds,
  saveRound,
} from '@/features/schafkopf/api/rounds'
import { setTableFlags } from '@/features/schafkopf/api/tables'
import { setTableScoringConfig } from '@/features/schafkopf/api/scoringConfig'
import {
  newRoundInput,
  parseScoringConfig,
  roundInputFromStored,
  type RecalculatedRound,
  type RoundInput,
  type RoundRole,
  type ScoringConfig,
  type StoredRound,
} from '@/features/schafkopf/domain/gameModes'
import {
  closeGameWithPhoto,
  getGamePhotoUrl,
  removeGamePhoto,
  replaceGamePhoto,
  type GamePhotoSlot,
} from '@/features/schafkopf/api/gamePhotos'
import { searchPlayers } from '@/features/players/api/players'
import { useMediaQuery } from '@/shared/ui/useMediaQuery'
import type { Player } from '@/shared/supabase/types'
import '@/shared/styles/game-details.css'
import { RoundTable } from './GameDetails/RoundTable'
import { RoundCardList } from './GameDetails/RoundCardList'
import { AddPlayerDialog } from './GameDetails/AddPlayerDialog'
import { PlayerTotal } from './GameDetails/PlayerTotal'
import { GamePhotoDialog } from './GamePhotoDialog'
import {
  RoundEditorDialog,
  type SuccessfulEvaluation,
} from './GameDetails/RoundEditor/RoundEditorDialog'
import { TableRulesDialog } from './GameDetails/TableRulesDialog'
import type { RoundRow } from './GameDetails/types'

interface EditorState {
  /** null for a new round. */
  roundId: number | null
  title: string
  initial: RoundInput
}

export function GameDetailsPage() {
  const { id } = useParams<{ id: string }>()
  // The route param is a string; the id columns are bigint. PostgREST coerced
  // this silently before the client was typed — now it is explicit.
  const tableId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  /**
   * Matches the 820px breakpoint in game-details.css. The two score sheets are
   * mutually exclusive views of the same state, so only one is mounted.
   */
  const isDesktop = useMediaQuery('(min-width: 821px)')

  const [isAddingPlayer, setIsAddingPlayer] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [candidates, setCandidates] = useState<Player[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [isRulesOpen, setIsRulesOpen] = useState(false)
  const [expandedRoundId, setExpandedRoundId] = useState<number | null>(null)
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false)
  const [closingPhoto, setClosingPhoto] = useState<File | null>(null)
  const [editingPhotoSlot, setEditingPhotoSlot] = useState<GamePhotoSlot | null>(null)
  const [editingPhoto, setEditingPhoto] = useState<File | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)

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

  const rows: RoundRow[] = useMemo(
    () =>
      rounds.map((round) => {
        const row: RoundRow = {
          roundNumber: round.round_number,
          roundId: round.id,
          round,
          scores: {},
          roles: {},
        }
        for (const score of roundScores) {
          if (score.round_id !== round.id) continue
          row.scores[score.player_id] = score.raw_score
          row.roles[score.player_id] = score.role
        }
        return row
      }),
    [rounds, roundScores],
  )

  const scoringConfig = useMemo(
    () => parseScoringConfig(gameTable?.scoring_config),
    [gameTable?.scoring_config],
  )
  const playerIds = useMemo(() => players.map((p) => p.id), [players])

  const storedRounds: StoredRound[] = useMemo(
    () =>
      rows.map((row) => ({
        ...row.round,
        scores: playerIds.map((player_id) => ({
          player_id,
          raw_score: row.scores[player_id] ?? 0,
          role: (row.roles[player_id] ?? null) as RoundRole | null,
        })),
      })),
    [rows, playerIds],
  )

  const playerTotals = useMemo(() => {
    const totals: Record<number, number> = {}
    players.forEach((player) => (totals[player.id] = 0))
    roundScores.forEach((score) => {
      if (totals[score.player_id] !== undefined) totals[score.player_id] += score.raw_score
    })
    return totals
  }, [players, roundScores])

  const handleAddRound = useCallback(() => {
    // The dealer — who sits out at bigger tables — moves one seat along from
    // the last round that recorded who sat out.
    const lastScored = [...rows]
      .reverse()
      .find((row) => row.round.game_mode && row.round.game_mode !== 'manual')
    const previousSittingOut = lastScored
      ? playerIds.filter((id) => lastScored.roles[id] === 'sitting_out')
      : null
    setEditor({
      roundId: null,
      title: `Runde ${rows.length > 0 ? rows[rows.length - 1].roundNumber + 1 : 1}`,
      initial: newRoundInput(scoringConfig, playerIds, previousSittingOut),
    })
  }, [rows, playerIds, scoringConfig])

  const handleOpenRound = useCallback(
    (roundId: number) => {
      const stored = storedRounds.find((round) => round.id === roundId)
      const row = rows.find((r) => r.roundId === roundId)
      if (!stored || !row) return
      setEditor({
        roundId,
        title: `Runde ${row.roundNumber} bearbeiten`,
        initial: roundInputFromStored(stored, stored.scores, playerIds),
      })
    },
    [rows, storedRounds, playerIds],
  )

  const handleSaveRound = async (evaluation: SuccessfulEvaluation) => {
    if (!editor) return
    // The editor's save button disables itself while this runs, so one tap
    // cannot become several rounds.
    const round = await saveRound({
      tableId,
      roundId: editor.roundId,
      facts: evaluation.facts,
      scores: playerIds.map((player_id) => ({
        player_id,
        raw_score: evaluation.scores[player_id] ?? 0,
        role: evaluation.roles[player_id] ?? null,
      })),
    })
    await refreshRounds()
    setEditor(null)
    setExpandedRoundId(round.id)
  }

  const handleSaveRules = async (config: ScoringConfig, changed: RecalculatedRound[]) => {
    await setTableScoringConfig({ tableId, config, rounds: changed })
    await Promise.all([refreshTable(), refreshRounds()])
    setIsRulesOpen(false)
  }

  const handleToggleIsOpen = async () => {
    if (!gameTable) return
    if (gameTable.is_open) {
      setPhotoError(null)
      setClosingPhoto(null)
      setIsCloseDialogOpen(true)
      return
    }
    try {
      await setTableFlags(tableId, { is_open: true })
      await refreshTable()
    } catch (err) {
      console.error('Error toggling is_open:', err)
    }
  }

  const handleCloseGame = async (includeSelectedPhoto: boolean) => {
    if (!gameTable) return
    setPhotoBusy(true)
    setPhotoError(null)
    try {
      if (includeSelectedPhoto && closingPhoto) {
        await closeGameWithPhoto({
          tableId,
          photo: closingPhoto,
          previousPath: gameTable.after_photo_path,
        })
      } else {
        await setTableFlags(tableId, { is_open: false })
      }
      await refreshTable()
      setClosingPhoto(null)
      setIsCloseDialogOpen(false)
    } catch (closeError) {
      console.error('Error closing game:', closeError)
      setPhotoError('The game could not be closed. Please try again.')
    } finally {
      setPhotoBusy(false)
    }
  }

  const openPhotoEditor = (slot: GamePhotoSlot) => {
    setEditingPhoto(null)
    setPhotoError(null)
    setEditingPhotoSlot(slot)
  }

  const handleSavePhoto = async () => {
    if (!gameTable || !editingPhotoSlot || !editingPhoto) return
    const previousPath =
      editingPhotoSlot === 'before' ? gameTable.before_photo_path : gameTable.after_photo_path
    setPhotoBusy(true)
    setPhotoError(null)
    try {
      await replaceGamePhoto({
        tableId,
        slot: editingPhotoSlot,
        photo: editingPhoto,
        previousPath,
      })
      await refreshTable()
      setEditingPhoto(null)
      setEditingPhotoSlot(null)
    } catch (saveError) {
      console.error('Error saving game photo:', saveError)
      setPhotoError('The photo could not be saved. Please try again.')
    } finally {
      setPhotoBusy(false)
    }
  }

  const handleRemovePhoto = async () => {
    if (!gameTable || !editingPhotoSlot) return
    const path =
      editingPhotoSlot === 'before' ? gameTable.before_photo_path : gameTable.after_photo_path
    if (!path) return
    setPhotoBusy(true)
    setPhotoError(null)
    try {
      await removeGamePhoto(tableId, editingPhotoSlot, path)
      await refreshTable()
      setEditingPhoto(null)
      setEditingPhotoSlot(null)
    } catch (removeError) {
      console.error('Error removing game photo:', removeError)
      setPhotoError('The photo could not be removed. Please try again.')
    } finally {
      setPhotoBusy(false)
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
      await addPlayerToTable(tableId, playerId, rounds)
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

  const beforePhotoUrl = getGamePhotoUrl(gameTable?.before_photo_path ?? null)
  const afterPhotoUrl = getGamePhotoUrl(gameTable?.after_photo_path ?? null)
  const heroPhotoSlot: GamePhotoSlot | null =
    !gameTable?.is_open && afterPhotoUrl
      ? 'after'
      : beforePhotoUrl
        ? 'before'
        : afterPhotoUrl
          ? 'after'
          : null
  const heroPhotoUrl = heroPhotoSlot === 'after' ? afterPhotoUrl : beforePhotoUrl
  const editingPhotoPath =
    editingPhotoSlot === 'before'
      ? gameTable?.before_photo_path
      : editingPhotoSlot === 'after'
        ? gameTable?.after_photo_path
        : null
  const editingPhotoUrl =
    editingPhotoSlot === 'before'
      ? beforePhotoUrl
      : editingPhotoSlot === 'after'
        ? afterPhotoUrl
        : null

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
            title={
              gameTable?.is_open
                ? 'Game is open for editing (click to lock)'
                : 'Game is locked (click to reopen)'
            }
            className={`status-button ${
              gameTable?.is_open ? 'status-button-open' : 'status-button-closed'
            }`}
          >
            {gameTable?.is_open ? (
              <LockOpenIcon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            ) : (
              <LockClosedIcon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            )}
            <span className="hidden sm:inline">{gameTable?.is_open ? 'Open' : 'Closed'}</span>
          </button>

          <button
            onClick={handleToggleExcludeFromOverall}
            title={
              gameTable?.exclude_from_overall
                ? 'Excluded from overall stats (click to include)'
                : 'Included in overall stats (click to exclude)'
            }
            className={`status-button ${
              gameTable?.exclude_from_overall ? 'status-button-excluded' : 'status-button-included'
            }`}
          >
            <ChartBarIcon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            <span className="hidden sm:inline">
              {gameTable?.exclude_from_overall ? 'Excluded' : 'In Stats'}
            </span>
          </button>

          <button
            onClick={() => setIsRulesOpen(true)}
            className="btn-add-player-nav"
            title="Punkteregeln für dieses Spiel"
          >
            <AdjustmentsHorizontalIcon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 text-gray-600" />
            <span className="hidden min-[640px]:inline">Regeln</span>
          </button>

          <button
            onClick={() => {
              setIsAddingPlayer(true)
              runSearch('')
            }}
            className="btn-add-player-nav"
            title="Add player to game"
          >
            <UserPlusIcon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 text-gray-600" />
            <span className="hidden min-[640px]:inline">Add Player</span>
            <span className="hidden min-[480px]:inline min-[640px]:hidden">Player</span>
          </button>

          {gameTable?.is_open && (
            <button onClick={handleAddRound} className="btn-add-round" title="Add round">
              <PlusIcon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span>Round</span>
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

      {heroPhotoUrl && (
        <button
          type="button"
          className="game-photo-hero block w-full text-left"
          onClick={() => heroPhotoSlot && openPhotoEditor(heroPhotoSlot)}
          aria-label={`Edit ${heroPhotoSlot} game photo`}
        >
          <img
            src={heroPhotoUrl}
            alt={`${heroPhotoSlot === 'after' ? 'After' : 'Before'} the game`}
          />
          <span className="game-photo-hero-shade" />
          <div className="game-photo-hero-copy">
            <span>{heroPhotoSlot === 'after' ? 'After the game' : 'Before the game'}</span>
            <p>Tap to view or change this photo</p>
          </div>
        </button>
      )}

      <div className="game-photo-gallery" aria-label="Game photos">
        {(
          [
            ['before', 'Before', beforePhotoUrl],
            ['after', 'After', afterPhotoUrl],
          ] as const
        ).map(([slot, label, url]) => (
          <button
            key={slot}
            type="button"
            className="game-photo-gallery-card"
            onClick={() => openPhotoEditor(slot)}
          >
            {url ? (
              <img src={url} alt={`${label} the game`} />
            ) : (
              <span className="game-photo-gallery-empty">
                <PhotoIcon className="w-6 h-6" />
                <span>Add photo</span>
              </span>
            )}
            <span className="game-photo-gallery-label">{label}</span>
          </button>
        ))}
      </div>

      <div className="main-score-sheet">
        {isDesktop ? (
          <RoundTable
            rows={rows}
            players={players}
            playerTotals={playerTotals}
            isOpen={!!gameTable?.is_open}
            onOpenRound={handleOpenRound}
            onAddRound={handleAddRound}
          />
        ) : (
          <RoundCardList
            rows={rows}
            players={players}
            onOpenRound={handleOpenRound}
            onAddRound={handleAddRound}
            expandedRoundId={expandedRoundId}
            onToggleRound={setExpandedRoundId}
            isOpen={!!gameTable?.is_open}
            bottomRef={bottomRef}
          />
        )}
      </div>

      {editor && (
        <RoundEditorDialog
          // A fresh editor per round, so its state never leaks between rounds.
          key={editor.roundId ?? 'new'}
          title={editor.title}
          players={players}
          config={scoringConfig}
          initial={editor.initial}
          onSave={handleSaveRound}
          onClose={() => setEditor(null)}
        />
      )}

      {isRulesOpen && (
        <TableRulesDialog
          config={scoringConfig}
          rounds={storedRounds}
          players={players}
          editable={!!gameTable?.is_open}
          onSave={handleSaveRules}
          onClose={() => setIsRulesOpen(false)}
        />
      )}

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

      {isCloseDialogOpen && (
        <GamePhotoDialog
          title="Close this game?"
          description="Add one last photo of the group, or close without one."
          pickerTitle="After the game"
          file={closingPhoto}
          onFileChange={setClosingPhoto}
          existingUrl={afterPhotoUrl}
          primaryLabel="Close Game"
          onPrimary={() => handleCloseGame(true)}
          secondaryLabel="Skip photo"
          onSecondary={() => handleCloseGame(false)}
          onClose={() => {
            setIsCloseDialogOpen(false)
            setClosingPhoto(null)
            setPhotoError(null)
          }}
          busy={photoBusy}
          error={photoError}
        />
      )}

      {editingPhotoSlot && (
        <GamePhotoDialog
          title={`${editingPhotoSlot === 'before' ? 'Before' : 'After'} photo`}
          description="Choose a new photo to replace the current one."
          pickerTitle={`${editingPhotoSlot === 'before' ? 'Before' : 'After'} the game`}
          file={editingPhoto}
          onFileChange={setEditingPhoto}
          existingUrl={editingPhotoUrl}
          primaryLabel="Save Photo"
          onPrimary={handleSavePhoto}
          onRemove={editingPhotoPath ? handleRemovePhoto : undefined}
          onClose={() => {
            setEditingPhotoSlot(null)
            setEditingPhoto(null)
            setPhotoError(null)
          }}
          busy={photoBusy}
          error={photoError}
          primaryDisabled={!editingPhoto}
        />
      )}
    </div>
  )
}
