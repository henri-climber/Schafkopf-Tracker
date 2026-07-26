import { supabase } from '@/shared/supabase/client'
import type { Player } from '@/shared/supabase/types'

/** Every player, ordered by id — the order the leaderboard has always used. */
export async function listPlayers(): Promise<Player[]> {
  const { data, error } = await supabase.from('Players').select('*').order('id')
  if (error) throw error
  return data ?? []
}

export async function searchPlayers(term: string): Promise<Player[]> {
  const { data, error } = await supabase
    .from('Players')
    .select('*')
    .ilike('name', `%${term}%`)
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function createPlayer(name: string): Promise<Player> {
  const { data, error } = await supabase
    .from('Players')
    .insert({ name: name.trim() })
    .select()
    .single()
  if (error) throw error
  return data
}
