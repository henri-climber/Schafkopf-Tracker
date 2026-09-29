import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SCORING_CONFIG,
  SCORED_MODES,
  describeExtras,
  describeRound,
  emptyRoundInput,
  evaluateRound,
  newRoundInput,
  parseScoringConfig,
  recalculateRounds,
  roundInputFromStored,
  suggestSittingOut,
  toRoundFacts,
  type RoundInput,
  type ScoredMode,
  type ScoringConfig,
  type StoredRound,
} from './gameModes'
import gameModesMigration from '../../../../supabase/migrations/20260927202130_add_game_modes.sql?raw'

const FOUR = [1, 2, 3, 4]
const config = DEFAULT_SCORING_CONFIG

function input(mode: RoundInput['mode'], patch: Partial<RoundInput> = {}): RoundInput {
  return { ...emptyRoundInput(mode, FOUR), declarerId: 1, ...patch }
}

/** Scores in player order, which reads like a row of the score sheet. */
function scoresOf(result: ReturnType<typeof evaluateRound>, players = FOUR): number[] {
  if (!result.ok) throw new Error(result.error)
  return players.map((id) => result.scores[id])
}

describe('evaluateRound — team games', () => {
  it('pays the plain Sauspiel tariff both ways', () => {
    expect(scoresOf(evaluateRound(input('sauspiel', { partnerId: 3 }), config, FOUR))).toEqual([
      10, -10, 10, -10,
    ])
    expect(
      scoresOf(evaluateRound(input('sauspiel', { partnerId: 3, won: false }), config, FOUR)),
    ).toEqual([-10, 10, -10, 10])
  })

  it('requires a partner who is someone else', () => {
    expect(evaluateRound(input('sauspiel'), config, FOUR)).toEqual({
      ok: false,
      error: 'Mitspieler wählen',
    })
    expect(evaluateRound(input('sauspiel', { partnerId: 1 }), config, FOUR).ok).toBe(false)
  })

  it('scores a Hochzeit like a Sauspiel', () => {
    expect(scoresOf(evaluateRound(input('hochzeit', { partnerId: 2 }), config, FOUR))).toEqual([
      10, 10, -10, -10,
    ])
  })

  it('does not accept the Herz-Sau as the called ace', () => {
    expect(evaluateRound(input('sauspiel', { partnerId: 2, suit: 'herz' }), config, FOUR).ok).toBe(
      false,
    )
  })
})

