import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SportModeProvider } from '@/shared/sport-mode/SportModeContext'

export function Providers({ children }: { children: ReactNode }) {
  // Created once per app instance rather than at module scope, so tests and
  // fast-refresh get a clean cache.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            /*
             * Refetch on focus, deliberately.
             *
             * This was briefly disabled on the argument that the score sheet
             * has its own realtime subscription. That argument was wrong: a
             * phone that sleeps drops its websocket, and on unlock the device
             * was still showing a stale round list. Focus is exactly the moment
             * that needs correcting, and staleTime keeps it from being chatty.
             */
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            retry: 1,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <SportModeProvider>{children}</SportModeProvider>
    </QueryClientProvider>
  )
}
