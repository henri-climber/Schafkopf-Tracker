import { describe, expect, it } from 'vitest'
import {
  duos,
  headToHead,
  kontraReStats,
  MIN_PAIR_ROUNDS,
  modeStats,
  nemesisOf,
  opposedRate,
  overview,
  pairKey,
  pairRecords,
  playerStats,
  ramschStats,
  rate,
  tableStats,
} from './aggregate'
import { selectRounds, toStatTables } from './normalize'
import { legacy, mode, table } from './fixtures.test-utils'
import type { RawStatsRound } from './normalize'

function roundsOf(...rounds: RawStatsRound[]) {
  return selectRounds(toStatTables([table(1, rounds)]), 'all')
}

const sauspielWon = (kontra = false, re = false) =>
  mode(
    'sauspiel',
    [
      [1, 10, 'declarer'],
      [2, 10, 'partner'],
      [3, -10, 'opponent'],
      [4, -10, 'opponent'],
    ],
    { kontra, re, suit: 'eichel' },
  )

const sauspielLost = (kontra = false) =>
  mode(
    'sauspiel',
    [
      [1, -10, 'declarer'],
      [2, -10, 'partner'],
      [3, 10, 'opponent'],
      [4, 10, 'opponent'],
    ],
    { kontra, suit: 'gras' },
  )

const soloBy = (player: number, won: boolean, extras = {}) =>
  mode(
    'farbsolo',
    [1, 2, 3, 4].map((id) =>
      id === player ? [id, won ? 60 : -60, 'declarer'] : [id, won ? -20 : 20, 'opponent'],
    ) as [number, number, 'declarer' | 'opponent'][],
    { suit: 'herz', ...extras },
  )

const ramschLostBy = (player: number) =>
  mode(
    'ramsch',
    [1, 2, 3, 4].map((id) => (id === player ? [id, -30, 'declarer'] : [id, 10, 'opponent'])) as [
      number,
      number,
      'declarer' | 'opponent',
    ][],
  )

describe('rate', () => {
  it('is null without samples', () => {
    expect(rate(0, 0).rate).toBeNull()
    expect(rate(1, 4).rate).toBe(0.25)
  })
})

describe('overview', () => {
  it('counts shapes over legacy and mode rounds alike', () => {
    const o = overview(
      roundsOf(
        legacy([1, 10], [2, 10], [3, -10], [4, -10]),
        legacy([1, 90], [2, -30], [3, -30], [4, -30]),
        sauspielWon(),
        soloBy(2, false),
        ramschLostBy(3),
      ),
    )
    expect(o.rounds).toBe(5)
    expect(o.modeRounds).toBe(3)
    expect(o.shapes).toEqual({ team: 2, soloWon: 1, singleLoss: 2, other: 0 })
    expect(o.families).toEqual({ team: 1, soloWon: 0, soloLost: 1, ramsch: 1 })
    expect(o.biggest?.stake).toBe(90)
    expect(o.players).toBe(4)
  })
})

describe('modeStats', () => {
  it('reports win rates per mode and per suit, skipping legacy rounds', () => {
    const stats = modeStats(
      roundsOf(
        legacy([1, 10], [2, 10], [3, -10], [4, -10]),
        sauspielWon(),
        sauspielWon(),
        sauspielLost(),
        soloBy(1, true, { schneider: true }),
        ramschLostBy(2),
      ),
    )
    expect(stats.total).toBe(5)
    const sauspiel = stats.modes.find((m) => m.mode === 'sauspiel')!
    expect(sauspiel.count).toBe(3)
    expect(sauspiel.declarerWin?.rate).toBeCloseTo(2 / 3)
    expect(sauspiel.avgDeclarerScore).toBe(10)

    const solo = stats.modes.find((m) => m.mode === 'farbsolo')!
    expect(solo.schneider.rate).toBe(1)
    expect(solo.avgDeclarerScore).toBe(60)

    expect(stats.modes.find((m) => m.mode === 'ramsch')!.declarerWin).toBeNull()
    expect(stats.suits).toContainEqual({
      mode: 'sauspiel',
      suit: 'eichel',
      count: 2,
      declarerWin: rate(2, 2),
    })
  })
})

describe('kontraReStats', () => {
  it('scores Kontra by declarer losses and Re by declarer wins', () => {
    const stats = kontraReStats(
      roundsOf(
        sauspielWon(true, true),
        sauspielWon(true),
        sauspielLost(true),
        sauspielLost(true),
        sauspielWon(),
        soloBy(1, false, { kontra: true, klopfer: 1 }),
        ramschLostBy(2),
      ),
    )
    expect(stats.games).toBe(6)
    expect(stats.kontra).toEqual(rate(5, 6))
    // Declarer lost 3 of the 5 Kontra rounds.
    expect(stats.kontraSuccess).toEqual(rate(3, 5))
    expect(stats.re).toEqual(rate(1, 5))
    expect(stats.reSuccess).toEqual(rate(1, 1))
    expect(stats.winWithoutKontra).toEqual(rate(1, 1))
    expect(stats.byFamily.find((f) => f.family === 'solo')!.kontraSuccess).toEqual(rate(1, 1))
    // Ramsch counts towards Klopfer but not towards Kontra.
    expect(stats.klopfer).toEqual(rate(1, 7))
    expect(stats.avgKlopfer).toBe(1)
  })
})