describe('evaluateRound — solos', () => {
  it('reproduces the historical Solo + Schneider + Kontra pattern', () => {
    const result = evaluateRound(
      input('farbsolo', { suit: 'herz', schneider: true, kontra: true }),
      config,
      FOUR,
    )
    expect(scoresOf(result)).toEqual([180, -60, -60, -60])
  })

  it('makes the soloist pay three times when lost', () => {
    expect(
      scoresOf(evaluateRound(input('wenz', { declarerId: 2, won: false }), config, FOUR)),
    ).toEqual([20, -60, 20, 20])
  })

  it('requires a suit for a Farbsolo', () => {
    expect(evaluateRound(input('farbsolo'), config, FOUR)).toEqual({
      ok: false,
      error: 'Farbe wählen',
    })
  })

  it('counts Laufende only from the mode’s minimum', () => {
    // Wenz counts from 2: 20 + 2×10 = 40.
    expect(scoresOf(evaluateRound(input('wenz', { laufende: 2 }), config, FOUR))[1]).toBe(-40)
    // Sauspiel counts from 3, so 2 Laufende are worth nothing.
    expect(
      scoresOf(evaluateRound(input('sauspiel', { partnerId: 2, laufende: 2 }), config, FOUR))[0],
    ).toBe(10)
    expect(
      scoresOf(evaluateRound(input('sauspiel', { partnerId: 2, laufende: 3 }), config, FOUR))[0],
    ).toBe(40)
  })

  it('adds Schwarz on top of Schneider and refuses Schwarz alone', () => {
    const result = evaluateRound(
      input('farbsolo', { suit: 'eichel', schneider: true, schwarz: true }),
      config,
      FOUR,
    )
    expect(scoresOf(result)).toEqual([120, -40, -40, -40])
    expect(evaluateRound(input('wenz', { schwarz: true }), config, FOUR).ok).toBe(false)
  })

  it('doubles for every Klopfer, Kontra and Re', () => {
    const result = evaluateRound(
      input('geier', { klopfer: 2, kontra: true, re: true }),
      config,
      FOUR,
    )
    // 20 × 2² × 2 × 2 = 320 per opponent.
    expect(scoresOf(result)).toEqual([960, -320, -320, -320])
    expect(evaluateRound(input('geier', { re: true }), config, FOUR).ok).toBe(false)
  })

  it('applies the Tout and Sie multipliers', () => {
    expect(scoresOf(evaluateRound(input('wenz', { tout: true }), config, FOUR))).toEqual([
      120, -40, -40, -40,
    ])
    expect(
      scoresOf(evaluateRound(input('farbsolo', { suit: 'gras', sie: true }), config, FOUR)),
    ).toEqual([240, -80, -80, -80])
  })

  it('ignores Schneider and Laufende in a Bettel', () => {
    const result = evaluateRound(input('bettel', { schneider: true, laufende: 5 }), config, FOUR)
    expect(scoresOf(result)).toEqual([60, -20, -20, -20])
  })

  it('explains the calculation', () => {
    const result = evaluateRound(
      input('farbsolo', { suit: 'herz', schneider: true, kontra: true }),
      config,
      FOUR,
    )
    if (!result.ok) throw new Error(result.error)
    expect(result.breakdown).toEqual({
      parts: [
        { label: 'Solo', value: 20 },
        { label: 'Schneider', value: 10 },
      ],
      multipliers: [{ label: 'Kontra', factor: 2 }],
      value: 60,
      declarerValue: 180,
    })
  })
})

describe('evaluateRound — Ramsch', () => {
  it('makes the loser pay everyone', () => {
    expect(scoresOf(evaluateRound(input('ramsch', { declarerId: 4 }), config, FOUR))).toEqual([
      10, 10, 10, -30,
    ])
  })

  it('doubles for a Jungfrau and for Klopfer', () => {
    expect(
      scoresOf(
        evaluateRound(input('ramsch', { declarerId: 4, jungfrau: true, klopfer: 1 }), config, FOUR),
      ),
    ).toEqual([40, 40, 40, -120])
  })

  it('pays out a Durchmarsch to the player who made it', () => {
    const result = evaluateRound(input('ramsch', { durchmarsch: true }), config, FOUR)
    expect(scoresOf(result)).toEqual([30, -10, -10, -10])
    expect(result.ok && result.facts.declarer_won).toBe(true)
  })

  it('never stores Kontra or a Jungfrau that does not apply', () => {
    const facts = toRoundFacts(
      input('ramsch', { kontra: true, re: true, durchmarsch: true, jungfrau: true }),
    )
    expect(facts).toMatchObject({ kontra: false, re: false, jungfrau: false, durchmarsch: true })
  })
})

describe('evaluateRound — bigger tables', () => {
  const FIVE = [1, 2, 3, 4, 5]
  const SIX = [1, 2, 3, 4, 5, 6]

  it('gives sitting-out players nothing', () => {
    const result = evaluateRound(
      { ...input('farbsolo', { suit: 'herz' }), activePlayerIds: [1, 2, 3, 5] },
      config,
      FIVE,
    )
    expect(scoresOf(result, FIVE)).toEqual([60, -20, -20, 0, -20])
    expect(result.ok && result.roles[4]).toBe('sitting_out')
  })

  it('requires exactly four active players', () => {
    expect(evaluateRound(input('wenz'), config, FIVE).ok).toBe(true)
    expect(evaluateRound({ ...input('wenz'), activePlayerIds: SIX }, config, SIX)).toEqual({
      ok: false,
      error: 'Genau 2 Spieler setzen aus',
    })
  })

  it('refuses a declarer who sat out', () => {
    expect(evaluateRound({ ...input('wenz', { declarerId: 5 }) }, config, FIVE).ok).toBe(false)
  })
})

