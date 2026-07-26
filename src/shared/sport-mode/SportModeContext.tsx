import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type SportMode = 'schafkopf' | 'tt'

const STORAGE_KEY = 'sportMode'

interface SportModeContextValue {
  mode: SportMode
  setMode: (mode: SportMode) => void
  toggleMode: () => void
}

const SportModeContext = createContext<SportModeContextValue | undefined>(undefined)

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

export function useSportMode(): SportModeContextValue {
  const ctx = useContext(SportModeContext)
  if (!ctx) throw new Error('useSportMode must be used within a SportModeProvider')
  return ctx
}
