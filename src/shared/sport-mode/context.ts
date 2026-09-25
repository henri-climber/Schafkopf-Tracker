import { createContext, useContext } from 'react'

export type SportMode = 'schafkopf' | 'tt'

export const STORAGE_KEY = 'sportMode'

export interface SportModeContextValue {
  mode: SportMode
  setMode: (mode: SportMode) => void
  toggleMode: () => void
}

export const SportModeContext = createContext<SportModeContextValue | undefined>(undefined)

export function useSportMode(): SportModeContextValue {
  const ctx = useContext(SportModeContext)
  if (!ctx) throw new Error('useSportMode must be used within a SportModeProvider')
  return ctx
}