describe('evaluateRound — every mode balances', () => {
  const everything: Partial<RoundInput> = {
    partnerId: 2,
    suit: 'eichel',
    schneider: true,
    schwarz: true,
    laufende: 4,
    klopfer: 1,
    kontra: true,
    re: true,
  }

  it.each(SCORED_MODES)('%s sums to zero, won and lost', (mode: ScoredMode) => {
    for (const won of [true, false]) {
      const result = evaluateRound(
        { ...input(mode, { ...everything, won }), activePlayerIds: [1, 2, 3, 5] },
        config,
        [1, 2, 3, 4, 5],
      )
      if (!result.ok) throw new Error(`${mode}: ${result.error}`)
      expect(Object.values(result.scores).reduce((a, b) => a + b, 0)).toBe(0)
    }
  })
})

describe('evaluateRound — manual', () => {
  it('keeps typed scores and requires them to balance', () => {
    const manual = { ...emptyRoundInput('manual', FOUR), manualScores: { 1: 50, 2: -50 } }
    expect(scoresOf(evaluateRound(manual, config, FOUR))).toEqual([50, -50, 0, 0])
    expect(evaluateRound({ ...manual, manualScores: { 1: 50 } }, config, FOUR)).toEqual({
      ok: false,
      error: 'Summe ist +50 – muss 0 sein',
    })
  })
})

describe('DEFAULT_SCORING_CONFIG', () => {
  it('matches the global config the database was seeded with', () => {
    const seed = gameModesMigration.split('$config$')[1]
    expect(JSON.parse(seed)).toEqual(DEFAULT_SCORING_CONFIG)
  })
})

describe('parseScoringConfig', () => {
  it('returns the defaults for anything unreadable', () => {
    expect(parseScoringConfig(null)).toEqual(DEFAULT_SCORING_CONFIG)
    expect(parseScoringConfig('nope')).toEqual(DEFAULT_SCORING_CONFIG)
    expect(parseScoringConfig([])).toEqual(DEFAULT_SCORING_CONFIG)
  })

  it('keeps valid values and fills in the rest', () => {
    const parsed = parseScoringConfig({
      schneider: 20,
      modes: { sauspiel: { tariff: 5 }, bettel: { enabled: true } },
    })
    expect(parsed.schneider).toBe(20)
    expect(parsed.modes.sauspiel).toEqual({ enabled: true, tariff: 5, minLaufende: 3 })
    expect(parsed.modes.bettel.enabled).toBe(true)
    expect(parsed.modes.wenz).toEqual(DEFAULT_SCORING_CONFIG.modes.wenz)
  })

  it('rejects negative, fractional and mistyped values', () => {
    const parsed = parseScoringConfig({ schneider: -5, schwarz: 2.5, laufende: '10' })
    expect(parsed.schneider).toBe(10)
    expect(parsed.schwarz).toBe(10)
    expect(parsed.laufende).toBe(10)
  })
})

describe('suggestSittingOut', () => {
  it('suggests nobody at a table of four', () => {
    expect(suggestSittingOut(FOUR, null)).toEqual([])
  })

  it('passes the deal on by one seat', () => {
    expect(suggestSittingOut([1, 2, 3, 4, 5], [3])).toEqual([4])
    expect(suggestSittingOut([1, 2, 3, 4, 5], [5])).toEqual([1])
    expect(suggestSittingOut([1, 2, 3, 4, 5, 6], [1, 4])).toEqual([2, 5])
  })

  it('starts from the first players when there is nothing to rotate from', () => {
    expect(suggestSittingOut([1, 2, 3, 4, 5], null)).toEqual([1])
    // A player joined, so last round's single sitter no longer fits.
    expect(suggestSittingOut([1, 2, 3, 4, 5, 6], [3])).toEqual([1, 2])
  })
})

