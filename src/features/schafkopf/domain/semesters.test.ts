import { describe, expect, it } from 'vitest'
import { currentSemester, offsetsFor, SEMESTERS, semesterById } from './semesters'

describe('currentSemester', () => {
  it('returns the semester containing the given date', () => {
    expect(currentSemester(new Date('2026-07-25T12:00:00.000Z')).id).toBe('sem4')
    expect(currentSemester(new Date('2025-10-01T12:00:00.000Z')).id).toBe('sem3')
    expect(currentSemester(new Date('2024-09-01T00:00:00.000Z')).id).toBe('sem1')
  })

  it('falls back to the latest started semester once they have all ended', () => {
    // The old code took SEMESTERS[SEMESTERS.length - 1] unconditionally, so a
    // forgotten deploy left everyone looking at a stale term.
    expect(currentSemester(new Date('2030-01-01T00:00:00.000Z')).id).toBe('sem4')
  })

  it('falls back to the first semester for dates before any of them', () => {
    // The old `|| SEMESTERS[0]` landed here too, but silently and for a
    // different reason — an unknown id rather than an early date.
    expect(currentSemester(new Date('2000-01-01T00:00:00.000Z')).id).toBe('sem1')
  })

  it('leaves no gaps between consecutive semesters', () => {
    for (let i = 1; i < SEMESTERS.length; i++) {
      const previousEnd = Date.parse(SEMESTERS[i - 1].endDate)
      const nextStart = Date.parse(SEMESTERS[i].startDate)
      expect(nextStart).toBeGreaterThan(previousEnd)
      // Under a second apart, so no table can fall between two semesters.
      expect(nextStart - previousEnd).toBeLessThanOrEqual(1000)
    }
  })
})

describe('semesterById', () => {
  it('finds a known semester and reports an unknown one as missing', () => {
    expect(semesterById('sem3')?.id).toBe('sem3')
    expect(semesterById('nope')).toBeUndefined()
  })
})

describe('offsetsFor', () => {
  it('applies Fini(10) -4, which the old name-keyed map never did', () => {
    // The entry was misspelled "Finy" and matched no player from the day it was
    // written. Re-keying to player id is what makes it take effect.
    expect(offsetsFor('sem3')[10]).toBe(-4)
  })

  it('keeps the remaining Semester 3 corrections unchanged', () => {
    expect(offsetsFor('sem3')).toEqual({
      1: 4,
      2: 1,
      5: 0,
      6: 1,
      8: 5,
      9: -2,
      10: -4,
      11: -2,
      13: -1,
      14: -2,
    })
  })

  it('returns nothing for semesters with no corrections', () => {
    expect(offsetsFor('sem1')).toEqual({})
  })

  it('applies Semester 4 correction for Olli(18)', () => {
    expect(offsetsFor('sem4')).toEqual({
      18: -10,
    })
  })
})
