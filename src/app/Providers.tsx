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
            // Scores are edited by a handful of people in the same room, and
            // the score sheet has its own realtime subscription, so refetching
            // on every window focus is noise.
            refetchOnWindowFocus: false,
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
