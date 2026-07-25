import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL_SCHAF
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY_SCHAF

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(`Missing Supabase environment variables:
    URL: ${supabaseUrl ? 'Set' : 'Missing'}
    Anon Key: ${supabaseAnonKey ? 'Set' : 'Missing'}
  `)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

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

// --- Tischtennis ---
export type TTFormat = 'singles' | 'doubles'
export type TTSide = 'A' | 'B'

export type TTMatch = {
  id: number
  created_at: string
  name: string | null
  format: TTFormat
  best_of: number
  is_open: boolean
  exclude_from_overall: boolean
}

export type TTMatchPlayer = {
  match_id: number
  player_id: number
  side: TTSide
}

export type TTSet = {
  id: number
  match_id: number
  set_number: number
  score_a: number
  score_b: number
  created_at: string
}
