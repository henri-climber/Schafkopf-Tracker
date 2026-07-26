import { useEffect, useState } from 'react'

/**
 * Subscribes to a media query.
 *
 * Use this when a breakpoint has to change *what renders*, not just how it
 * looks. Showing and hiding two variants with CSS is fine until both variants
 * contain focusable or stateful elements, at which point the hidden one is
 * still real and still competing.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mediaQuery = window.matchMedia(query)
    // Re-read on subscribe: the viewport can change between first render and
    // the effect firing.
    setMatches(mediaQuery.matches)

    const handler = (event: MediaQueryListEvent) => setMatches(event.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [query])

  return matches
}