describe('stored rounds', () => {
  function stored(id: number, patch: Partial<RoundInput>, players = FOUR): StoredRound {
    const roundInput = { ...input('farbsolo', { suit: 'herz' }), ...patch }
    const result = evaluateRound(roundInput, config, players)
    if (!result.ok) throw new Error(result.error)
    return {
      id,
      ...result.facts,
      scores: players.map((player_id) => ({
        player_id,
        raw_score: result.scores[player_id],
        role: result.roles[player_id],
      })),
    }
  }

  it('round-trips through the editor input', () => {
    const round = stored(1, { schneider: true, laufende: 3, kontra: true })
    const back = roundInputFromStored(round, round.scores, FOUR)
    const result = evaluateRound(back, config, FOUR)
    expect(scoresOf(result)).toEqual(round.scores.map((s) => s.raw_score))
  })

  it('opens legacy rounds as manual rounds', () => {
    const back = roundInputFromStored(
      { ...toRoundFacts(emptyRoundInput('manual', FOUR)), game_mode: null },
      [
        { player_id: 1, raw_score: 20, role: null },
        { player_id: 2, raw_score: -20, role: null },
      ],
      FOUR,
    )
    expect(back.mode).toBe('manual')
    expect(back.manualScores).toEqual({ 1: 20, 2: -20 })
  })

  it('recalculates only derived rounds whose scores change', () => {
    const solo = stored(1, {})
    const sauspiel = stored(2, { mode: 'sauspiel', suit: null, partnerId: 2 })
    const manual: StoredRound = {
      id: 3,
      ...toRoundFacts(emptyRoundInput('manual', FOUR)),
      scores: [
        { player_id: 1, raw_score: 5, role: null },
        { player_id: 2, raw_score: -5, role: null },
      ],
    }
    const cheaperSolos: ScoringConfig = {
      ...config,
      modes: { ...config.modes, farbsolo: { ...config.modes.farbsolo, tariff: 50 } },
    }

    const changed = recalculateRounds([solo, sauspiel, manual], cheaperSolos, FOUR)
    expect(changed).toEqual([
      {
        roundId: 1,
        scores: [
          { player_id: 1, raw_score: 150, role: 'declarer' },
          { player_id: 2, raw_score: -50, role: 'opponent' },
          { player_id: 3, raw_score: -50, role: 'opponent' },
          { player_id: 4, raw_score: -50, role: 'opponent' },
        ],
      },
    ])
  })
})

describe('describeRound', () => {
  it('labels mode, suit and notable extras', () => {
    expect(describeRound(toRoundFacts(input('farbsolo', { suit: 'herz', tout: true })))).toBe(
      'Solo ❤️ · Tout',
    )
    expect(describeRound(toRoundFacts(input('ramsch', { durchmarsch: true })))).toBe(
      'Ramsch · Durchmarsch',
    )
    expect(describeRound({ ...toRoundFacts(input('wenz')), game_mode: null })).toBeNull()
  })
})

describe('newRoundInput', () => {
  it('starts with a Sauspiel and the rotated sit-out', () => {
    const next = newRoundInput(config, [1, 2, 3, 4, 5], [2])
    expect(next.mode).toBe('sauspiel')
    expect(next.activePlayerIds).toEqual([1, 2, 4, 5])
  })

  it('falls back to the first enabled mode', () => {
    const noSauspiel: ScoringConfig = {
      ...config,
      modes: { ...config.modes, sauspiel: { ...config.modes.sauspiel, enabled: false } },
    }
    expect(newRoundInput(noSauspiel, FOUR, null).mode).toBe('hochzeit')
  })
})

describe('describeExtras', () => {
  it('lists what was announced and counted', () => {
    const facts = toRoundFacts(
      input('farbsolo', {
        suit: 'herz',
        schneider: true,
        schwarz: true,
        laufende: 4,
        klopfer: 2,
        kontra: true,
        re: true,
      }),
    )
    expect(describeExtras(facts)).toEqual(['Schwarz', '4 Laufende', '2× Klopfer', 'Re'])
  })
})
