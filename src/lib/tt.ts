import type { TTFormat, TTSet, TTSide } from './supabase'

// Domaenen-Helfer fuer Tischtennis-Scoring (Saetze -> Gewinner).

/**
 * Anzeige-Label fuer das Match-Format. Bei Doppel mit ungleichen oder
 * ueber-2er Teams (z.B. 1v3) werden die Teamgroessen angehaengt: "Doppel 1v3".
 */
export function ttFormatLabel(format: TTFormat, aCount: number, bCount: number): string {
  if (format === 'singles') return 'Einzel'
  return aCount === 2 && bCount === 2 ? 'Doppel' : `Doppel ${aCount}v${bCount}`
}

/**
 * Ist ein Satz nach offiziellen Tischtennis-Regeln entschieden?
 * Sieger braucht >= 11 Punkte UND mindestens 2 Punkte Vorsprung
 * (bei 10:10 Einstand wird verlaengert: 12:10, 13:11, ...).
 */
export function isSetDecided(scoreA: number, scoreB: number): boolean {
  const hi = Math.max(scoreA, scoreB)
  const lo = Math.min(scoreA, scoreB)
  return hi >= 11 && hi - lo >= 2
}

// Zaehlt nur regelkonform entschiedene Saetze.
export function setsWon(sets: Pick<TTSet, 'score_a' | 'score_b'>[]): { a: number; b: number } {
  let a = 0
  let b = 0
  for (const s of sets) {
    if (!isSetDecided(s.score_a, s.score_b)) continue
    if (s.score_a > s.score_b) a += 1
    else b += 1
  }
  return { a, b }
}

export function setsNeeded(bestOf: number): number {
  return Math.floor(bestOf / 2) + 1
}

/** Gewinnerseite, sobald genug Saetze gewonnen wurden — sonst null. */
export function matchWinner(
  sets: Pick<TTSet, 'score_a' | 'score_b'>[],
  bestOf: number
): TTSide | null {
  const { a, b } = setsWon(sets)
  const needed = setsNeeded(bestOf)
  if (a >= needed) return 'A'
  if (b >= needed) return 'B'
  return null
}
