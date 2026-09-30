import type { Player } from '@/shared/supabase/types'
import type { PlayerId } from '@/features/schafkopf/domain/scoring'
import { MIN_SAMPLE, type Rate } from '@/features/schafkopf/domain/statistics/aggregate'

/** The semester select's extra option. */
export const ALL_SEMESTERS = 'all'

const percent = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 0 })
const decimal = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 })

export function formatPercent(value: number | null): string {
  return value === null ? '–' : percent.format(value)
}

export function formatRate(r: Rate | null): string {
  return r ? formatPercent(r.rate) : '–'
}

export function formatNumber(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '–' : decimal.format(value)
}

export function formatSigned(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '–'
  const rounded = decimal.format(value)
  return value > 0 ? `+${rounded}` : rounded
}

export function isThin(r: Rate | null): boolean {
  return !r || r.n < MIN_SAMPLE
}

export function scoreClass(value: number): string {
  return value > 0 ? 'stats-positive' : value < 0 ? 'stats-negative' : 'stats-muted'
}

/**
 * Display names by id. Several players share a first name (there are three
 * Noahs), so duplicates get their id appended to stay tellable apart.
 */
export function playerNames(players: readonly Player[]): (id: PlayerId) => string {
  const counts = new Map<string, number>()
  for (const player of players) counts.set(player.name, (counts.get(player.name) ?? 0) + 1)
  const names = new Map(
    players.map((player) => [
      player.id,
      (counts.get(player.name) ?? 0) > 1 ? `${player.name} #${player.id}` : player.name,
    ]),
  )
  return (id) => names.get(id) ?? `#${id}`
}
