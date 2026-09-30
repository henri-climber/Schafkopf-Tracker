/**
 * Turns stored tables and rounds into one uniform shape for the statistics
 * page. Pure — no I/O, no React, no Supabase.
 *
 * Two kinds of rounds exist. Mode rounds (recorded with the round editor) know
 * what was played and who played it. Legacy rounds — everything before game
 * modes, plus free-entry `manual` rounds — only have numbers. Their score
 * pattern still tells a lot: two up and two down is a team game, one player up
 * against three is a won solo. One player down against three is either a lost
 * solo or a Ramsch loser; the amounts overlap, so that stays ambiguous.
 *
 * Both kinds end up as a `StatRound` with a `shape` and a side per player, so
 * everything that only needs "who won with whom" treats them the same.
 */

import { computeTableStandings, type PlayerId, type TableStanding } from '../scoring'
import {
  MODE_META,
  type ModeFamily,
  type RoundFacts,
  type RoundRole,
  type ScoredMode,
} from '../gameModes'

// ── Input: what the stats query returns ─────────────────────────────────────

export interface RawStatsScore {
  player_id: PlayerId
  raw_score: number
  role: RoundRole | null
}

export interface RawStatsRound extends RoundFacts {
  id: number
  round_number: number
  created_at: string
  round_scores: RawStatsScore[]
}

export interface RawStatsTable {
  id: number
  created_at: string
  is_open: boolean
  exclude_from_overall: boolean
  Rounds: RawStatsRound[]
}

// ── Output ──────────────────────────────────────────────────────────────────

/**
 * team: two against two. soloWon: one player up against three.
 * singleLoss: one player down against three — a lost solo or a Ramsch loser.
 * other: anything else (mistyped or unusual rounds); counted in points only.
 */
export type RoundShape = 'team' | 'soloWon' | 'singleLoss' | 'other'

export type Side = 'up' | 'down' | 'out'

export interface Seat {
  playerId: PlayerId
  score: number
  role: RoundRole | null
  side: Side
}

export interface StatRound {
  id: number
  tableId: number
  roundNumber: number
  createdAt: string
  source: 'mode' | 'legacy'
  /** Null for legacy and manual rounds. */
  mode: ScoredMode | null
  family: ModeFamily | null
  shape: RoundShape
  /** The facts of a mode round; null for legacy and manual rounds. */
  facts: RoundFacts | null
  seats: Seat[]
  /** Total points that changed hands: the sum of all positive scores. */
  stake: number
  /**
   * The lone player of a soloWon or singleLoss round: the solo declarer, the
   * Ramsch loser or the Durchmarsch player. Null for other shapes.
   */
  soloPlayerId: PlayerId | null
}

export interface StatTable {
  id: number
  createdAt: string
  isOpen: boolean
  /** Counts towards the leaderboard (`exclude_from_overall` is false). */
  ranked: boolean
  /** Standings over every round, exactly as the leaderboard computes them. */
  standings: TableStanding[]
  rounds: StatRound[]
}

// ── Classification ──────────────────────────────────────────────────────────

/** The shape of a legacy round from its numbers alone. */
export function classifyShape(scores: readonly number[]): RoundShape | null {
  const up = scores.filter((score) => score > 0).length
  const down = scores.filter((score) => score < 0).length
  if (up === 0 && down === 0) return null
  if (up === 2 && down === 2) return 'team'
  if (up === 1 && down === 3) return 'soloWon'
  if (up === 3 && down === 1) return 'singleLoss'
  return 'other'
}

function sideFromScore(score: number): Side {
  return score > 0 ? 'up' : score < 0 ? 'down' : 'out'
}

function sideFromRole(role: RoundRole | null, declarerSideWon: boolean): Side {
  if (role === 'declarer' || role === 'partner') return declarerSideWon ? 'up' : 'down'
  if (role === 'opponent') return declarerSideWon ? 'down' : 'up'
  return 'out'
}

function factsOf(round: RoundFacts): RoundFacts {
  return {
    game_mode: round.game_mode,
    suit: round.suit,
    declarer_won: round.declarer_won,
    schneider: round.schneider,
    schwarz: round.schwarz,
    laufende: round.laufende,
    klopfer: round.klopfer,
    kontra: round.kontra,
    re: round.re,
    tout: round.tout,
    sie: round.sie,
    jungfrau: round.jungfrau,
    durchmarsch: round.durchmarsch,
  }
}

