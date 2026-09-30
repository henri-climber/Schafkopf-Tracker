import { describeExtras, describeRound, MODE_META } from '@/features/schafkopf/domain/gameModes'
import type { Player } from '@/shared/supabase/types'
import type { RoundRow } from './types'

/**
 * What was played in a round: "Solo ❤️ · Tout", who played it and whether it
 * was won, plus any extras. Renders nothing for rounds recorded before game
 * modes existed.
 */
export function RoundSummary({ row, players }: { row: RoundRow; players: Player[] }) {
  const label = describeRound(row.round)
  if (!label) return null

  const mode = row.round.game_mode
  if (!mode || mode === 'manual') return <span className="round-summary-mode">{label}</span>

  const nameWith = (role: 'declarer' | 'partner') => {
    const entry = Object.entries(row.roles).find(([, r]) => r === role)
    return entry ? (players.find((p) => p.id === Number(entry[0]))?.name ?? '?') : null
  }
  const declarer = nameWith('declarer')
  const partner = nameWith('partner')
  const extras = describeExtras(row.round)
  const isRamsch = MODE_META[mode].family === 'ramsch'
  const won = row.round.declarer_won

  return (
    <span className="round-summary">
      <span className="round-summary-mode">{label}</span>
      <span className="round-summary-players">
        {isRamsch && !won
          ? `${declarer} verliert`
          : partner
            ? `${declarer} & ${partner}`
            : declarer}
        {!isRamsch && (
          <span className={won ? 'round-summary-won' : 'round-summary-lost'}>
            {won ? ' ✓' : ' ✗'}
          </span>
        )}
      </span>
      {extras.length > 0 && <span className="round-summary-extras">{extras.join(' · ')}</span>}
    </span>
  )
}
