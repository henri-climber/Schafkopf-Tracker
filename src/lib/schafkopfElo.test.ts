import { describe, it, expect } from 'vitest'
import {
  SK_CONFIG,
  computeSchafkopfLeaderboard,
  expectedPoints,
  interpolatePoints,
  marginMultiplier,
  getPlacementPoints,
  type TableInput,
} from './schafkopfElo'

// Hilfsfunktion: N=4-Tisch mit `count` identischen Runden (A,B Gewinner / C,D Verlierer).
function fourPlayerTable(id: number, createdAt: string, count: number): TableInput {
  const rounds = Array.from({ length: count }, () => ({
    scores: [
      { playerId: 1, rawScore: 3 },
      { playerId: 2, rawScore: 1 },
      { playerId: 3, rawScore: -1 },
      { playerId: 4, rawScore: -3 },
    ],
  }))
  return { tableId: id, createdAt, rounds }
}

describe('interpolatePoints', () => {
  it('reproduziert die echten Punkte bei ganzzahligem Rang', () => {
    const p = getPlacementPoints(4) // [2,1,-1,-2]
    expect(interpolatePoints(p, 1)).toBe(2)
    expect(interpolatePoints(p, 2)).toBe(1)
    expect(interpolatePoints(p, 3)).toBe(-1)
    expect(interpolatePoints(p, 4)).toBe(-2)
  })
  it('interpoliert die Mitte korrekt', () => {
    expect(interpolatePoints([2, 1, -1, -2], 2.5)).toBeCloseTo(0, 10)
  })
  it('klemmt außerhalb [1, n]', () => {
    expect(interpolatePoints([2, 1, -1, -2], 0.2)).toBe(2)
    expect(interpolatePoints([2, 1, -1, -2], 9)).toBe(-2)
  })
})

describe('marginMultiplier', () => {
  it('ist per Default neutral (Margin aus -> immer 1)', () => {
    expect(marginMultiplier(0)).toBe(1)
    expect(marginMultiplier(100000)).toBe(1)
  })
  it('ist gedeckelt, wenn Margin explizit aktiviert wird', () => {
    const cfg = { ...SK_CONFIG, marginDamping: 0.25 }
    expect(marginMultiplier(0, cfg)).toBe(1)
    expect(marginMultiplier(100000, cfg)).toBe(SK_CONFIG.marginMax)
  })
})

describe('expectedPoints', () => {
  it('gibt für gleich starke Spieler die Mitte (0) zurück', () => {
    expect(expectedPoints([1000, 1000, 1000, 1000])).toEqual([0, 0, 0, 0])
    const five = expectedPoints([1000, 1000, 1000, 1000, 1000])
    five.forEach(v => expect(v).toBeCloseTo(0, 10))
  })
  it('berechnet das Erwartungs-Profil aus gemischten Elos (Beispielabend)', () => {
    const exp = expectedPoints([1100, 1050, 1000, 900])
    expect(exp[0]).toBeCloseTo(0.9425, 3)
    expect(exp[1]).toBeCloseTo(0.4068, 3)
    expect(exp[2]).toBeCloseTo(-0.1429, 3)
    expect(exp[3]).toBeCloseTo(-1.1032, 3)
  })
})

describe('computeSchafkopfLeaderboard – Elo-Update', () => {
  it('symmetrisches 2v2-Update bei gleichen Ratings (ohne Margin)', () => {
    const cfg = { ...SK_CONFIG, marginDamping: 0 } // Multiplikator = 1
    const res = computeSchafkopfLeaderboard([fourPlayerTable(1, '2025-01-01', 1)], cfg)
    // expW = 0.5, K = 32 -> Gewinner +16, Verlierer -16
    expect(res.get(1)!.elo).toBe(1016)
    expect(res.get(2)!.elo).toBe(1016)
    expect(res.get(3)!.elo).toBe(984)
    expect(res.get(4)!.elo).toBe(984)
    expect(res.get(1)!.wins).toBe(1)
    expect(res.get(3)!.wins).toBe(0)
  })

  it('ignoriert Aussetzer (rawScore 0) bei der Team-Rekonstruktion', () => {
    const table: TableInput = {
      tableId: 1,
      createdAt: '2025-01-01',
      rounds: [
        {
          scores: [
            { playerId: 1, rawScore: 2 },
            { playerId: 2, rawScore: -2 },
            { playerId: 3, rawScore: 0 }, // sitzt aus
          ],
        },
      ],
    }
    const res = computeSchafkopfLeaderboard([table])
    // Spieler 3 spielt keine Hand -> bekommt gar keinen Elo-Eintrag.
    expect(res.has(3)).toBe(false)
    expect(res.get(1)!.hands).toBe(1)
    expect(res.get(2)!.hands).toBe(1)
  })
})

