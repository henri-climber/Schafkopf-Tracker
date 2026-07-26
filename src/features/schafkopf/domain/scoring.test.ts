import { describe, expect, it } from 'vitest'
import {
  accumulateLeaderboard,
  computeTableResults,
  computeTableStandings,
  cumulativeSeries,
  isRoundBalanced,
  pointsForRanking,
  roundSum,
  type RawScore,
} from './scoring'

/** Scores for one round, as `[playerId, score]` pairs. */
function round(...entries: [number, number][]): RawScore[] {
  return entries.map(([player_id, raw_score]) => ({ player_id, raw_score }))
}

describe('pointsForRanking', () => {
  it('awards the agreed points for supported table sizes', () => {
    expect(pointsForRanking(4)).toEqual([2, 1, -1, -2])
    expect(pointsForRanking(5)).toEqual([2, 1, 0, -1, -2])
    expect(pointsForRanking(6)).toEqual([3, 2, 1, -1, -2, -3])
  })

  it('awards nothing for table sizes that are not played', () => {
    expect(pointsForRanking(3)).toEqual([])
    expect(pointsForRanking(7)).toEqual([])
    expect(pointsForRanking(0)).toEqual([])
  })

  it('always distributes zero net points', () => {
    for (const size of [4, 5, 6]) {
      const total = pointsForRanking(size).reduce((sum, points) => sum + points, 0)
      expect(total).toBe(0)
    }
  })
})

describe('computeTableStandings', () => {
  it('sums each player across rounds, ranks them, and awards points', () => {
    const standings = computeTableStandings([
      ...round([1, 60], [2, -20], [3, -20], [4, -20]),
      ...round([1, -30], [2, 90], [3, -30], [4, -30]),
    ])

    expect(standings).toEqual([
      { playerId: 2, rawTotal: 70, rank: 0, points: 2 },
      { playerId: 1, rawTotal: 30, rank: 1, points: 1 },
      { playerId: 3, rawTotal: -50, rank: 2, points: -1 },
      { playerId: 4, rawTotal: -50, rank: 3, points: -2 },
    ])
  })

  it('breaks ties by ascending player id', () => {
    // Not a designed rule — it falls out of key ordering plus a stable sort.
    // Pinned because every historical standing was computed this way; changing
    // it would silently rewrite past semesters.
    const standings = computeTableStandings(round([4, 0], [2, 0], [3, 0], [1, 0]))

    expect(standings.map((s) => s.playerId)).toEqual([1, 2, 3, 4])
    expect(standings.map((s) => s.points)).toEqual([2, 1, -1, -2])
  })

  it('awards no points at an unsupported table size', () => {
    const standings = computeTableStandings(round([1, 20], [2, -10], [3, -10]))

    expect(standings).toHaveLength(3)
    expect(standings.every((s) => s.points === 0)).toBe(true)
  })
})

describe('accumulateLeaderboard', () => {
  it('sums points and counts tables a player appeared at', () => {
    const results = computeTableResults([
      {
        id: 1,
        created_at: '2026-03-01T18:00:00.000Z',
        scores: round([1, 60], [2, -20], [3, -20], [4, -20]),
      },
      // Player 4 sat this one out; player 5 joined.
      {
        id: 2,
        created_at: '2026-03-02T18:00:00.000Z',
        scores: round([1, -30], [2, 90], [3, -30], [5, -30]),
      },
    ])

    const table = accumulateLeaderboard(results)

    expect(table.get(1)).toEqual({ playerId: 1, totalPoints: 2 + 1, gamesPlayed: 2 })
    expect(table.get(2)).toEqual({ playerId: 2, totalPoints: 1 + 2, gamesPlayed: 2 })
    expect(table.get(4)).toEqual({ playerId: 4, totalPoints: -2, gamesPlayed: 1 })
    expect(table.get(5)).toEqual({ playerId: 5, totalPoints: -2, gamesPlayed: 1 })
  })

  it('counts a game played even when the table size awarded no points', () => {
    const results = computeTableResults([
      { id: 1, created_at: '2026-03-01T18:00:00.000Z', scores: round([1, 20], [2, -10], [3, -10]) },
    ])

    expect(accumulateLeaderboard(results).get(1)).toEqual({
      playerId: 1,
      totalPoints: 0,
      gamesPlayed: 1,
    })
  })
})

