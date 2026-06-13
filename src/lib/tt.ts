import type { TTSet, TTSide } from './supabase'

// Domaenen-Helfer fuer Tischtennis-Scoring (Saetze -> Gewinner).

export function setsWon(sets: Pick<TTSet, 'score_a' | 'score_b'>[]): { a: number; b: number } {
  let a = 0
  let b = 0
  for (const s of sets) {
    if (s.score_a > s.score_b) a += 1
    else if (s.score_b > s.score_a) b += 1
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
