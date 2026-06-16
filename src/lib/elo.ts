import EloRank from 'elo-rank'

// Elo-Rating fuer Tischtennis. Baut auf der bewaehrten 1v1-Lib `elo-rank`
// (getExpected / updateRating) auf und erweitert sie um den Team-Fall (Doppel)
// per AVERAGE_TEAMS: Team-Rating = Mittel der beiden Spieler-Ratings, jeder
// Spieler einer Seite erhaelt das Delta basierend auf seinem eigenen Rating.

export const TT_BASE_RATING = 1000
export const TT_K_FACTOR = 32

export interface TTEloMatchInput {
  sideA: number[] // player ids (1 = Einzel, 2 = Doppel)
  sideB: number[]
  winner: 'A' | 'B'
}

export interface TTPlayerRating {
  playerId: number
  rating: number
  games: number
  wins: number
}

/**
 * Berechnet die aktuellen Elo-Ratings aus einer chronologisch sortierten Liste
 * abgeschlossener Matches. Spieler starten bei TT_BASE_RATING.
 */
export function computeTTRatings(
  matches: TTEloMatchInput[],
  options?: { kFactor?: number; baseRating?: number }
): Map<number, TTPlayerRating> {
  const k = options?.kFactor ?? TT_K_FACTOR
  const base = options?.baseRating ?? TT_BASE_RATING
  const elo = new EloRank(k)
  const ratings = new Map<number, TTPlayerRating>()

  const ensure = (id: number): TTPlayerRating => {
    let r = ratings.get(id)
    if (!r) {
      r = { playerId: id, rating: base, games: 0, wins: 0 }
      ratings.set(id, r)
    }
    return r
  }

  for (const m of matches) {
    const a = m.sideA.map(ensure)
    const b = m.sideB.map(ensure)
    if (a.length === 0 || b.length === 0) continue

    const teamA = a.reduce((sum, p) => sum + p.rating, 0) / a.length
    const teamB = b.reduce((sum, p) => sum + p.rating, 0) / b.length
    const expA = elo.getExpected(teamA, teamB)
    const expB = elo.getExpected(teamB, teamA)
    const aWon = m.winner === 'A' ? 1 : 0
    const bWon = m.winner === 'B' ? 1 : 0

    // Neue Ratings zuerst berechnen (auf Basis des jeweils eigenen Ratings),
    // dann anwenden.
    const newA = a.map(p => elo.updateRating(expA, aWon, p.rating))
    const newB = b.map(p => elo.updateRating(expB, bWon, p.rating))

    a.forEach((p, i) => { p.rating = newA[i]; p.games += 1; if (aWon) p.wins += 1 })
    b.forEach((p, i) => { p.rating = newB[i]; p.games += 1; if (bWon) p.wins += 1 })
  }

  return ratings
}

// Pool eines Matches anhand der tatsaechlichen Team-Groessen:
// 1v1 -> Einzel; alles andere (2v2, 1v3, ...) -> Doppel (fuer alle Beteiligten).
export type TTPool = 'einzel' | 'doppel'

export function matchPool(sideA: number[], sideB: number[]): TTPool {
  return sideA.length === 1 && sideB.length === 1 ? 'einzel' : 'doppel'
}

/**
 * Wie computeTTRatings, aber getrennt nach Einzel- und Doppel-Pool. Jeder
 * Spieler erhaelt dadurch eine eigene Einzel- und eine eigene Doppel-Elo.
 */
export function computeTTRatingsSplit(
  matches: TTEloMatchInput[],
  options?: { kFactor?: number; baseRating?: number }
): { einzel: Map<number, TTPlayerRating>; doppel: Map<number, TTPlayerRating> } {
  const einzel = matches.filter(m => matchPool(m.sideA, m.sideB) === 'einzel')
  const doppel = matches.filter(m => matchPool(m.sideA, m.sideB) === 'doppel')
  return {
    einzel: computeTTRatings(einzel, options),
    doppel: computeTTRatings(doppel, options),
  }
}
