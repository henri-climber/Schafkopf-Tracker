import { supabase } from '@/shared/supabase/client'
import type { TableWithScores } from '@/features/schafkopf/domain/scoring'

export interface DateRange {
  from: string
  to: string
}

export interface StatsOptions {
  includeOngoing: boolean
}

/** The shape the two-level embed returns. */
interface EmbeddedTable {
  id: number
  created_at: string
  Rounds: { round_scores: { player_id: number; raw_score: number }[] }[]
}

/**
 * Every counted table in a date range, with all of its scores, in one request.
 *
 * This replaces a loop that issued two sequential round-trips per table — for
 * Semester 4 that was 2 + 66x2 = 134 requests, and the leaderboard and the chart
 * each ran their own copy, so roughly 270 per page view. The embed is
 * unambiguous in both hops (Rounds_table_id_fkey, round_scores_round_id_fkey).
 *
 * Payload is small: the widest semester is 66 tables / 624 rounds / 2816 score
 * rows, and only two columns per score are selected.
 */
export async function fetchTablesWithScores(
  range: DateRange,
  options: StatsOptions,
): Promise<TableWithScores[]> {
  let query = supabase
    .from('Tables')
    .select('id, created_at, Rounds(round_scores(player_id, raw_score))')
    .eq('exclude_from_overall', false)
    .gte('created_at', range.from)
    .lte('created_at', range.to)
    .order('created_at', { ascending: true })

  if (!options.includeOngoing) {
    query = query.eq('is_open', false)
  }

  const { data, error } = await query.returns<EmbeddedTable[]>()
  if (error) throw error

  return (data ?? []).map((table) => ({
    id: table.id,
    created_at: table.created_at,
    scores: table.Rounds.flatMap((round) => round.round_scores),
  }))
}