describe('cumulativeSeries', () => {
  it('accumulates running totals in table order', () => {
    const results = computeTableResults([
      {
        id: 1,
        created_at: '2026-03-01T18:00:00.000Z',
        scores: round([1, 60], [2, -20], [3, -20], [4, -20]),
      },
      {
        id: 2,
        created_at: '2026-03-02T18:00:00.000Z',
        scores: round([1, 60], [2, -20], [3, -20], [4, -20]),
      },
    ])

    const series = cumulativeSeries(results)

    expect(series.map((point) => point.timestamp)).toEqual([
      '2026-03-01T18:00:00.000Z',
      '2026-03-02T18:00:00.000Z',
    ])
    expect(series[0].totals.get(1)).toBe(2)
    expect(series[1].totals.get(1)).toBe(4)
    expect(series[1].totals.get(4)).toBe(-4)
  })

  it('omits players who did not play, so the chart draws a gap not a zero', () => {
    const results = computeTableResults([
      {
        id: 1,
        created_at: '2026-03-01T18:00:00.000Z',
        scores: round([1, 60], [2, -20], [3, -20], [4, -20]),
      },
      {
        id: 2,
        created_at: '2026-03-02T18:00:00.000Z',
        scores: round([1, 60], [2, -20], [3, -20], [5, -20]),
      },
    ])

    const series = cumulativeSeries(results)

    expect(series[1].totals.has(4)).toBe(false)
    // Player 1 keeps accumulating across both tables.
    expect(series[1].totals.get(1)).toBe(4)
  })

  it('agrees with the leaderboard on every final total', () => {
    // The leaderboard is the last value of each player's series — the two
    // views must never disagree.
    const results = computeTableResults([
      {
        id: 1,
        created_at: '2026-03-01T18:00:00.000Z',
        scores: round([1, 60], [2, -20], [3, -20], [4, -20]),
      },
      {
        id: 2,
        created_at: '2026-03-02T18:00:00.000Z',
        scores: round([2, 60], [3, -20], [4, -20], [1, -20]),
      },
      {
        id: 3,
        created_at: '2026-03-03T18:00:00.000Z',
        scores: round([3, 60], [4, -20], [1, -20], [2, -20]),
      },
    ])

    const series = cumulativeSeries(results)
    const finalFromSeries = new Map<number, number>()
    for (const point of series) {
      for (const [playerId, total] of point.totals) finalFromSeries.set(playerId, total)
    }

    for (const [playerId, entry] of accumulateLeaderboard(results)) {
      expect(finalFromSeries.get(playerId)).toBe(entry.totalPoints)
    }
  })
})

describe('roundSum / isRoundBalanced', () => {
  it('accepts a round whose scores cancel out', () => {
    expect(isRoundBalanced({ 1: 60, 2: -20, 3: -20, 4: -20 })).toBe(true)
    expect(roundSum({ 1: 60, 2: -20, 3: -20, 4: -20 })).toBe(0)
  })

  it('rejects a round that does not, and reports by how much', () => {
    expect(isRoundBalanced({ 1: 60, 2: -20, 3: -20, 4: -10 })).toBe(false)
    expect(roundSum({ 1: 60, 2: -20, 3: -20, 4: -10 })).toBe(10)
  })

  it('treats an untouched round as balanced', () => {
    expect(isRoundBalanced({})).toBe(true)
    expect(isRoundBalanced({ 1: 0, 2: 0, 3: 0, 4: 0 })).toBe(true)
  })
})
