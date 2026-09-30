/**
 * Statistics over normalised rounds. Pure — no I/O, no React, no Supabase.
 *
 * Two kinds of functions live here. Score-based ones (overview, players,
 * tables, head-to-head, pairs) work on every round, legacy included, because
 * they only need the `shape` and each player's side. Mode-based ones (modes,
 * Kontra/Re, Ramsch) need the recorded facts and silently skip legacy rounds.
 */

import type { PlayerId } from '../scoring'
import { MODE_META, SUITS, type ModeFamily, type ScoredMode, type Suit } from '../gameModes'
import type { RoundShape, Seat, StatRound, StatTable } from './normalize'

/** Below this many samples a rate is shown greyed out and not used for "best of" picks. */
export const MIN_SAMPLE = 5
/** Pairs need a little more before they are worth ranking. */
export const MIN_PAIR_ROUNDS = 10

export interface Rate {
  hits: number
  n: number
  /** hits / n, or null when there is nothing to divide. */
  rate: number | null
}

export function rate(hits: number, n: number): Rate {
  return { hits, n, rate: n > 0 ? hits / n : null }
}

function average(values: readonly number[]): number | null {
  return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : null
}

function isActive(seat: Seat): boolean {
  return seat.side !== 'out'
}

function seatOf(round: StatRound, playerId: PlayerId): Seat | undefined {
  return round.seats.find((seat) => seat.playerId === playerId)
}

function declarerSeat(round: StatRound): Seat | undefined {
  return round.seats.find((seat) => seat.role === 'declarer')
}

/** Mode rounds only — the ones with recorded facts. */
export function modeRounds(rounds: readonly StatRound[]): StatRound[] {
  return rounds.filter((round) => round.source === 'mode' && round.mode !== null)
}

function declarerWon(round: StatRound): boolean {
  return round.facts?.declarer_won === true
}

// ── Overview ────────────────────────────────────────────────────────────────

export interface Overview {
  rounds: number
  modeRounds: number
  tables: number
  players: number
  /** Points that changed hands, summed over all rounds. */
  totalStake: number
  avgStake: number | null
  biggest: StatRound | null
  shapes: Record<RoundShape, number>
  /** Mode rounds only, where solo losses and Ramsch can be told apart. */
  families: { team: number; soloWon: number; soloLost: number; ramsch: number }
}

export function overview(rounds: readonly StatRound[]): Overview {
  const shapes: Record<RoundShape, number> = { team: 0, soloWon: 0, singleLoss: 0, other: 0 }
  const families = { team: 0, soloWon: 0, soloLost: 0, ramsch: 0 }
  const tables = new Set<number>()
  const players = new Set<PlayerId>()
  let totalStake = 0
  let biggest: StatRound | null = null

  for (const round of rounds) {
    shapes[round.shape] += 1
    tables.add(round.tableId)
    for (const seat of round.seats) if (isActive(seat)) players.add(seat.playerId)
    totalStake += round.stake
    if (!biggest || round.stake > biggest.stake) biggest = round

    if (round.source === 'mode') {
      if (round.family === 'team') families.team += 1
      else if (round.family === 'ramsch') families.ramsch += 1
      else if (declarerWon(round)) families.soloWon += 1
      else families.soloLost += 1
    }
  }

  return {
    rounds: rounds.length,
    modeRounds: modeRounds(rounds).length,
    tables: tables.size,
    players: players.size,
    totalStake,
    avgStake: rounds.length > 0 ? totalStake / rounds.length : null,
    biggest,
    shapes,
    families,
  }
}

// ── Game modes ──────────────────────────────────────────────────────────────

export interface ModeRow {
  mode: ScoredMode
  count: number
  share: number
  /** Null for Ramsch, where nobody declares. */
  declarerWin: Rate | null
  /** What the declarer won or lost, on average. */
  avgDeclarerScore: number | null
  schneider: Rate
  schwarz: Rate
  /** Average Laufende where the mode counts them. */
  avgLaufende: number | null
  tout: number
  /** Null for Ramsch, where there is no Kontra. */
  kontra: Rate | null
}

export interface SuitRow {
  mode: ScoredMode
  suit: Suit
  count: number
  declarerWin: Rate
}

export interface ModeStats {
  total: number
  modes: ModeRow[]
  suits: SuitRow[]
}

