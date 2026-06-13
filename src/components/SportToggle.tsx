import { useSportMode } from '../context/SportModeContext'

// Globaler Umschalter Schafkopf <-> Tischtennis. Wird auf der Startseite und
// auf der TT-Startseite gerendert; der Modus wird im localStorage gehalten.
export function SportToggle() {
  const { mode, setMode } = useSportMode()

  return (
    <div className="sport-toggle" role="tablist" aria-label="Sportart wählen">
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'schafkopf'}
        onClick={() => setMode('schafkopf')}
        className={`sport-toggle-btn${mode === 'schafkopf' ? ' active' : ''}`}
      >
        🃏 Schafkopf
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'tt'}
        onClick={() => setMode('tt')}
        className={`sport-toggle-btn${mode === 'tt' ? ' active' : ''}`}
      >
        🏓 Tischtennis
      </button>
    </div>
  )
}
