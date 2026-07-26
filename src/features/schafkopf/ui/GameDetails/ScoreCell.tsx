import { useRef } from 'react'

/** Empty means zero; anything unparseable also means zero. */
export function parseScoreInput(value: string): number {
  if (!value) return 0
  return parseInt(value) || 0
}

export function ScoreDisplay({ score }: { score: number }) {
  return (
    <span
      className={`score-display ${
        score > 0 ? 'score-positive' : score < 0 ? 'score-negative' : 'score-zero'
      }`}
    >
      {score === 0 ? '-' : score > 0 ? `+${score}` : score}
    </span>
  )
}

interface Props {
  score: number
  isEditing: boolean
  onStartEdit: () => void
  onCommit: (value: number) => void
  onFinish: () => void
  /**
   * Desktop only. Moves editing to the neighbouring player in the same round.
   * Returns whether a neighbour existed — if one did, the resulting blur must
   * not also commit, or it would fight the cell that just took focus.
   */
  onTabNavigate?: (direction: 1 | -1) => boolean
}

/**
 * The single editable score cell, shared by the desktop table and the mobile
 * cards. These were two separate implementations that had already drifted: only
 * the desktop one committed on Tab, and only it guarded the blur that follows.
 */
export function ScoreCell({
  score,
  isEditing,
  onStartEdit,
  onCommit,
  onFinish,
  onTabNavigate,
}: Props) {
  const suppressBlur = useRef(false)

  return (
    <div className="score-cell" onClick={onStartEdit}>
      {isEditing ? (
        <input
          type="number"
          defaultValue={score === 0 ? '' : score}
          className="score-input"
          autoFocus
          onFocus={(e) => e.target.select()}
          onBlur={(e) => {
            if (suppressBlur.current) {
              suppressBlur.current = false
              return
            }
            onCommit(parseScoreInput(e.target.value))
            onFinish()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onCommit(parseScoreInput(e.currentTarget.value))
              onFinish()
              return
            }
            if (e.key === 'Tab' && onTabNavigate) {
              e.preventDefault()
              onCommit(parseScoreInput(e.currentTarget.value))
              if (onTabNavigate(e.shiftKey ? -1 : 1)) {
                suppressBlur.current = true
              } else {
                onFinish()
              }
            }
          }}
        />
      ) : (
        <ScoreDisplay score={score} />
      )}
    </div>
  )
}