export function modeStats(rounds: readonly StatRound[]): ModeStats {
  const scored = modeRounds(rounds)
  const byMode = new Map<ScoredMode, StatRound[]>()
  for (const round of scored) {
    const list = byMode.get(round.mode!) ?? []
    list.push(round)
    byMode.set(round.mode!, list)
  }

  const modes: ModeRow[] = [...byMode.entries()]
    .map(([mode, list]) => {
      const meta = MODE_META[mode]
      const facts = list.map((round) => round.facts!)
      return {
        mode,
        count: list.length,
        share: list.length / scored.length,
        declarerWin:
          meta.family === 'ramsch' ? null : rate(list.filter(declarerWon).length, list.length),
        avgDeclarerScore: average(list.map((round) => Math.abs(declarerSeat(round)?.score ?? 0))),
        schneider: rate(facts.filter((f) => f.schneider).length, list.length),
        schwarz: rate(facts.filter((f) => f.schwarz).length, list.length),
        avgLaufende: meta.countsExtras ? average(facts.map((f) => f.laufende)) : null,
        tout: facts.filter((f) => f.tout).length,
        kontra:
          meta.family === 'ramsch' ? null : rate(facts.filter((f) => f.kontra).length, list.length),
      }
    })
    .sort((a, b) => b.count - a.count)

  const suits: SuitRow[] = []
  for (const [mode, list] of byMode) {
    if (MODE_META[mode].suit === 'none') continue
    for (const suit of SUITS) {
      const withSuit = list.filter((round) => round.facts!.suit === suit)
      if (withSuit.length === 0) continue
      suits.push({
        mode,
        suit,
        count: withSuit.length,
        declarerWin: rate(withSuit.filter(declarerWon).length, withSuit.length),
      })
    }
  }

  return { total: scored.length, modes, suits }
}

// ── Kontra, Re, Klopfer ─────────────────────────────────────────────────────

export interface KontraReStats {
  /** Mode rounds where Kontra was possible (everything but Ramsch). */
  games: number
  kontra: Rate
  /** Kontra paid off: the declarer lost. */
  kontraSuccess: Rate
  /** Re, out of the Kontra rounds. */
  re: Rate
  /** Re paid off: the declarer won. */
  reSuccess: Rate
  /** Baseline for comparison: the declarer won when nobody said Kontra. */
  winWithoutKontra: Rate
  byFamily: { family: Exclude<ModeFamily, 'ramsch'>; kontra: Rate; kontraSuccess: Rate }[]
  /** Out of all mode rounds, Ramsch included. */
  klopfer: Rate
  avgKlopfer: number | null
}

export function kontraReStats(rounds: readonly StatRound[]): KontraReStats {
  const scored = modeRounds(rounds)
  const games = scored.filter((round) => round.family !== 'ramsch')
  const withKontra = games.filter((round) => round.facts!.kontra)
  const withRe = withKontra.filter((round) => round.facts!.re)
  const withoutKontra = games.filter((round) => !round.facts!.kontra)
  const klopfed = scored.filter((round) => round.facts!.klopfer > 0)

  const byFamily = (['team', 'solo'] as const).map((family) => {
    const inFamily = games.filter((round) => round.family === family)
    const kontra = inFamily.filter((round) => round.facts!.kontra)
    return {
      family,
      kontra: rate(kontra.length, inFamily.length),
      kontraSuccess: rate(kontra.filter((r) => !declarerWon(r)).length, kontra.length),
    }
  })

  return {
    games: games.length,
    kontra: rate(withKontra.length, games.length),
    kontraSuccess: rate(withKontra.filter((r) => !declarerWon(r)).length, withKontra.length),
    re: rate(withRe.length, withKontra.length),
    reSuccess: rate(withRe.filter(declarerWon).length, withRe.length),
    winWithoutKontra: rate(withoutKontra.filter(declarerWon).length, withoutKontra.length),
    byFamily,
    klopfer: rate(klopfed.length, scored.length),
    avgKlopfer: average(klopfed.map((round) => round.facts!.klopfer)),
  }
}

// ── Ramsch ──────────────────────────────────────────────────────────────────

export interface RamschLoser {
  playerId: PlayerId
  played: number
  lost: number
  lossRate: Rate
}

export interface RamschStats {
  count: number
  durchmarsch: Rate
  jungfrau: Rate
  losers: RamschLoser[]
}

