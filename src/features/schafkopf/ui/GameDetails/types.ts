import type { RoundRole } from '@/features/schafkopf/domain/gameModes'
import type { Round } from '@/shared/supabase/types'

/** One row of the score sheet: a round, and each player's score and role in it. */
export interface RoundRow {
  roundNumber: number
  roundId: number
  round: Round
  scores: { [playerId: number]: number }
  roles: { [playerId: number]: RoundRole | null }
}
