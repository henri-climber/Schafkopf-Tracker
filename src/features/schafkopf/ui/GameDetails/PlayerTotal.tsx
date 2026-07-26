/** Signed running total, coloured by sign. Used in three places. */
export function PlayerTotal({ total, className = '' }: { total: number; className?: string }) {
  const tone = total > 0 ? 'total-positive' : total < 0 ? 'total-negative' : 'total-neutral'
  return (
    <span className={`${className} ${tone}`}>
      {total > 0 ? '+' : ''}
      {total}
    </span>
  )
}