export function ramschStats(rounds: readonly StatRound[]): RamschStats {
  const ramsch = modeRounds(rounds).filter((round) => round.family === 'ramsch')
  const perPlayer = new Map<PlayerId, { played: number; lost: number }>()

  for (const round of ramsch) {
    const loserId = round.facts!.durchmarsch ? null : declarerSeat(round)?.playerId
    for (const seat of round.seats) {
      if (!isActive(seat)) continue
      const entry = perPlayer.get(seat.playerId) ?? { played: 0, lost: 0 }
      entry.played += 1
      if (seat.playerId === loserId) entry.lost += 1
      perPlayer.set(seat.playerId, entry)
    }
  }

  return {
    count: ramsch.length,
    durchmarsch: rate(ramsch.filter((r) => r.facts!.durchmarsch).length, ramsch.length),
    jungfrau: rate(ramsch.filter((r) => r.facts!.jungfrau).length, ramsch.length),
    losers: [...perPlayer.entries()]
      .map(([playerId, { played, lost }]) => ({
        playerId,
        played,
        lost,
        lossRate: rate(lost, played),
      }))
      .sort((a, b) => b.lost - a.lost || a.played - b.played),
  }
}

// ── Players ─────────────────────────────────────────────────────────────────

export interface PlayerStats {
  playerId: PlayerId
  /** Rounds actively played (not sat out). */
  rounds: number
  won: Rate
  points: number
  avgPoints: number
  best: number
  worst: number
  longestWinStreak: number
  longestLossStreak: number
  satOut: number
  /** Team games (two against two) won. */
  team: Rate
  /** Solos won — legacy rounds included, where a lone winner means a won solo. */
  solosWon: number
  /** Lost solos or Ramsch losses — they cannot be told apart in legacy rounds. */
  singleLosses: number

  // Mode rounds only.
  modeRounds: number
  asDeclarer: Rate
  asPartner: Rate
  asOpponent: Rate
  /** Solos played as declarer, and how many were won. */
  solos: Rate
  ramschLost: number
}

function emptyPlayer(playerId: PlayerId): PlayerStats {
  return {
    playerId,
    rounds: 0,
    won: rate(0, 0),
    points: 0,
    avgPoints: 0,
    best: -Infinity,
    worst: Infinity,
    longestWinStreak: 0,
    longestLossStreak: 0,
    satOut: 0,
    team: rate(0, 0),
    solosWon: 0,
    singleLosses: 0,
    modeRounds: 0,
    asDeclarer: rate(0, 0),
    asPartner: rate(0, 0),
    asOpponent: rate(0, 0),
    solos: rate(0, 0),
    ramschLost: 0,
  }
}

function bump(r: Rate, hit: boolean): Rate {
  return rate(r.hits + (hit ? 1 : 0), r.n + 1)
}

/** Per-player figures, most rounds first. Rounds must be in play order for streaks. */
export function playerStats(rounds: readonly StatRound[]): PlayerStats[] {
  const stats = new Map<PlayerId, PlayerStats>()
  const streaks = new Map<PlayerId, { wins: number; losses: number }>()

  for (const round of rounds) {
    for (const seat of round.seats) {
      const s = stats.get(seat.playerId) ?? emptyPlayer(seat.playerId)
      stats.set(seat.playerId, s)

      if (!isActive(seat)) {
        s.satOut += 1
        continue
      }

      const won = seat.side === 'up'
      s.rounds += 1
      s.won = bump(s.won, won)
      s.points += seat.score
      s.best = Math.max(s.best, seat.score)
      s.worst = Math.min(s.worst, seat.score)

      const streak = streaks.get(seat.playerId) ?? { wins: 0, losses: 0 }
      streak.wins = won ? streak.wins + 1 : 0
      streak.losses = won ? 0 : streak.losses + 1
      streaks.set(seat.playerId, streak)
      s.longestWinStreak = Math.max(s.longestWinStreak, streak.wins)
      s.longestLossStreak = Math.max(s.longestLossStreak, streak.losses)

      if (round.shape === 'team') s.team = bump(s.team, won)
      if (round.soloPlayerId === seat.playerId) {
        if (round.shape === 'soloWon') s.solosWon += 1
        if (round.shape === 'singleLoss') s.singleLosses += 1
      }

      if (round.source !== 'mode') continue
      s.modeRounds += 1
      if (seat.role === 'declarer') s.asDeclarer = bump(s.asDeclarer, won)
      if (seat.role === 'partner') s.asPartner = bump(s.asPartner, won)
      if (seat.role === 'opponent') s.asOpponent = bump(s.asOpponent, won)
      if (seat.role === 'declarer' && round.family === 'solo') s.solos = bump(s.solos, won)
      if (seat.role === 'declarer' && round.family === 'ramsch' && !won) s.ramschLost += 1
    }
  }

  return [...stats.values()]
    .filter((s) => s.rounds > 0)
    .map((s) => ({ ...s, avgPoints: s.points / s.rounds }))
    .sort((a, b) => b.rounds - a.rounds || a.playerId - b.playerId)
}

