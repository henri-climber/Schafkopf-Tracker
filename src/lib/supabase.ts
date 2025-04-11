import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jzxoesdbgykmqzmllrqc.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseKey)

// Type definitions based on your schema
export type Player = {
  id: number
  name: string
  created_at: string
}

export type GameTable = {
  id: number
  name: string
  created_at: string
  exclude_from_overall: boolean
  is_open: boolean
}

export type TablePlayer = {
  player_id: number
  table_id: number
}

export type Round = {
  id: number
  table_id: number
  round_number: number
  created_at: string
}

export type RoundScore = {
  round_id: number
  player_id: number
  raw_score: number
  created_at: string
} 