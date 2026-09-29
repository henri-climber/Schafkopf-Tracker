import { supabase } from '@/shared/supabase/client'
import type { GameTable, Player, Round, RoundScore } from '@/shared/supabase/types'
import type { RoundFacts, RoundRole } from '@/features/schafkopf/domain/gameModes'

export interface TableDetail {
  table: GameTable
  players: Player[]
}

/** A table plus its players, in one request instead of two. */
export async function getTableDetail(tableId: number): Promise<TableDetail> {
  const { data, error } = await supabase
    .from('Tables')
    .select('*, table_players(player:Players(id, name, created_at))')
    .eq('id', tableId)
    .single()
    .returns<GameTable & { table_players: { player: Player }[] }>()

  if (error) throw error

  const { table_players, ...table } = data
  return {
    table,
    // Sorted by id so the column order is stable across reloads.
    players: table_players.map((entry) => entry.player).sort((a, b) => a.id - b.id),
  }
}

export interface RoundsAndScores {
  rounds: Round[]
  scores: RoundScore[]
}

/**
 * All rounds for a table with their scores, in one request. Previously two
 * sequential queries: rounds, then scores filtered by the resulting ids.
 */
export async function listRounds(tableId: number): Promise<RoundsAndScores> {
  const { data, error } = await supabase
    .from('Rounds')
    .select('*, round_scores(*)')
    .eq('table_id', tableId)
    .order('round_number', { ascending: true })
    .returns<(Round & { round_scores: RoundScore[] })[]>()

  if (error) throw error

  const rounds = data ?? []
  return {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    rounds: rounds.map(({ round_scores, ...round }) => round),
    scores: rounds.flatMap((round) => round.round_scores),
  }
}

export interface ScoreToSave {
  player_id: number
  raw_score: number
  role: RoundRole | null
}

/**
 * Saves a round's facts and every player's score in one transaction. Without a
 * `roundId` it adds the next round.
 *
 * The round number is chosen by the database, not here. Passing a client-side
 * `rounds.length + 1` is what once produced duplicate rounds: a device that had
 * missed someone else's round, or that fired two taps before its own state
 * updated, claimed a number that already existed. A unique constraint on
 * (table_id, round_number) backs this up.
 */
export async function saveRound(input: {
  tableId: number
  roundId: number | null
  facts: RoundFacts
  scores: ScoreToSave[]
}): Promise<Round> {
  // Returns the row itself, not a set — no .single() needed.
  const { data: round, error } = await supabase.rpc('save_round', {
    p_table_id: input.tableId,
    p_round: { ...input.facts },
    p_scores: input.scores.map((score) => ({ ...score })),
    ...(input.roundId === null ? {} : { p_round_id: input.roundId }),
  })
  if (error) throw error
  return round
}

/**
 * A late arrival gets a 0 in every round so far. In rounds that record a game
 * mode they are marked as having sat out, which is what they did.
 */
export async function addPlayerToTable(
  tableId: number,
  playerId: number,
  rounds: Pick<Round, 'id' | 'game_mode'>[],
) {
  const { error } = await supabase
    .from('table_players')
    .insert([{ table_id: tableId, player_id: playerId }])
  if (error) throw error

  if (rounds.length > 0) {
    const { error: scoresError } = await supabase.from('round_scores').insert(
      rounds.map((round) => ({
        round_id: round.id,
        player_id: playerId,
        raw_score: 0,
        role: round.game_mode && round.game_mode !== 'manual' ? ('sitting_out' as const) : null,
      })),
    )
    if (scoresError) throw scoresError
  }
}
