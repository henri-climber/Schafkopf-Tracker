// Schafkopf-Leaderboard: zwei Ebenen.
//
// 1) Kanonisches STÄRKE-ELO = Per-Runde-Team-Elo. Jede Hand ist ein Mini-Match
//    (2v2 Rufspiel oder 1v3 Solo/Wenz). Teams werden aus den Vorzeichen der
//    `rawScore` rekonstruiert (>0 Gewinner, <0 Verlierer, ==0/fehlend = ausgesetzt).
//    Team-Rating = Mittel der Spieler-Elos; jeder Spieler wird nach seinem eigenen
//    Rating geupdatet. Es zählt reines Sieg/Niederlage pro Hand — der Betrag
//    (Siegeshöhe = überwiegend Glück) beeinflusst das Elo NICHT (Margin per Default
//    aus, siehe SK_CONFIG.marginDamping). Das Elo updatet pro Hand für ALLE Tische.
//
// 2) LEADERBOARD = Elo-gewichtete Platzierungspunkte. Pro Tisch (sofern er die
//    2·N-Runden-Schwelle erreicht):
//       LB_i = Platzierungspunkte_i − erwartetePunkte_i
//    Die erwarteten Punkte kommen aus den Per-Runde-Elos, die die Spieler BEIM
//    BETRETEN des Tisches hatten (Snapshot vor den Händen dieses Tisches). Dadurch
//    zählt Platz 1 gegen starke Gegner mehr als gegen schwache.
//
// Der gesamte Verlauf wird chronologisch (Tisch-`createdAt`, dann Rundennummer)
// deterministisch repliziert -> idempotente Rückrechnung ohne Persistenz.

export interface SchafkopfConfig {
  /** K-Faktor (Dauerwert nach der Provisorik-Phase). */
  K: number
  /** Höherer K-Faktor während der Provisorik (erste `provisionalHands` Hände). */
  provisionalK: number
  /** Anzahl Hände, nach denen ein Spieler vom provisionalK auf K wechselt. */
  provisionalHands: number
  /** Start-Elo neuer Spieler. */
  BASE: number
  /** Elo-Skala (Standard 400). */
  SCALE: number
  /** Normierung der Siegeshöhe ("Tarif" / typischer Rundenwert). */
  marginTarif: number
  /** Deckel des Margin-Multiplikators. */
  marginMax: number
  /**
   * Dämpfung des Margin-Einflusses. Default 0 = AUS: reines Sieg/Niederlage pro
   * Hand. Die Siegeshöhe (Solo/Schneider/Tarif/geklopft) ist überwiegend Glück und
   * soll das Stärke-Elo nicht verzerren. Knopf bleibt erhalten, falls man ihn je
   * (z.B. 0.25) wieder leicht aktivieren will.
   */
  marginDamping: number
  /** Ein Tisch zählt für Abrechnung + LB iff rundenanzahl >= factor * N. */
  fullValuationRoundFactor: number
  /**
   * Gewichtung der Gegnerstärke im Leaderboard:
   *   LB = Platzierungspunkte − lbExpectationWeight · erwartetePunkte
   * 1 = voll gegnergewichtet, 0 = reine Platzierung. Default 0.8.
   */
  lbExpectationWeight: number
}

export const SK_CONFIG: SchafkopfConfig = {
  K: 25, // Dauerwert
  provisionalK: 40, // Provisorik: schnelleres Einpendeln neuer Spieler
  provisionalHands: 30,
  BASE: 1000,
  SCALE: 400,
  marginTarif: 10,
  marginMax: 1.5,
  marginDamping: 0, // AUS: reines Sieg/Niederlage (Siegeshöhe = Glück)
  fullValuationRoundFactor: 2,
  lbExpectationWeight: 0.8,
}

export interface HandScore {
  playerId: number
  rawScore: number
}

/** Eine einzelne Hand/Runde. */
export interface RoundInput {
  scores: HandScore[]
}

