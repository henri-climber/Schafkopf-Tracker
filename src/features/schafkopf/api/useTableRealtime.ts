import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/supabase/client'
import { schafkopfKeys } from './queries'

/**
 * Keeps an open score sheet in sync across devices.
 *
 * Replaces useGameSubscription, which held four callbacks in a dependency array
 * of `[gameId]` alone and carried a comment admitting the callbacks would go
 * stale. Invalidating by query key instead means the only dependencies are
 * `tableId` and the query client, and the query client is referentially stable
 * — so the dependency array is now honest rather than commented around.
 *
 * The old hook also filtered round_scores events against a ref of current round
 * ids, purely to work around that staleness. Invalidating the whole table's
 * queries is coarser and correct, so the ref is gone.
 */
export function useTableRealtime(tableId: number) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!Number.isFinite(tableId)) return

    const invalidateTable = () => {
      queryClient.invalidateQueries({ queryKey: schafkopfKeys.table(tableId) })
    }
    const invalidateRounds = () => {
      queryClient.invalidateQueries({ queryKey: schafkopfKeys.rounds(tableId) })
    }

    const channel = supabase
      .channel(`table_${tableId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Tables', filter: `id=eq.${tableId}` },
        invalidateTable,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'table_players', filter: `table_id=eq.${tableId}` },
        invalidateTable,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Rounds', filter: `table_id=eq.${tableId}` },
        invalidateRounds,
      )
      // round_scores has no table_id, so it cannot be filtered server-side.
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'round_scores' },
        invalidateRounds,
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tableId, queryClient])
}
