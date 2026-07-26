import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL_SCHAF
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY_SCHAF

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(`Missing Supabase environment variables:
    URL: ${supabaseUrl ? 'Set' : 'Missing'}
    Anon Key: ${supabaseAnonKey ? 'Set' : 'Missing'}
  `)
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
