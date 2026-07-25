import type { PlayerId } from './scoring'

export type SemesterId = string

export interface Semester {
  id: SemesterId
  label: string
  startDate: string
  endDate: string
}

/**
 * Semesters are config, not data: one new entry every six months or so, written
 * by whoever holds deploy rights. A database table would cost a migration, a
 * fetch, a loading state and an admin screen to maintain something that a
 * two-line pull request handles in a minute.
 */
export const SEMESTERS: readonly Semester[] = [
  {
    id: 'sem1',
    label: 'Semester 1 (September 2024 - March 2025)',
    startDate: '2024-09-01T00:00:00.000Z',
    endDate: '2025-03-31T23:59:59.999Z',
  },
  {
    id: 'sem2',
    label: 'Semester 2 (April 2025 - August 2025)',
    startDate: '2025-04-01T00:00:00.000Z',
    endDate: '2025-08-31T23:59:59.999Z',
  },
  {
    id: 'sem3',
    label: 'Semester 3 (September 2025 - April 2026)',
    startDate: '2025-09-01T00:00:00.000Z',
    endDate: '2026-02-27T23:59:59.999Z',
  },
  {
    id: 'sem4',
    label: 'Semester 4 (April 2026 - October 2026)',
    startDate: '2026-02-28T00:00:00.000Z',
    endDate: '2026-09-30T23:59:59.999Z',
  },
]

/**
 * Manual point corrections agreed at the time, applied on top of computed
 * points. DO NOT DELETE: without these, Semester 3 no longer matches the
 * standings the group actually settled on.
 *
 * Keyed by player id. The previous version keyed by name, which was unsound in
 * two ways: three different players are called "Noah", and the Semester 3 entry
 * was misspelled "Finy" so Fini's -4 correction silently never applied from the
 * day it was written until this commit.
 */
export const SEMESTER_POINT_OFFSETS: Readonly<Record<SemesterId, Record<PlayerId, number>>> = {
  sem3: {
    1: 4, // Henri
    2: 1, // Jost
    5: 0, // Emil
    6: 1, // Lukas
    8: 5, // Riccardo
    9: -2, // Timon
    10: -4, // Fini    — was keyed "Finy"; never applied before
    11: -2, // Pfirrmann
    13: -1, // Quentin
    14: -2, // Nikita
  },
}

/** Corrections for a semester, or an empty map if it has none. */
export function offsetsFor(semesterId: SemesterId): Readonly<Record<PlayerId, number>> {
  return SEMESTER_POINT_OFFSETS[semesterId] ?? {}
}

export function semesterById(semesterId: SemesterId): Semester | undefined {
  return SEMESTERS.find((semester) => semester.id === semesterId)
}

/**
 * The semester containing `now`, falling back to the most recent one that has
 * already started. Replaces "just take the last entry", so a forgotten deploy
 * degrades to the current term rather than pinning everyone to a stale one.
 */
export function currentSemester(now: Date = new Date()): Semester {
  const timestamp = now.getTime()

  const containing = SEMESTERS.find(
    (semester) =>
      Date.parse(semester.startDate) <= timestamp && timestamp <= Date.parse(semester.endDate),
  )
  if (containing) return containing

  const started = SEMESTERS.filter((semester) => Date.parse(semester.startDate) <= timestamp)
  if (started.length > 0) return started[started.length - 1]

  return SEMESTERS[0]
}