/** Ein Tisch/Spiel = chronologische Folge von Händen. */
export interface TableInput {
  tableId: number
  createdAt: string
  rounds: RoundInput[] // chronologisch nach Rundennummer
  /**
   * Zählt dieser Tisch für Abrechnung + Leaderboard? Default true. Auf false
   * gesetzt für Tische außerhalb des betrachteten Fensters (z.B. Vor-Semester):
   * Das Stärke-Elo wird trotzdem fortgeschrieben (Carry-over), aber LB/Strich
   * werden nicht gezählt.
   */
  countsForLeaderboard?: boolean
}

export interface PlayerResult {
  playerId: number
  /** Aktuelles Per-Runde-Stärke-Elo. */
  elo: number
  /** Gespielte Hände (über alle Tische). */
  hands: number
  /** Gewonnene Hände. */
  wins: number
  /** Σ gewichteter Leaderboard-Punkte (nur qualifizierende Tische). */
  lbTotal: number
  /** Σ roher Platzierungspunkte / "Strich" (nur qualifizierende Tische). */
  settlementTotal: number
  /** Anzahl qualifizierender Tische (>= 2N Runden), an denen der Spieler teilnahm. */
  tablesCounted: number
}

/** Zero-sum Platzierungspunkte nach Spieleranzahl (unverändert ggü. Altsystem). */
export function getPlacementPoints(playerCount: number): number[] {
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

/** Erwartungswert (Logistik): Wahrscheinlichkeit, dass rSelf gegen rOpp gewinnt. */
export function expectedScore(rSelf: number, rOpp: number, scale = SK_CONFIG.SCALE): number {
  return 1 / (1 + Math.pow(10, (rOpp - rSelf) / scale))
}

/** Gedämpfter, gedeckelter Multiplikator für die Siegeshöhe. */
export function marginMultiplier(totalMargin: number, cfg: SchafkopfConfig = SK_CONFIG): number {
  const m = 1 + Math.log2(1 + Math.abs(totalMargin) / cfg.marginTarif) * cfg.marginDamping
  return Math.min(m, cfg.marginMax)
}

/** Lineare Interpolation des Punktevektors an einem (reellen) Rang in [1, n]. */
export function interpolatePoints(points: number[], rank: number): number {
  const n = points.length
  if (n === 0) return 0
  const r = Math.min(Math.max(rank, 1), n)
  const lo = Math.floor(r)
  const hi = Math.ceil(r)
  if (lo === hi) return points[lo - 1]
  const frac = r - lo
  return points[lo - 1] + frac * (points[hi - 1] - points[lo - 1])
}

/**
 * Erwartete Platzierungspunkte je Spieler aus den Entry-Elos. Reihenfolge des
 * Ergebnisses entspricht der Reihenfolge von `entryElos`.
 */
export function expectedPoints(entryElos: number[], cfg: SchafkopfConfig = SK_CONFIG): number[] {
  const n = entryElos.length
  const points = getPlacementPoints(n)
  if (points.length === 0) return entryElos.map(() => 0)

  return entryElos.map((rSelf, i) => {
    let sum = 0
    for (let j = 0; j < n; j++) {
      if (j !== i) sum += expectedScore(rSelf, entryElos[j], cfg.SCALE)
    }
    const E = sum / (n - 1) // erwarteter Anteil geschlagener Gegner ∈ [0,1]
    const expectedRank = n - E * (n - 1) // ∈ [1, n]
    return interpolatePoints(points, expectedRank)
  })
}

/**
 * Repliziert den gesamten Verlauf chronologisch und liefert je Spieler Stärke-Elo
 * sowie die gewichteten Leaderboard- und Abrechnungs-Summen.
 *
 * Deterministisch & idempotent: Tische werden nach (createdAt, tableId) sortiert,
 * Hände in gegebener (Rundennummer-)Reihenfolge verarbeitet.
 */
export function computeSchafkopfLeaderboard(
  tables: TableInput[],
  cfg: SchafkopfConfig = SK_CONFIG
): Map<number, PlayerResult> {
  const result = new Map<number, PlayerResult>()

  const ensure = (id: number): PlayerResult => {
    let r = result.get(id)
    if (!r) {
      r = { playerId: id, elo: cfg.BASE, hands: 0, wins: 0, lbTotal: 0, settlementTotal: 0, tablesCounted: 0 }
      result.set(id, r)
    }
    return r
  }

  const sortedTables = [...tables].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.tableId - b.tableId
  )

  for (const table of sortedTables) {
    // Teilnehmer = alle Spieler, die in den Händen dieses Tisches auftauchen.
    const participants: number[] = []
    const seen = new Set<number>()
    const tableTotals = new Map<number, number>()
    for (const round of table.rounds) {
      for (const s of round.scores) {
        if (!seen.has(s.playerId)) {
          seen.add(s.playerId)
          participants.push(s.playerId)
        }
        tableTotals.set(s.playerId, (tableTotals.get(s.playerId) || 0) + s.rawScore)
      }
    }

    const n = participants.length
    const placement = getPlacementPoints(n)
    const counts = table.countsForLeaderboard !== false
    const qualifies =
      counts && placement.length > 0 && table.rounds.length >= cfg.fullValuationRoundFactor * n

    // --- Bewertung (vor dem Elo-Update: Entry-Elo-Snapshot) ---
    if (qualifies) {
      const entryElos = participants.map(id => ensure(id).elo)
      const exp = expectedPoints(entryElos, cfg)

      // Tatsächliche Platzierungspunkte aus dem Endstand (Summe der Rohpunkte).
      const ranked = [...participants].sort(
        (a, b) => (tableTotals.get(b) || 0) - (tableTotals.get(a) || 0)
      )
      const actualByPlayer = new Map<number, number>()
      ranked.forEach((id, rank) => actualByPlayer.set(id, placement[rank]))

      participants.forEach((id, i) => {
        const r = ensure(id)
        const actual = actualByPlayer.get(id) ?? 0
        r.settlementTotal += actual
        r.lbTotal += actual - cfg.lbExpectationWeight * exp[i]
        r.tablesCounted += 1
      })
    }

    // --- Stärke-Elo: jede Hand updatet (immer, auch unter der Schwelle) ---
    for (const round of table.rounds) {
      const winners = round.scores.filter(s => s.rawScore > 0)
      const losers = round.scores.filter(s => s.rawScore < 0)
      if (winners.length === 0 || losers.length === 0) continue

      const wr = winners.map(s => ensure(s.playerId))
      const lr = losers.map(s => ensure(s.playerId))
      const teamW = wr.reduce((sum, p) => sum + p.elo, 0) / wr.length
      const teamL = lr.reduce((sum, p) => sum + p.elo, 0) / lr.length
      const expW = expectedScore(teamW, teamL, cfg.SCALE)
      const expL = expectedScore(teamL, teamW, cfg.SCALE)

      const totalMargin = winners.reduce((sum, s) => sum + s.rawScore, 0)
      const margin = marginMultiplier(totalMargin, cfg)
      // K pro Spieler: hoehere Provisorik in den ersten `provisionalHands` Haenden.
      const kFor = (p: PlayerResult) =>
        (p.hands < cfg.provisionalHands ? cfg.provisionalK : cfg.K) * margin

      // Updates basieren auf dem eigenen Rating; Teams sind disjunkt -> direkt anwenden.
      wr.forEach(p => { p.elo = Math.round(p.elo + kFor(p) * (1 - expW)); p.hands += 1; p.wins += 1 })
      lr.forEach(p => { p.elo = Math.round(p.elo + kFor(p) * (0 - expL)); p.hands += 1 })
    }
  }

  return result
}
