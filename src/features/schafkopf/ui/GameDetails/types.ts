/** One row of the score sheet: a round, and each player's score in it. */
export interface RoundRow {
  roundNumber: number
  roundId: number
  scores: { [playerId: number]: number }
}

export interface EditingCell {
  roundId: number
  playerId: number
}
