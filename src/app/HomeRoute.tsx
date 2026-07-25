import { useSportMode } from '@/shared/sport-mode/SportModeContext'
import { HomePage } from '@/features/schafkopf/ui/HomePage'
import { TTHomePage } from '@/features/tabletennis/ui/TTHomePage'

/**
 * `/` is the one route that is shared between the two sports, so the dispatch
 * lives here rather than inside either slice — that keeps the schafkopf and
 * tabletennis slices from having to know about each other.
 */
export function HomeRoute() {
  const { mode } = useSportMode()
  if (mode === 'tt') return <TTHomePage />
  return <HomePage />
}
