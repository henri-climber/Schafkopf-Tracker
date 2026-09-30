import { describe, expect, it } from 'vitest'
import {
  classifyShape,
  filterTables,
  selectRounds,
  toStatRound,
  toStatTables,
  type StatsFilters,
} from './normalize'
import { legacy, mode, table } from './fixtures.test-utils'

describe('classifyShape', () => {
  it('reads team games, won solos and single losses from the score pattern', () => {
    expect(classifyShape([10, 10, -10, -10])).toBe('team')
    expect(classifyShape([60, -20, -20, -20])).toBe('soloWon')
    expect(classifyShape([-60, 20, 20, 20])).toBe('singleLoss')
  })

  it('ignores sitters at bigger tables', () => {
    expect(classifyShape([10, 0, 10, -10, -10])).toBe('team')
    expect(classifyShape([0, 60, -20, -20, -20])).toBe('soloWon')
  })

  it('returns null for empty rounds and other for irregular ones', () => {
    expect(classifyShape([0, 0, 0, 0])).toBeNull()
    expect(classifyShape([30, 10, -20, -20])).toBe('team')
    expect(classifyShape([20, 20, 20, -30, -30])).toBe('other')
    expect(classifyShape([-10, 10, 0, 0])).toBe('other')
  })
})

describe('toStatRound', () => {
  it('drops empty legacy rounds', () => {
    expect(toStatRound(1, legacy([1, 0], [2, 0], [3, 0], [4, 0]))).toBeNull()
  })

  it('finds the lone player of a legacy solo', () => {
    const won = toStatRound(1, legacy([1, -20], [2, 60], [3, -20], [4, -20]))!
    expect(won.shape).toBe('soloWon')
    expect(won.soloPlayerId).toBe(2)
    expect(won.source).toBe('legacy')
    expect(won.stake).toBe(60)

    const lost = toStatRound(1, legacy([1, 20], [2, 20], [3, -60], [4, 20], [5, 0]))!
    expect(lost.shape).toBe('singleLoss')
    expect(lost.soloPlayerId).toBe(3)
    expect(lost.seats.find((s) => s.playerId === 5)!.side).toBe('out')
  })

  it('derives sides from roles for mode rounds', () => {
    const round = toStatRound(
      1,
      mode(
        'sauspiel',
        [
          [1, -20, 'declarer'],
          [2, -20, 'partner'],
          [3, 20, 'opponent'],
          [4, 20, 'opponent'],
          [5, 0, 'sitting_out'],
        ],
        { kontra: true },
      ),
    )!
    expect(round.source).toBe('mode')
    expect(round.shape).toBe('team')
    expect(round.facts?.kontra).toBe(true)
    expect(round.seats.map((s) => s.side)).toEqual(['down', 'down', 'up', 'up', 'out'])
  })

  it('treats a Ramsch loser as a single loss and a Durchmarsch as a won solo', () => {
    const lost = toStatRound(
      1,
      mode('ramsch', [
        [1, -30, 'declarer'],
        [2, 10, 'opponent'],
        [3, 10, 'opponent'],
        [4, 10, 'opponent'],
      ]),
    )!
    expect(lost.shape).toBe('singleLoss')
    expect(lost.soloPlayerId).toBe(1)
    expect(lost.seats[0].side).toBe('down')

    const durchmarsch = toStatRound(
      1,
      mode(
        'ramsch',
        [
          [1, 30, 'declarer'],
          [2, -10, 'opponent'],
          [3, -10, 'opponent'],
          [4, -10, 'opponent'],
        ],
        { durchmarsch: true, declarer_won: true },
      ),
    )!
    expect(durchmarsch.shape).toBe('soloWon')
    expect(durchmarsch.seats[0].side).toBe('up')
  })

  it('treats manual rounds like legacy ones', () => {
    const raw = legacy([1, 10], [2, 10], [3, -10], [4, -10])
    const round = toStatRound(1, { ...raw, game_mode: 'manual' })!
    expect(round.source).toBe('legacy')
    expect(round.shape).toBe('team')
  })
})

describe('toStatTables', () => {
  it('orders tables chronologically and keeps leaderboard standings', () => {
    const tables = toStatTables([
      table(2, [legacy([1, 10], [2, 10], [3, -10], [4, -10])]),
      table(1, [
        legacy([1, 0], [2, 0], [3, 0], [4, 0]),
        legacy([1, -60], [2, 20], [3, 20], [4, 20]),
      ]),
    ])
    expect(tables.map((t) => t.id)).toEqual([1, 2])
    // The empty round is dropped from the rounds but the standings are untouched.
    expect(tables[0].rounds).toHaveLength(1)
    expect(tables[0].standings.map((s) => s.playerId)).toEqual([2, 3, 4, 1])
  })
})

describe('filters', () => {
  const tables = toStatTables([
    table(1, [legacy([1, 10], [2, 10], [3, -10], [4, -10])]),
    table(2, [legacy([1, 10], [2, 10], [3, -10], [4, -10])], { exclude_from_overall: true }),
    table(3, [legacy([1, 10], [2, 10], [3, -10], [4, -10])], { is_open: true }),
    table(4, [
      legacy([1, 10], [2, 10], [3, -10], [4, -10]),
      mode('farbsolo', [
        [1, 60, 'declarer'],
        [2, -20, 'opponent'],
        [3, -20, 'opponent'],
        [4, -20, 'opponent'],
      ]),
    ]),
  ])

  const ids = (filters: StatsFilters) => filterTables(tables, filters).map((t) => t.id)

  it('selects ranked and finished tables by default', () => {
    expect(ids({ rankedOnly: true, includeOngoing: false, source: 'all' })).toEqual([1, 4])
    expect(ids({ rankedOnly: false, includeOngoing: false, source: 'all' })).toEqual([1, 2, 4])
    expect(ids({ rankedOnly: true, includeOngoing: true, source: 'all' })).toEqual([1, 3, 4])
  })

  it('selects rounds by source', () => {
    const selected = filterTables(tables, {
      rankedOnly: true,
      includeOngoing: false,
      source: 'all',
    })
    expect(selectRounds(selected, 'all')).toHaveLength(3)
    expect(selectRounds(selected, 'legacy')).toHaveLength(2)
    expect(selectRounds(selected, 'mode').map((r) => r.mode)).toEqual(['farbsolo'])
  })
})