// ── Tables: points needed to win ────────────────────────────────────────────

export interface TableSizeStats {
  size: number
  tables: number
  /** Average raw total per finishing place, best first. */
  placeAverages: number[]
}

export interface TablePlayerStats {
  playerId: PlayerId
  tables: number
  wins: number
  /** 1-based. */
  avgPlace: number
}

export interface TableStats {
  tables: number
  winnerTotal: { avg: number; min: number; max: number } | null
  bySize: TableSizeStats[]
  players: TablePlayerStats[]
}

/** Finished tables only: an open game has no winner yet. */
export function tableStats(tables: readonly StatTable[]): TableStats {
  const finished = tables.filter((table) => !table.isOpen && table.standings.length >= 2)
  const winners = finished.map((table) => table.standings[0].rawTotal)

  const bySizeMap = new Map<number, number[][]>()
  const players = new Map<PlayerId, { tables: number; wins: number; places: number }>()
  for (const table of finished) {
    const size = table.standings.length
    const list = bySizeMap.get(size) ?? []
    list.push(table.standings.map((standing) => standing.rawTotal))
    bySizeMap.set(size, list)

    for (const standing of table.standings) {
      const entry = players.get(standing.playerId) ?? { tables: 0, wins: 0, places: 0 }
      entry.tables += 1
      entry.places += standing.rank + 1
      if (standing.rank === 0) entry.wins += 1
      players.set(standing.playerId, entry)
    }
  }

  return {
    tables: finished.length,
    winnerTotal:
      winners.length > 0
        ? {
            avg: average(winners)!,
            min: Math.min(...winners),
            max: Math.max(...winners),
          }
        : null,
    bySize: [...bySizeMap.entries()]
      .map(([size, totals]) => ({
        size,
        tables: totals.length,
        placeAverages: Array.from({ length: size }, (_, place) =>
          average(totals.map((t) => t[place]))!,
        ),
      }))
      .sort((a, b) => b.tables - a.tables),
    players: [...players.entries()]
      .map(([playerId, e]) => ({
        playerId,
        tables: e.tables,
        wins: e.wins,
        avgPlace: e.places / e.tables,
      }))
      .sort((a, b) => b.wins - a.wins || a.avgPlace - b.avgPlace),
  }
}

// ── Pairs ───────────────────────────────────────────────────────────────────

/** Rounds whose sides mean something: everything but irregular ones. */
function hasSides(round: StatRound): boolean {
  return round.shape !== 'other'
}

export interface PairRecord {
  /** Always the smaller id. */
  a: PlayerId
  b: PlayerId
  /** Both played the round (neither sat out). */
  shared: number
  /** Partners in a team game. */
  partner: Rate
  /** On opposite sides. */
  opposed: number
  aWon: number
  bWon: number
}

export function pairKey(x: PlayerId, y: PlayerId): string {
  return x < y ? `${x}-${y}` : `${y}-${x}`
}

export function pairRecords(rounds: readonly StatRound[]): Map<string, PairRecord> {
  const records = new Map<string, PairRecord>()

  for (const round of rounds) {
    if (!hasSides(round)) continue
    const active = round.seats.filter(isActive)
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const [x, y] =
          active[i].playerId < active[j].playerId ? [active[i], active[j]] : [active[j], active[i]]
        const key = pairKey(x.playerId, y.playerId)
        const record = records.get(key) ?? {
          a: x.playerId,
          b: y.playerId,
          shared: 0,
          partner: rate(0, 0),
          opposed: 0,
          aWon: 0,
          bWon: 0,
        }
        record.shared += 1
        if (x.side === y.side) {
          if (round.shape === 'team') record.partner = bump(record.partner, x.side === 'up')
        } else {
          record.opposed += 1
          if (x.side === 'up') record.aWon += 1
          else record.bWon += 1
        }
        records.set(key, record)
      }
    }
  }

  return records
}

