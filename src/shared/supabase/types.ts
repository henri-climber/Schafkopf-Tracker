import type { Database } from './database.types'

type T = Database['public']['Tables']

/**
 * Row aliases derived from the generated schema. Prefer these over
 * hand-written interfaces — if a column changes, these change with it and the
 * typecheck tells you where.
 *
 * Note the table names are inconsistently cased in Postgres (PascalCase for
 * the original three, snake_case for everything added later). That is purely
 * cosmetic here: `.from('Players')` and `.from('round_scores')` are both just
 * string-literal keys of the generated Database type. Renaming the tables
 * would cost a migration and 46 call-site edits to fix nothing.
 */
export type Player = T['Players']['Row']
export type GameTable = T['Tables']['Row']
export type TablePlayer = T['table_players']['Row']
export type Round = T['Rounds']['Row']
export type RoundScore = T['round_scores']['Row']

export type TTMatch = T['tt_matches']['Row']
export type TTMatchPlayer = T['tt_match_players']['Row']
export type TTSet = T['tt_sets']['Row']

/**
 * `format` and `side` are CHECK constraints rather than Postgres enums, so the
 * generator widens them to `string`. These stay hand-written until the columns
 * become real enums.
 */
export type TTFormat = 'singles' | 'doubles'
export type TTSide = 'A' | 'B'
