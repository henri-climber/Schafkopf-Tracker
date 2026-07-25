/**
 * Schafkopf scoring rules. Pure — no I/O, no React, no Supabase.
 *
 * This module is the single home of logic that previously existed as two
 * verbatim copies, one in LeaderboardPage and one in ScoreHistoryChart. They
 * had already drifted in one respect (see `includeOngoing` handling in the
 * pages), which is the usual fate of duplicated rules.
 */

export type PlayerId = number

/** One player's score in one round, as stored. */
export interface RawScore {
  player_id: PlayerId
  raw_score: number
}

/** Where a player finished at a single table, and what it was worth. */
export interface TableStanding {
  playerId: PlayerId
  rawTotal: number
  /** 0-based finishing position. */
  rank: number
  points: number
}

/** A table's scores together with when it was played. */
export interface TableWithScores {
  id: number
  created_at: string
  scores: readonly RawScore[]
}

export interface TableResult {
  tableId: number
  createdAt: string
  standings: TableStanding[]
}

export interface LeaderboardEntry {
  playerId: PlayerId
  totalPoints: number
  gamesPlayed: number
}

/**
 * Ranking points by table size: index i is what the i-th best player scores.
 *
 * Returns an empty array for unsupported player counts, which means those
 * players score nothing but still have the table counted as a game played.
 * That is long-standing behaviour and several historical tables depend on it,
 * so it is preserved deliberately rather than "fixed".
 */
export function pointsForRanking(playerCount: number): readonly number[] {
  switch (playerCount) {
    case 4:
      return [2, 1, -1, -2]
    case 5:
      return [2, 1, 0, -1, -2]
    case 6:
      return [3, 2, 1, -1, -2, -3]
    default:
      return []
  }
}

/**
 * Sum each player's raw scores at one table, rank them, and award points.
 *
 * Ties are broken by ascending player id. That is not a designed rule — it
 * falls out of integer-like object keys iterating in ascending order plus a
 * stable sort — but every historical standing was computed with it, so it is
 * pinned by a test rather than left to chance.
 */
export function computeTableStandings(scores: readonly RawScore[]): TableStanding[] {
  const totals: Record<PlayerId, number> = {}
  for (const score of scores) {
    totals[score.player_id] = (totals[score.player_id] ?? 0) + score.raw_score
  }

  const ranked = Object.entries(totals)
    .map(([playerId, rawTotal]) => ({ playerId: Number(playerId), rawTotal }))
    .sort((a, b) => b.rawTotal - a.rawTotal)

  const points = pointsForRanking(ranked.length)

  return ranked.map((player, index) => ({
    playerId: player.playerId,
    rawTotal: player.rawTotal,
    rank: index,
    points: points[index] ?? 0,
  }))
}

/** Per-table standings, preserving the order the tables were given in. */
export function computeTableResults(tables: readonly TableWithScores[]): TableResult[] {
  return tables.map((table) => ({
    tableId: table.id,
    createdAt: table.created_at,
    standings: computeTableStandings(table.scores),
  }))
}

/**
 * Fold per-table results into overall standings.
 *
 * `gamesPlayed` counts tables the player appeared at, including tables whose
 * player count awarded no points.
 */
export function accumulateLeaderboard(
  results: readonly TableResult[],
): Map<PlayerId, LeaderboardEntry> {
  const entries = new Map<PlayerId, LeaderboardEntry>()

  for (const result of results) {
    for (const standing of result.standings) {
      const entry = entries.get(standing.playerId) ?? {
        playerId: standing.playerId,
        totalPoints: 0,
        gamesPlayed: 0,
      }
      entry.totalPoints += standing.points
      entry.gamesPlayed += 1
      entries.set(standing.playerId, entry)
    }
  }

  return entries
}

/** A player's running total immediately after one table. */
export interface SeriesPoint {
  timestamp: string
  /** Only players who played at this table — absentees are gaps, not zeroes. */
  totals: Map<PlayerId, number>
}

/**
 * Running cumulative totals after each table, in the order given.
 *
 * Each point carries only the players who actually played at that table, so the
 * chart draws gaps rather than flat lines for people who were not there.
 */
export function cumulativeSeries(results: readonly TableResult[]): SeriesPoint[] {
  const running = new Map<PlayerId, number>()

  return results.map((result) => {
    const totals = new Map<PlayerId, number>()
    for (const standing of result.standings) {
      const next = (running.get(standing.playerId) ?? 0) + standing.points
      running.set(standing.playerId, next)
      totals.set(standing.playerId, next)
    }
    return { timestamp: result.createdAt, totals }
  })
}

/**
 * Every round's scores must sum to zero — what one player wins, the others lose.
 * A non-zero sum means someone mistyped, and the score sheet flags it.
 */
export function roundSum(scores: Readonly<Record<PlayerId, number>>): number {
  return Object.values(scores).reduce((total, score) => total + score, 0)
}

export function isRoundBalanced(scores: Readonly<Record<PlayerId, number>>): boolean {
  return roundSum(scores) === 0
}
