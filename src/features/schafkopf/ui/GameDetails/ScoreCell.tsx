import type { RoundRole } from '@/features/schafkopf/domain/gameModes'

/** Empty means zero; anything unparseable also means zero. */
function parseScoreInput(value: string): number {
  if (!value) return 0
  return parseInt(value) || 0
}

/**
 * One player's score in one round. The role marks who played (and with whom),
 * and a player who sat out shows a dot rather than a zero.
 */
export function ScoreDisplay({ score, role = null }: { score: number; role?: RoundRole | null }) {
  if (role === 'sitting_out') {
    return (
      <span className="score-display score-sitting-out" title="Setzt aus">
        ·
      </span>
    )
  }
  const tone = score > 0 ? 'score-positive' : score < 0 ? 'score-negative' : 'score-zero'
  const marker =
    role === 'declarer' ? 'score-role-declarer' : role === 'partner' ? 'score-role-partner' : ''
  return (
    <span
      className={`score-display ${tone} ${marker}`}
      title={role === 'declarer' ? 'Spieler' : role === 'partner' ? 'Mitspieler' : undefined}
    >
      {score === 0 ? '-' : score > 0 ? `+${score}` : score}
    </span>
  )
}