describe('ramschStats', () => {
  it('ranks Ramsch losers', () => {
    const stats = ramschStats(roundsOf(ramschLostBy(2), ramschLostBy(2), ramschLostBy(3)))
    expect(stats.count).toBe(3)
    expect(stats.losers[0]).toMatchObject({ playerId: 2, lost: 2, played: 3 })
    expect(stats.losers.find((l) => l.playerId === 1)!.lost).toBe(0)
  })
})

describe('playerStats', () => {
  const stats = playerStats(
    roundsOf(
      legacy([1, 90], [2, -30], [3, -30], [4, -30]),
      legacy([1, 10], [2, 10], [3, -10], [4, -10], [5, 0]),
      legacy([1, -10], [2, 10], [3, 10], [4, -10], [5, 0]),
      soloBy(1, false),
      sauspielWon(),
      ramschLostBy(1),
    ),
  )
  const one = stats.find((s) => s.playerId === 1)!

  it('counts rounds, wins and points across both sources', () => {
    expect(one.rounds).toBe(6)
    expect(one.won).toEqual(rate(3, 6))
    expect(one.points).toBe(90 + 10 - 10 - 60 + 10 - 30)
    expect(one.best).toBe(90)
    expect(one.worst).toBe(-60)
    expect(one.team).toEqual(rate(2, 3))
  })

  it('counts solos from legacy patterns and roles', () => {
    expect(one.solosWon).toBe(1)
    // The lost solo and the lost Ramsch.
    expect(one.singleLosses).toBe(2)
    expect(one.solos).toEqual(rate(0, 1))
    expect(one.ramschLost).toBe(1)
    expect(one.asDeclarer).toEqual(rate(1, 3))
  })

  it('tracks streaks in play order', () => {
    // won, won, lost, lost, won, lost
    expect(one.longestWinStreak).toBe(2)
    expect(one.longestLossStreak).toBe(2)
  })

  it('counts sitting out separately', () => {
    const five = stats.find((s) => s.playerId === 5)
    expect(five).toBeUndefined()
  })
})

describe('tableStats', () => {
  it('averages the winning total and totals per place over finished tables', () => {
    const tables = toStatTables([
      table(1, [legacy([1, 30], [2, 10], [3, -10], [4, -30])]),
      table(2, [legacy([1, -50], [2, 10], [3, 70], [4, -30])]),
      table(3, [legacy([1, 500], [2, -100], [3, -200], [4, -200])], { is_open: true }),
    ])
    const stats = tableStats(tables)
    expect(stats.tables).toBe(2)
    expect(stats.winnerTotal).toEqual({ avg: 50, min: 30, max: 70 })
    expect(stats.bySize[0]).toEqual({ size: 4, tables: 2, placeAverages: [50, 10, -20, -40] })
    expect(stats.players[0]).toMatchObject({ tables: 2, wins: 1 })
  })
})

describe('pairs', () => {
  it('separates partners from opponents and stays symmetric', () => {
    const records = pairRecords(
      roundsOf(
        legacy([1, 10], [2, 10], [3, -10], [4, -10]),
        legacy([1, -10], [2, -10], [3, 10], [4, 10]),
        legacy([1, 90], [2, -30], [3, -30], [4, -30]),
      ),
    )
    const r12 = records.get(pairKey(2, 1))!
    expect(r12.shared).toBe(3)
    expect(r12.partner).toEqual(rate(1, 2))
    expect(r12.opposed).toBe(1)
    expect(opposedRate(r12, 1)).toEqual(rate(1, 1))
    expect(opposedRate(r12, 2)).toEqual(rate(0, 1))

    // In the solo, 2 and 3 were both opponents: same side, but not partners.
    const r23 = records.get(pairKey(2, 3))!
    expect(r23.partner.n).toBe(0)
    expect(r23.opposed).toBe(2)
  })

  it('picks duos and nemeses only with enough rounds', () => {
    const rounds: RawStatsRound[] = []
    for (let i = 0; i < MIN_PAIR_ROUNDS; i++) {
      rounds.push(legacy([1, 10], [2, 10], [3, -10], [4, -10]))
    }
    const records = pairRecords(roundsOf(...rounds))
    const { best, worst } = duos(records)
    expect(best).toMatchObject({ a: 1, b: 2 })
    expect(worst).toMatchObject({ a: 3, b: 4 })
    expect(nemesisOf(records, 3)?.record.rate).toBe(0)
    expect(duos(pairRecords(roundsOf(rounds[0])))).toEqual({ best: null, worst: null })
  })
})

describe('headToHead', () => {
  it('compares two players across tables and rounds', () => {
    const tables = toStatTables([
      table(1, [
        sauspielWon(),
        sauspielLost(true),
        soloBy(1, true),
        soloBy(3, false),
        legacy([1, -10], [2, 10], [3, 10], [4, -10]),
      ]),
      table(2, [legacy([1, -10], [3, 10], [5, 10], [6, -10])]),
    ])
    const rounds = selectRounds(tables, 'all')
    const h = headToHead(tables, rounds, 1, 3)
    expect(h.sharedTables).toBe(2)
    expect(h.aAbove + h.bAbove).toBe(2)
    expect(h.record?.shared).toBe(6)
    expect(h.aWithB.n).toBe(0)
    expect(h.aSoloVsB).toEqual(rate(1, 1))
    expect(h.bSoloVsA).toEqual(rate(0, 1))

    const mirrored = headToHead(tables, rounds, 3, 1)
    expect(mirrored.aAbove).toBe(h.bAbove)
    expect(mirrored.aNetOpposed).toBe(h.bNetOpposed)
    expect(mirrored.aSoloVsB).toEqual(h.bSoloVsA)
  })
})
