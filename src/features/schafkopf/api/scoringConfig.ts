import { supabase } from '@/shared/supabase/client'
import {
  parseScoringConfig,
  type RecalculatedRound,
  type ScoringConfig,
} from '@/features/schafkopf/domain/gameModes'

/** The default every new game starts from. */
export async function getGlobalScoringConfig(): Promise<ScoringConfig> {
  const { data, error } = await supabase
    .from('schafkopf_settings')
    .select('scoring_config')
    .single()
  if (error) throw error
  return parseScoringConfig(data.scoring_config)
}

/** Only affects games created afterwards: each game keeps its own copy. */
export async function updateGlobalScoringConfig(config: ScoringConfig): Promise<void> {
  const { error } = await supabase
    .from('schafkopf_settings')
    .update({ scoring_config: config })
    .eq('id', true)
  if (error) throw error
}

/**
 * Changes one game's tariff and, in the same transaction, rewrites the scores
 * of the rounds it changes. The new scores come from `recalculateRounds`.
 */
export async function setTableScoringConfig(input: {
  tableId: number
  config: ScoringConfig
  rounds: RecalculatedRound[]
}): Promise<void> {
  const { error } = await supabase.rpc('set_table_scoring_config', {
    p_table_id: input.tableId,
    p_config: input.config,
    p_rounds: input.rounds.map((round) => ({
      round_id: round.roundId,
      scores: round.scores.map((score) => ({ ...score })),
    })),
  })
  if (error) throw error
}
