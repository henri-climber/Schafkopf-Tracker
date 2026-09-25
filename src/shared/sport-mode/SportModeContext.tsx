import { useEffect, useState, type ReactNode } from 'react'
import { SportModeContext, STORAGE_KEY, type SportMode } from './context'

export type { SportMode }

function readInitialMode(): SportMode {
  if (typeof window === 'undefined') return 'schafkopf'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'tt' ? 'tt' : 'schafkopf'
}

export function SportModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<SportMode>(readInitialMode)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  const setMode = (next: SportMode) => setModeState(next)
  const toggleMode = () => setModeState((prev) => (prev === 'tt' ? 'schafkopf' : 'tt'))

  return (
    <SportModeContext.Provider value={{ mode, setMode, toggleMode }}>
      {children}
    </SportModeContext.Provider>
  )
}