describe('computeSchafkopfLeaderboard – 2N-Schwelle & LB', () => {
  it('zählt einen Tisch mit genau 2N Runden voll (Grenzfall)', () => {
    // Erster Tisch: alle Entry-Elos = BASE -> erwartete Punkte 0 -> LB = Platzierungspunkte
    const res = computeSchafkopfLeaderboard([fourPlayerTable(1, '2025-01-01', 8)])
    expect(res.get(1)!.tablesCounted).toBe(1)
    expect(res.get(1)!.settlementTotal).toBe(2)
    expect(res.get(1)!.lbTotal).toBeCloseTo(2, 10)
    expect(res.get(4)!.settlementTotal).toBe(-2)
    expect(res.get(4)!.lbTotal).toBeCloseTo(-2, 10)
  })

  it('wertet einen Tisch mit < 2N Runden NICHT, updatet aber das Elo', () => {
    const res = computeSchafkopfLeaderboard([fourPlayerTable(1, '2025-01-01', 7)])
    const a = res.get(1)!
    expect(a.tablesCounted).toBe(0)
    expect(a.lbTotal).toBe(0)
    expect(a.settlementTotal).toBe(0)
    expect(a.hands).toBe(7) // Elo updatet trotzdem
    expect(a.elo).toBeGreaterThan(SK_CONFIG.BASE)
  })

  it('belohnt Sieg gegen stärkere Gegner stärker (über zwei Tische)', () => {
    // Tisch 1 macht Spieler 1 & 2 stark, 3 & 4 schwach.
    // Tisch 2: Spieler 4 (schwach) gewinnt gegen das Feld -> hoher LB-Zuwachs.
    const t1 = fourPlayerTable(1, '2025-01-01', 8)
    const t2: TableInput = {
      tableId: 2,
      createdAt: '2025-02-01',
      rounds: Array.from({ length: 8 }, () => ({
        scores: [
          { playerId: 4, rawScore: 3 }, // schwacher Spieler gewinnt
          { playerId: 3, rawScore: 1 },
          { playerId: 2, rawScore: -1 },
          { playerId: 1, rawScore: -3 },
        ],
      })),
    }
    const res = computeSchafkopfLeaderboard([t1, t2])
    // Beide Tische sind symmetrisch -> reine Platzierung gäbe jedem Gesamt-LB 0.
    // Mit Elo-Gewichtung wird der Aufsteiger (4, schlägt an Tisch 2 das starke Feld)
    // belohnt (> 0), der Absteiger (1, verliert gegen schwaches Feld) bestraft (< 0).
    expect(res.get(4)!.tablesCounted).toBe(2)
    expect(res.get(4)!.lbTotal).toBeGreaterThan(0)
    expect(res.get(1)!.lbTotal).toBeLessThan(0)
    expect(res.get(4)!.lbTotal).toBeGreaterThan(res.get(1)!.lbTotal)
  })
})

describe('computeSchafkopfLeaderboard – Determinismus', () => {
  const tables = [
    fourPlayerTable(2, '2025-02-01', 8),
    fourPlayerTable(1, '2025-01-01', 8),
  ]
  const snapshot = (m: ReturnType<typeof computeSchafkopfLeaderboard>) =>
    JSON.stringify([...m.entries()].sort((a, b) => a[0] - b[0]))

  it('ist idempotent (zweimal gleiches Ergebnis)', () => {
    expect(snapshot(computeSchafkopfLeaderboard(tables))).toBe(
      snapshot(computeSchafkopfLeaderboard(tables))
    )
  })

  it('ist unabhängig von der Eingabereihenfolge (intern chronologisch sortiert)', () => {
    const reversed = [...tables].reverse()
    expect(snapshot(computeSchafkopfLeaderboard(tables))).toBe(
      snapshot(computeSchafkopfLeaderboard(reversed))
    )
  })
})
