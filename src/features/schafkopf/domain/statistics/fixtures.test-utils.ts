import type { RoundFacts, RoundRole, ScoredMode, Suit } from '../gameModes'
import type { RawStatsRound, RawStatsTable } from './normalize'

const NO_FACTS: RoundFacts = {
  game_mode: null,
  suit: null,
  declarer_won: null,
  schneider: false,
  schwarz: false,
  laufende: 0,
  klopfer: 0,
  kontra: false,
  re: false,
  tout: false,
  sie: false,
  jungfrau: false,
  durchmarsch: false,
}

let nextRoundId = 1

/** A legacy round from `[playerId, score]` pairs. */
export function legacy(...scores: [number, number][]): RawStatsRound {
  const id = nextRoundId++
  return {
    ...NO_FACTS,
    id,
    round_number: id,
    created_at: '2026-01-01T00:00:00.000Z',
    round_scores: scores.map(([player_id, raw_score]) => ({ player_id, raw_score, role: null })),
  }
}

interface ModeRoundOptions extends Partial<Omit<RoundFacts, 'game_mode'>> {
  suit?: Suit | null
}

/**
 * A mode round from `[playerId, score, role]` triples. `declarer_won` defaults
 * from the declarer's score.
 */
export function mode(
  gameMode: ScoredMode,
  seats: [number, number, RoundRole][],
  options: ModeRoundOptions = {},
): RawStatsRound {
  const id = nextRoundId++
  const declarer = seats.find(([, , role]) => role === 'declarer')
  return {
    ...NO_FACTS,
    declarer_won: gameMode === 'ramsch' ? false : (declarer?.[1] ?? 0) > 0,
    ...options,
    game_mode: gameMode,
    id,
    round_number: id,
    created_at: '2026-01-01T00:00:00.000Z',
    round_scores: seats.map(([player_id, raw_score, role]) => ({ player_id, raw_score, role })),
  }
}

export function table(
  id: number,
  rounds: RawStatsRound[],
  options: Partial<Pick<RawStatsTable, 'is_open' | 'exclude_from_overall' | 'created_at'>> = {},
): RawStatsTable {
  return {
    id,
    created_at: options.created_at ?? `2026-01-${String(id).padStart(2, '0')}T20:00:00.000Z`,
    is_open: options.is_open ?? false,
    exclude_from_overall: options.exclude_from_overall ?? false,
    Rounds: rounds,
  }
}
