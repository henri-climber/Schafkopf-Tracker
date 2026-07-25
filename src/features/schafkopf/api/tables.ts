import { supabase } from '@/shared/supabase/client'
import type { GameTable, Player } from '@/shared/supabase/types'

/** A player as embedded in a table listing. */
export type TablePlayerSummary = Pick<Player, 'id' | 'name'>

export interface TableSummary extends GameTable {
  table_players?: { player_id: number; player: TablePlayerSummary }[]
}

/**
 * Open or closed tables with their players embedded.
 *
 * Home and PastGames issued the same query with only `is_open` and the sort
 * direction differing, so they share one function.
 */
export async function listTables(options: {
  isOpen: boolean
  ascending?: boolean
}): Promise<TableSummary[]> {
  const { data, error } = await supabase
    .from('Tables')
    .select('*, table_players(player_id, player:Players(id, name))')
    .eq('is_open', options.isOpen)
    .order('created_at', { ascending: options.ascending ?? false })
    .returns<TableSummary[]>()

  if (error) throw error
  return data ?? []
}

export async function createTable(input: {
  name: string
  playerIds: number[]
}): Promise<GameTable> {
  const { data: table, error } = await supabase
    .from('Tables')
    .insert({ name: input.name })
    .select()
    .single()
  if (error) throw error

  if (input.playerIds.length > 0) {
    const { error: playersError } = await supabase
      .from('table_players')
      .insert(input.playerIds.map((player_id) => ({ table_id: table.id, player_id })))
    if (playersError) throw playersError
  }

  return table
}

export async function setTableFlags(
  tableId: number,
  patch: { is_open?: boolean; exclude_from_overall?: boolean },
): Promise<void> {
  const { error } = await supabase.from('Tables').update(patch).eq('id', tableId)
  if (error) throw error
}
