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
 *
 * A live subscription is not enough on its own. Phones suspend their websocket
 * when the screen locks, and events that fire while it is down are simply
 * missed — there is no replay. So the hook also resyncs whenever the connection
 * is (re-)established and whenever the tab becomes visible again, which is the
 * moment a returning device is most likely to be out of date.
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
    const resync = () => {
      invalidateTable()
      invalidateRounds()
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') resync()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

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
      .subscribe((status) => {
        // Fires on first connect and on every automatic reconnect. Anything
        // that changed while the socket was down arrives via this refetch
        // rather than as a missed event.
        if (status === 'SUBSCRIBED') resync()
      })

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      supabase.removeChannel(channel)
    }
  }, [tableId, queryClient])
}
