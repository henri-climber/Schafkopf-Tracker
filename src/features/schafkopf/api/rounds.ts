import { supabase } from '@/shared/supabase/client'
import type { GameTable, Player, Round, RoundScore } from '@/shared/supabase/types'

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
    rounds: rounds.map((round) => ({
      id: round.id,
      table_id: round.table_id,
      round_number: round.round_number,
      created_at: round.created_at,
    })),
    scores: rounds.flatMap((round) => round.round_scores),
  }
}

/**
 * Adds the next round to a table.
 *
 * The round number is chosen by the database, not here. Passing a client-side
 * `rounds.length + 1` is what produced duplicate rounds: a device that had
 * missed someone else's round, or that fired two taps before its own state
 * updated, claimed a number that already existed. A unique constraint on
 * (table_id, round_number) now backs this up.
 */
export async function addRound(input: { tableId: number; playerIds: number[] }): Promise<Round> {
  // Returns the row itself, not a set — no .single() needed.
  const { data: round, error } = await supabase.rpc('add_round', { p_table_id: input.tableId })
  if (error) throw error

  if (input.playerIds.length > 0) {
    const { error: scoresError } = await supabase.from('round_scores').insert(
      input.playerIds.map((player_id) => ({
        round_id: round.id,
        player_id,
        raw_score: 0,
      })),
    )
    if (scoresError) throw scoresError
  }

  return round
}

/** Relies on the composite primary key (round_id, player_id). */
export async function upsertScore(
  roundId: number,
  playerId: number,
  rawScore: number,
): Promise<void> {
  const { error } = await supabase
    .from('round_scores')
    .upsert({ round_id: roundId, player_id: playerId, raw_score: rawScore })
  if (error) throw error
}

export async function addPlayerToTable(tableId: number, playerId: number, roundIds: number[]) {
  const { error } = await supabase
    .from('table_players')
    .insert([{ table_id: tableId, player_id: playerId }])
  if (error) throw error

  if (roundIds.length > 0) {
    const { error: scoresError } = await supabase
      .from('round_scores')
      .insert(roundIds.map((round_id) => ({ round_id, player_id: playerId, raw_score: 0 })))
    if (scoresError) throw scoresError
  }
}
