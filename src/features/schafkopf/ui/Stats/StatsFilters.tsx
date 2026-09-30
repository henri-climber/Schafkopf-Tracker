import { SEMESTERS } from '@/features/schafkopf/domain/semesters'
import type { RoundSource, StatsFilters } from '@/features/schafkopf/domain/statistics/normalize'
import { ALL_SEMESTERS } from './format'

const SOURCES: { value: RoundSource; label: string }[] = [
  { value: 'all', label: 'Alle Runden' },
  { value: 'legacy', label: 'Nur alte' },
  { value: 'mode', label: 'Nur Spielmodi' },
]

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <label className="toggle-label">
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="toggle-input peer"
        />
        <div className="toggle-switch"></div>
      </div>
      <span className="toggle-text">{label}</span>
    </label>
  )
}

export function StatsFiltersBar({
  semesterId,
  onSemesterChange,
  filters,
  onFiltersChange,
}: {
  semesterId: string
  onSemesterChange: (id: string) => void
  filters: StatsFilters
  onFiltersChange: (filters: StatsFilters) => void
}) {
  return (
    <div className="stats-filters">
      <select
        value={semesterId}
        onChange={(e) => onSemesterChange(e.target.value)}
        className="semester-select"
      >
        {SEMESTERS.map((semester) => (
          <option key={semester.id} value={semester.id}>
            {semester.label}
          </option>
        ))}
        <option value={ALL_SEMESTERS}>Alle Semester</option>
      </select>

      <div className="stats-segmented" role="radiogroup" aria-label="Runden">
        {SOURCES.map((source) => (
          <button
            key={source.value}
            type="button"
            role="radio"
            aria-checked={filters.source === source.value}
            className={`stats-segment ${filters.source === source.value ? 'stats-segment-active' : ''}`}
            onClick={() => onFiltersChange({ ...filters, source: source.value })}
          >
            {source.label}
          </button>
        ))}
      </div>

      <div className="stats-toggles">
        <Toggle
          checked={filters.rankedOnly}
          onChange={(rankedOnly) => onFiltersChange({ ...filters, rankedOnly })}
          label="Nur Ranglisten-Spiele"
        />
        <Toggle
          checked={filters.includeOngoing}
          onChange={(includeOngoing) => onFiltersChange({ ...filters, includeOngoing })}
          label="Laufende Spiele"
        />
      </div>
    </div>
  )
}