function loneSeat(seats: readonly Seat[], side: Side): PlayerId | null {
  const matching = seats.filter((seat) => seat.side === side)
  return matching.length === 1 ? matching[0].playerId : null
}

/**
 * Normalises one stored round, or returns null for an empty one (every score
 * zero — the old flow left those behind when nobody filled a round in).
 */
export function toStatRound(tableId: number, round: RawStatsRound): StatRound | null {
  const stake = round.round_scores.reduce((sum, s) => sum + Math.max(0, s.raw_score), 0)
  const mode = round.game_mode
  const hasRoles = round.round_scores.some((s) => s.role === 'declarer')

  const base = {
    id: round.id,
    tableId,
    roundNumber: round.round_number,
    createdAt: round.created_at,
    stake,
  }

  if (mode != null && mode !== 'manual' && hasRoles) {
    const meta = MODE_META[mode]
    // In Ramsch the declarer is the loser, unless they went Durchmarsch.
    const declarerSideWon =
      meta.family === 'ramsch' ? round.durchmarsch : (round.declarer_won ?? false)
    const seats: Seat[] = round.round_scores.map((s) => ({
      playerId: s.player_id,
      score: s.raw_score,
      role: s.role,
      side: sideFromRole(s.role, declarerSideWon),
    }))
    const shape: RoundShape =
      meta.family === 'team' ? 'team' : declarerSideWon ? 'soloWon' : 'singleLoss'
    const declarer = seats.find((seat) => seat.role === 'declarer')?.playerId ?? null

    return {
      ...base,
      source: 'mode',
      mode,
      family: meta.family,
      shape,
      facts: factsOf(round),
      seats,
      soloPlayerId: shape === 'team' ? null : declarer,
    }
  }

  const shape = classifyShape(round.round_scores.map((s) => s.raw_score))
  if (shape === null) return null

  const seats: Seat[] = round.round_scores.map((s) => ({
    playerId: s.player_id,
    score: s.raw_score,
    role: null,
    side: sideFromScore(s.raw_score),
  }))
  return {
    ...base,
    source: 'legacy',
    mode: null,
    family: null,
    shape,
    facts: null,
    seats,
    soloPlayerId:
      shape === 'soloWon'
        ? loneSeat(seats, 'up')
        : shape === 'singleLoss'
          ? loneSeat(seats, 'down')
          : null,
  }
}

/** Every table in chronological order, with its rounds in play order. */
export function toStatTables(tables: readonly RawStatsTable[]): StatTable[] {
  return tables
    .map((table) => {
      const ordered = [...table.Rounds].sort((a, b) => a.round_number - b.round_number)
      return {
        id: table.id,
        createdAt: table.created_at,
        isOpen: table.is_open,
        ranked: !table.exclude_from_overall,
        standings: computeTableStandings(ordered.flatMap((round) => round.round_scores)),
        rounds: ordered
          .map((round) => toStatRound(table.id, round))
          .filter((round): round is StatRound => round !== null),
      }
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id)
}

// ── Filters ─────────────────────────────────────────────────────────────────

export type RoundSource = 'all' | 'legacy' | 'mode'

export interface StatsFilters {
  /** Only tables that count towards the leaderboard. */
  rankedOnly: boolean
  /** Include tables that are still open. */
  includeOngoing: boolean
  source: RoundSource
}

export const DEFAULT_STATS_FILTERS: StatsFilters = {
  rankedOnly: true,
  includeOngoing: false,
  source: 'all',
}

/** The tables a filter selects. Rounds inside them are untouched. */
export function filterTables(tables: readonly StatTable[], filters: StatsFilters): StatTable[] {
  return tables.filter(
    (table) => (!filters.rankedOnly || table.ranked) && (filters.includeOngoing || !table.isOpen),
  )
}

/** Every round of the given tables that matches the source filter, in play order. */
export function selectRounds(tables: readonly StatTable[], source: RoundSource): StatRound[] {
  return tables.flatMap((table) =>
    source === 'all' ? table.rounds : table.rounds.filter((round) => round.source === source),
  )
}
