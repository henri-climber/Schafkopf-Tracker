import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Debug logging
console.log('Supabase URL:', supabaseUrl ? 'Set' : 'Not set')
console.log('Supabase Anon Key:', supabaseAnonKey ? 'Set' : 'Not set')

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

// Test the connection
;(async () => {
  try {
    const { error } = await supabase.from('Players').select('count', { count: 'exact', head: true })
    if (error) {
      console.error('Supabase connection test failed:', error)
    } else {
      console.log('Supabase connection test successful')
    }
  } catch (error) {
    console.error('Supabase connection test error:', error)
  }
})()

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