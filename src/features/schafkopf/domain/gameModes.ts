/**
 * Schafkopf game modes and how a round's points follow from them. Pure — no
 * I/O, no React, no Supabase.
 *
 * Points are derived here at save time and then stored in round_scores exactly
 * as hand-typed scores always were. Everything downstream (standings, the
 * leaderboard, the chart) keeps reading raw scores and never needs to know which
 * mode produced them. The mode facts are stored alongside for display and
 * statistics, and so a round can be recalculated when a game's tariff changes.
 */

import type { PlayerId } from './scoring'

export const SCORED_MODES = [
  'sauspiel',
  'hochzeit',
  'farbsolo',
  'wenz',
  'geier',
  'farbwenz',
  'farbgeier',
  'bettel',
  'ramsch',
] as const

export type ScoredMode = (typeof SCORED_MODES)[number]
/** `manual` is free entry: the old behaviour, still there for anything unusual. */
export type GameMode = ScoredMode | 'manual'

export const SUITS = ['eichel', 'gras', 'herz', 'schellen'] as const
export type Suit = (typeof SUITS)[number]

export type RoundRole = 'declarer' | 'partner' | 'opponent' | 'sitting_out'

/**
 * team: two against two, everyone wins or loses the same amount.
 * solo: one against three, the declarer settles with each opponent.
 * ramsch: nobody played; the selected player lost (or went Durchmarsch).
 */
export type ModeFamily = 'team' | 'solo' | 'ramsch'

export interface ModeMeta {
  label: string
  family: ModeFamily
  /** required: part of the mode (Farbsolo). optional: recorded for stats only (the called Sau). */
  suit: 'required' | 'optional' | 'none'
  suits: readonly Suit[]
  /** Schneider, Schwarz and Laufende count. Not in Bettel or Ramsch. */
  countsExtras: boolean
  tout: boolean
  sie: boolean
}

export const MODE_META: Readonly<Record<ScoredMode, ModeMeta>> = {
  sauspiel: {
    label: 'Sauspiel',
    family: 'team',
    suit: 'optional',
    // You cannot call the Herz-Sau: Herz is trump.
    suits: ['eichel', 'gras', 'schellen'],
    countsExtras: true,
    tout: false,
    sie: false,
  },
  hochzeit: {
    label: 'Hochzeit',
    family: 'team',
    suit: 'none',
    suits: [],
    countsExtras: true,
    tout: false,
    sie: false,
  },
  farbsolo: {
    label: 'Solo',
    family: 'solo',
    suit: 'required',
    suits: SUITS,
    countsExtras: true,
    tout: true,
    sie: true,
  },
  wenz: {
    label: 'Wenz',
    family: 'solo',
    suit: 'none',
    suits: [],
    countsExtras: true,
    tout: true,
    sie: false,
  },
  geier: {
    label: 'Geier',
    family: 'solo',
    suit: 'none',
    suits: [],
    countsExtras: true,
    tout: true,
    sie: false,
  },
  farbwenz: {
    label: 'Farbwenz',
    family: 'solo',
    suit: 'required',
    suits: SUITS,
    countsExtras: true,
    tout: true,
    sie: false,
  },
  farbgeier: {
    label: 'Farbgeier',
    family: 'solo',
    suit: 'required',
    suits: SUITS,
    countsExtras: true,
    tout: true,
    sie: false,
  },
  bettel: {
    label: 'Bettel',
    family: 'solo',
    suit: 'none',
    suits: [],
    countsExtras: false,
    tout: false,
    sie: false,
  },
  ramsch: {
    label: 'Ramsch',
    family: 'ramsch',
    suit: 'none',
    suits: [],
    countsExtras: false,
    tout: false,
    sie: false,
  },
}

export const MANUAL_LABEL = 'Manuell'

export const SUIT_META: Readonly<Record<Suit, { label: string; symbol: string }>> = {
  eichel: { label: 'Eichel', symbol: '🌰' },
  gras: { label: 'Gras', symbol: '🍀' },
  herz: { label: 'Herz', symbol: '❤️' },
  schellen: { label: 'Schellen', symbol: '🔔' },
}

export function modeLabel(mode: GameMode): string {
  return mode === 'manual' ? MANUAL_LABEL : MODE_META[mode].label
}

// ── Config ──────────────────────────────────────────────────────────────────

// Type aliases rather than interfaces: only those are assignable to the
// generated `Json` type, which is how configs are written to jsonb columns.
export type ModeConfig = {
  enabled: boolean
  tariff: number
  /** Laufende count only from this many upwards. */
  minLaufende: number
}