/** One player's record against another when on opposite sides. */
export function opposedRate(record: PairRecord, playerId: PlayerId): Rate {
  return rate(playerId === record.a ? record.aWon : record.bWon, record.opposed)
}

export interface Duo {
  a: PlayerId
  b: PlayerId
  partner: Rate
}

/**
 * Best and worst partnerships with enough team games together. With a single
 * eligible pair there is nothing to compare it against, so it is only the best.
 */
export function duos(records: Map<string, PairRecord>): { best: Duo | null; worst: Duo | null } {
  const eligible = [...records.values()].filter((r) => r.partner.n >= MIN_PAIR_ROUNDS)
  if (eligible.length === 0) return { best: null, worst: null }
  const sorted = eligible.sort(
    (x, y) => y.partner.rate! - x.partner.rate! || y.partner.n - x.partner.n,
  )
  const pick = (r: PairRecord): Duo => ({ a: r.a, b: r.b, partner: r.partner })
  return {
    best: pick(sorted[0]),
    worst: sorted.length > 1 ? pick(sorted[sorted.length - 1]) : null,
  }
}

export interface Nemesis {
  opponentId: PlayerId
  record: Rate
}

/** The opponent a player does worst against, given enough rounds against them. */
export function nemesisOf(records: Map<string, PairRecord>, playerId: PlayerId): Nemesis | null {
  let worst: Nemesis | null = null
  for (const record of records.values()) {
    if (record.a !== playerId && record.b !== playerId) continue
    if (record.opposed < MIN_PAIR_ROUNDS) continue
    const own = opposedRate(record, playerId)
    if (!worst || own.rate! < worst.record.rate!) {
      worst = { opponentId: record.a === playerId ? record.b : record.a, record: own }
    }
  }
  return worst
}

// ── Head to head ────────────────────────────────────────────────────────────

export interface HeadToHead {
  sharedTables: number
  /** Finished tables where one placed above the other. */
  aAbove: number
  bAbove: number
  record: PairRecord | null
  /** Points each scored in rounds on opposite sides. */
  aNetOpposed: number
  bNetOpposed: number

  // Mode rounds only.
  /** a declared a team game and had b as partner. */
  aWithB: Rate
  bWithA: Rate
  /** a played a solo with b among the opponents. */
  aSoloVsB: Rate
  bSoloVsA: Rate
}

export function headToHead(
  tables: readonly StatTable[],
  rounds: readonly StatRound[],
  a: PlayerId,
  b: PlayerId,
): HeadToHead {
  let sharedTables = 0
  let aAbove = 0
  let bAbove = 0
  for (const table of tables) {
    const sa = table.standings.find((s) => s.playerId === a)
    const sb = table.standings.find((s) => s.playerId === b)
    if (!sa || !sb) continue
    sharedTables += 1
    if (table.isOpen) continue
    if (sa.rank < sb.rank) aAbove += 1
    else bAbove += 1
  }

  let aNetOpposed = 0
  let bNetOpposed = 0
  let aWithB = rate(0, 0)
  let bWithA = rate(0, 0)
  let aSoloVsB = rate(0, 0)
  let bSoloVsA = rate(0, 0)
  const shared: StatRound[] = []

  for (const round of rounds) {
    const seatA = seatOf(round, a)
    const seatB = seatOf(round, b)
    if (!seatA || !seatB || !isActive(seatA) || !isActive(seatB)) continue
    shared.push(round)

    if (hasSides(round) && seatA.side !== seatB.side) {
      aNetOpposed += seatA.score
      bNetOpposed += seatB.score
    }

    if (round.source !== 'mode') continue
    const won = declarerWon(round)
    if (round.family === 'team') {
      if (seatA.role === 'declarer' && seatB.role === 'partner') aWithB = bump(aWithB, won)
      if (seatB.role === 'declarer' && seatA.role === 'partner') bWithA = bump(bWithA, won)
    }
    if (round.family === 'solo') {
      if (seatA.role === 'declarer') aSoloVsB = bump(aSoloVsB, won)
      if (seatB.role === 'declarer') bSoloVsA = bump(bSoloVsA, won)
    }
  }

  return {
    sharedTables,
    aAbove,
    bAbove,
    record: pairRecords(shared).get(pairKey(a, b)) ?? null,
    aNetOpposed,
    bNetOpposed,
    aWithB,
    bWithA,
    aSoloVsB,
    bSoloVsA,
  }
}