export type ScoringConfig = {
  version: 1
  modes: Record<ScoredMode, ModeConfig>
  schneider: number
  /** Added on top of Schneider — Schwarz always is Schneider as well. */
  schwarz: number
  /** Per Laufender, once the mode's minimum is reached. */
  laufende: number
  tout: { enabled: boolean; multiplier: number }
  sie: { enabled: boolean; multiplier: number }
  jungfrauMultiplier: number
}

/**
 * The tariff the group has always played, reconstructed from historical rounds
 * (e.g. `180/-60/-60/-60` is a Solo 20 + Schneider 10, doubled by a Kontra).
 * The database seeds the global config with exactly this; keep them in step.
 */
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  version: 1,
  modes: {
    sauspiel: { enabled: true, tariff: 10, minLaufende: 3 },
    hochzeit: { enabled: true, tariff: 10, minLaufende: 3 },
    farbsolo: { enabled: true, tariff: 20, minLaufende: 3 },
    wenz: { enabled: true, tariff: 20, minLaufende: 2 },
    geier: { enabled: true, tariff: 20, minLaufende: 2 },
    farbwenz: { enabled: false, tariff: 20, minLaufende: 3 },
    farbgeier: { enabled: false, tariff: 20, minLaufende: 3 },
    bettel: { enabled: false, tariff: 20, minLaufende: 3 },
    ramsch: { enabled: true, tariff: 10, minLaufende: 3 },
  },
  schneider: 10,
  schwarz: 10,
  laufende: 10,
  tout: { enabled: true, multiplier: 2 },
  sie: { enabled: false, multiplier: 4 },
  jungfrauMultiplier: 2,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function amount(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/**
 * Reads a stored config, filling anything missing or malformed from the
 * defaults. Configs are jsonb and written by every client version there has
 * ever been, so a mode added later must not break a game created before it.
 */
export function parseScoringConfig(json: unknown): ScoringConfig {
  const source = isRecord(json) ? json : {}
  const modes = isRecord(source.modes) ? source.modes : {}
  const tout = isRecord(source.tout) ? source.tout : {}
  const sie = isRecord(source.sie) ? source.sie : {}
  const d = DEFAULT_SCORING_CONFIG

  const parsedModes = {} as Record<ScoredMode, ModeConfig>
  for (const mode of SCORED_MODES) {
    const stored = isRecord(modes[mode]) ? modes[mode] : {}
    parsedModes[mode] = {
      enabled: flag(stored.enabled, d.modes[mode].enabled),
      tariff: amount(stored.tariff, d.modes[mode].tariff),
      minLaufende: amount(stored.minLaufende, d.modes[mode].minLaufende),
    }
  }

  return {
    version: 1,
    modes: parsedModes,
    schneider: amount(source.schneider, d.schneider),
    schwarz: amount(source.schwarz, d.schwarz),
    laufende: amount(source.laufende, d.laufende),
    tout: {
      enabled: flag(tout.enabled, d.tout.enabled),
      multiplier: amount(tout.multiplier, d.tout.multiplier),
    },
    sie: {
      enabled: flag(sie.enabled, d.sie.enabled),
      multiplier: amount(sie.multiplier, d.sie.multiplier),
    },
    jungfrauMultiplier: amount(source.jungfrauMultiplier, d.jungfrauMultiplier),
  }
}

// ── Rounds ──────────────────────────────────────────────────────────────────

/** Everything the round editor collects. */
export interface RoundInput {
  mode: GameMode
  suit: Suit | null
  /** Exactly four for scored modes; the rest of the table sat out. */
  activePlayerIds: PlayerId[]
  /** The player who played — or, in Ramsch, the loser / Durchmarsch player. */
  declarerId: PlayerId | null
  partnerId: PlayerId | null
  won: boolean
  schneider: boolean
  schwarz: boolean
  laufende: number
  klopfer: number
  kontra: boolean
  re: boolean
  tout: boolean
  sie: boolean
  jungfrau: boolean
  durchmarsch: boolean
  /** Manual mode only: typed scores for every player at the table. */
  manualScores: Record<PlayerId, number>
}

export function emptyRoundInput(mode: GameMode, activePlayerIds: PlayerId[]): RoundInput {
  return {
    mode,
    suit: null,
    activePlayerIds,
    declarerId: null,
    partnerId: null,
    won: true,
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
    manualScores: {},
  }
}

/**
 * The facts of a round as stored on the Rounds row. Column names match the
 * database so these can be written and read without mapping.
 */
export interface RoundFacts {
  game_mode: GameMode | null
  suit: Suit | null
  declarer_won: boolean | null
  schneider: boolean
  schwarz: boolean
  laufende: number
  klopfer: number
  kontra: boolean
  re: boolean
  tout: boolean
  sie: boolean
  jungfrau: boolean
  durchmarsch: boolean
}

export interface StoredScore {
  player_id: PlayerId
  raw_score: number
  role: RoundRole | null
}

export interface BreakdownPart {
  label: string
  value: number
}

export interface Breakdown {
  parts: BreakdownPart[]
  /** Each doubling or multiplier that applied, in order. */
  multipliers: { label: string; factor: number }[]
  /** What one opponent pays or receives. */
  value: number
  /** What the declarer's side gets per player: `value`, or 3 × `value` in a solo. */
  declarerValue: number
}

export type RoundEvaluation =
  | {
      ok: true
      scores: Record<PlayerId, number>
      roles: Record<PlayerId, RoundRole | null>
      facts: RoundFacts
      breakdown: Breakdown | null
    }
  | { ok: false; error: string }

const MAX_LAUFENDE = 14

/** Why a round cannot be saved yet, or null if it can. */
export function validateRoundInput(input: RoundInput, allPlayerIds: PlayerId[]): string | null {
  if (input.mode === 'manual') {
    const sum = allPlayerIds.reduce((total, id) => total + (input.manualScores[id] ?? 0), 0)
    return sum === 0 ? null : `Summe ist ${sum > 0 ? '+' : ''}${sum} – muss 0 sein`
  }

  const meta = MODE_META[input.mode]
  const active = new Set(input.activePlayerIds)

  if (active.size !== 4 || input.activePlayerIds.some((id) => !allPlayerIds.includes(id))) {
    return allPlayerIds.length > 4
      ? `Genau ${allPlayerIds.length - 4} ${allPlayerIds.length - 4 === 1 ? 'Spieler setzt' : 'Spieler setzen'} aus`
      : 'Es braucht genau 4 Spieler'
  }
  if (meta.suit === 'required' && !input.suit) return 'Farbe wählen'
  // A suit on a mode without one is dropped by toRoundFacts, not an error.
  if (meta.suit !== 'none' && input.suit && !meta.suits.includes(input.suit)) {
    return 'Diese Farbe passt nicht zum Spiel'
  }
  if (input.declarerId === null || !active.has(input.declarerId)) {
    return input.mode === 'ramsch'
      ? input.durchmarsch
        ? 'Wer ist durchmarschiert?'
        : 'Wer hat verloren?'
      : 'Wer hat gespielt?'
  }
  if (meta.family === 'team') {
    if (input.partnerId === null || !active.has(input.partnerId)) return 'Mitspieler wählen'
    if (input.partnerId === input.declarerId) return 'Mitspieler muss jemand anderes sein'
  }
  if (input.schwarz && !input.schneider) return 'Schwarz ist immer auch Schneider'
  if (input.re && !input.kontra) return 'Re gibt es nur nach Kontra'
  if (!Number.isInteger(input.laufende) || input.laufende < 0 || input.laufende > MAX_LAUFENDE) {
    return 'Ungültige Anzahl Laufende'
  }
  if (!Number.isInteger(input.klopfer) || input.klopfer < 0 || input.klopfer > 4) {
    return 'Ungültige Anzahl Klopfer'
  }
  return null
}

/**
 * The facts to store for an input. Anything that does not apply to the mode is
 * normalised away, so a stale toggle left over from switching modes in the
 * editor never ends up in the statistics.
 */
export function toRoundFacts(input: RoundInput): RoundFacts {
  if (input.mode === 'manual') {
    return {
      game_mode: 'manual',
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
  }

  const meta = MODE_META[input.mode]
  const isRamsch = meta.family === 'ramsch'
  return {
    game_mode: input.mode,
    suit: meta.suit === 'none' ? null : input.suit,
    declarer_won: isRamsch ? input.durchmarsch : input.won,
    schneider: meta.countsExtras && input.schneider,
    schwarz: meta.countsExtras && input.schneider && input.schwarz,
    laufende: meta.countsExtras ? input.laufende : 0,
    klopfer: input.klopfer,
    kontra: !isRamsch && input.kontra,
    re: !isRamsch && input.kontra && input.re,
    tout: meta.tout && input.tout,
    sie: meta.sie && input.sie,
    jungfrau: isRamsch && !input.durchmarsch && input.jungfrau,
    durchmarsch: isRamsch && input.durchmarsch,
  }
}

/**
 * Validates a round and works out every player's score.
 *
 * Every successful result sums to zero, and sitting-out players always get 0.
 * Modes are scored even if the config has since disabled them, so an old round
 * can still be edited or recalculated.
 */
export function evaluateRound(
  input: RoundInput,
  config: ScoringConfig,
  allPlayerIds: PlayerId[],
): RoundEvaluation {
  const error = validateRoundInput(input, allPlayerIds)
  if (error) return { ok: false, error }

  const facts = toRoundFacts(input)

  if (input.mode === 'manual') {
    const scores: Record<PlayerId, number> = {}
    const roles: Record<PlayerId, RoundRole | null> = {}
    for (const id of allPlayerIds) {
      scores[id] = input.manualScores[id] ?? 0
      roles[id] = null
    }
    return { ok: true, scores, roles, facts, breakdown: null }
  }

  const mode = input.mode
  const meta = MODE_META[mode]
  const modeConfig = config.modes[mode]
  const parts: BreakdownPart[] = [{ label: meta.label, value: modeConfig.tariff }]
  const multipliers: Breakdown['multipliers'] = []

  if (facts.schneider) parts.push({ label: 'Schneider', value: config.schneider })
  if (facts.schwarz) parts.push({ label: 'Schwarz', value: config.schwarz })
  if (facts.laufende > 0 && facts.laufende >= modeConfig.minLaufende) {
    parts.push({ label: `${facts.laufende} Laufende`, value: facts.laufende * config.laufende })
  }

  if (facts.klopfer > 0) {
    multipliers.push({
      label: facts.klopfer === 1 ? 'Klopfer' : `${facts.klopfer} Klopfer`,
      factor: 2 ** facts.klopfer,
    })
  }
  if (facts.kontra) multipliers.push({ label: 'Kontra', factor: 2 })
  if (facts.re) multipliers.push({ label: 'Re', factor: 2 })
  if (facts.tout) multipliers.push({ label: 'Tout', factor: config.tout.multiplier })
  if (facts.sie) multipliers.push({ label: 'Sie', factor: config.sie.multiplier })
  if (facts.jungfrau) multipliers.push({ label: 'Jungfrau', factor: config.jungfrauMultiplier })

  const base = parts.reduce((total, part) => total + part.value, 0)
  const value = multipliers.reduce((total, m) => total * m.factor, base)
  const declarerValue = meta.family === 'team' ? value : 3 * value

  // Positive when the declarer's side gains. In Ramsch the selected player is
  // the loser unless they went Durchmarsch.
  const declarerSign = (meta.family === 'ramsch' ? input.durchmarsch : input.won) ? 1 : -1

  const active = new Set(input.activePlayerIds)
  const scores: Record<PlayerId, number> = {}
  const roles: Record<PlayerId, RoundRole | null> = {}
  for (const id of allPlayerIds) {
    if (!active.has(id)) {
      scores[id] = 0
      roles[id] = 'sitting_out'
    } else if (id === input.declarerId) {
      scores[id] = declarerSign * declarerValue
      roles[id] = 'declarer'
    } else if (meta.family === 'team' && id === input.partnerId) {
      scores[id] = declarerSign * value
      roles[id] = 'partner'
    } else {
      scores[id] = -declarerSign * value
      roles[id] = 'opponent'
    }
  }

  return {
    ok: true,
    scores,
    roles,
    facts,
    breakdown: { parts, multipliers, value, declarerValue },
  }
}

/**
 * Rebuilds the editor input for a stored round. Legacy rounds (no mode) open as
 * manual rounds with their existing scores.
 */
export function roundInputFromStored(
  facts: RoundFacts,
  scores: readonly StoredScore[],
  allPlayerIds: PlayerId[],
): RoundInput {
  const mode: GameMode = facts.game_mode ?? 'manual'
  if (mode === 'manual') {
    const input = emptyRoundInput('manual', allPlayerIds.slice())
    for (const score of scores) input.manualScores[score.player_id] = score.raw_score
    return input
  }

  const roleOf = (role: RoundRole) => scores.find((s) => s.role === role)?.player_id ?? null
  const isRamsch = MODE_META[mode].family === 'ramsch'
  return {
    mode,
    suit: facts.suit,
    activePlayerIds: allPlayerIds.filter((id) => {
      const role = scores.find((s) => s.player_id === id)?.role
      return role !== 'sitting_out' && role != null
    }),
    declarerId: roleOf('declarer'),
    partnerId: roleOf('partner'),
    won: isRamsch ? true : (facts.declarer_won ?? true),
    schneider: facts.schneider,
    schwarz: facts.schwarz,
    laufende: facts.laufende,
    klopfer: facts.klopfer,
    kontra: facts.kontra,
    re: facts.re,
    tout: facts.tout,
    sie: facts.sie,
    jungfrau: facts.jungfrau,
    durchmarsch: facts.durchmarsch,
    manualScores: {},
  }
}

export interface StoredRound extends RoundFacts {
  id: number
  scores: StoredScore[]
}

export interface RecalculatedRound {
  roundId: number
  scores: { player_id: PlayerId; raw_score: number; role: RoundRole | null }[]
}

/**
 * The rounds whose scores change under a new config, with their new scores.
 * Manual and legacy rounds are typed numbers, not derived ones, so they are
 * never touched.
 */
export function recalculateRounds(
  rounds: readonly StoredRound[],
  config: ScoringConfig,
  allPlayerIds: PlayerId[],
): RecalculatedRound[] {
  const changed: RecalculatedRound[] = []
  for (const round of rounds) {
    if (round.game_mode == null || round.game_mode === 'manual') continue
    const input = roundInputFromStored(round, round.scores, allPlayerIds)
    const result = evaluateRound(input, config, allPlayerIds)
    if (!result.ok) continue

    const differs = allPlayerIds.some((id) => {
      const stored = round.scores.find((s) => s.player_id === id)?.raw_score ?? 0
      return stored !== result.scores[id]
    })
    if (!differs) continue

    changed.push({
      roundId: round.id,
      scores: allPlayerIds.map((id) => ({
        player_id: id,
        raw_score: result.scores[id],
        role: result.roles[id],
      })),
    })
  }
  return changed
}

/**
 * Who should sit out next, at tables with more than four players. The dealer
 * sits out and the deal passes on, so each previous sitter moves one seat along
 * (in column order). Falls back to the first players when there is nothing to
 * rotate from, or when the table size changed since.
 */
export function suggestSittingOut(
  playerIds: PlayerId[],
  previousSittingOut: readonly PlayerId[] | null,
): PlayerId[] {
  const count = playerIds.length - 4
  if (count <= 0) return []

  if (previousSittingOut && previousSittingOut.length === count) {
    const indices = previousSittingOut.map((id) => playerIds.indexOf(id))
    if (indices.every((index) => index >= 0)) {
      const next = indices.map((index) => playerIds[(index + 1) % playerIds.length])
      if (new Set(next).size === count) return next
    }
  }
  return playerIds.slice(0, count)
}

/** Short label for a stored round, e.g. "Solo ❤️ · Tout". */
export function describeRound(facts: RoundFacts): string | null {
  if (facts.game_mode == null) return null
  if (facts.game_mode === 'manual') return MANUAL_LABEL
  const pieces = [modeLabel(facts.game_mode)]
  if (facts.suit) pieces[0] += ` ${SUIT_META[facts.suit].symbol}`
  if (facts.tout) pieces.push('Tout')
  if (facts.sie) pieces.push('Sie')
  if (facts.durchmarsch) pieces.push('Durchmarsch')
  return pieces.join(' · ')
}

/** The extras worth showing next to a stored round, e.g. ["Schneider", "Kontra"]. */
export function describeExtras(facts: RoundFacts): string[] {
  const extras: string[] = []
  if (facts.schwarz) extras.push('Schwarz')
  else if (facts.schneider) extras.push('Schneider')
  if (facts.laufende > 0) extras.push(`${facts.laufende} Laufende`)
  if (facts.klopfer > 0) extras.push(facts.klopfer === 1 ? 'Klopfer' : `${facts.klopfer}× Klopfer`)
  if (facts.re) extras.push('Re')
  else if (facts.kontra) extras.push('Kontra')
  if (facts.jungfrau) extras.push('Jungfrau')
  return extras
}

/** Modes offered in the editor: the enabled ones, plus `keep` if it was disabled since. */
export function availableModes(config: ScoringConfig, keep?: GameMode): ScoredMode[] {
  return SCORED_MODES.filter((mode) => config.modes[mode].enabled || mode === keep)
}

/**
 * The editor's starting point for a new round. Sauspiel is by far the most
 * common game, so it is pre-selected rather than repeating the last mode — a
 * forgotten switch back from a Solo would silently triple the stakes.
 */
export function newRoundInput(
  config: ScoringConfig,
  playerIds: PlayerId[],
  previousSittingOut: readonly PlayerId[] | null,
): RoundInput {
  const enabled = availableModes(config)
  const mode: GameMode = enabled.includes('sauspiel') ? 'sauspiel' : (enabled[0] ?? 'manual')
  const sittingOut = suggestSittingOut(playerIds, previousSittingOut)
  return emptyRoundInput(
    mode,
    playerIds.filter((id) => !sittingOut.includes(id)),
  )
}
