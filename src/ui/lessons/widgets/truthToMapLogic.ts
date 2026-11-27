/** TruthToMap (spec 6.4.7): truth-table rows fly to their Karnaugh-map cells (Gray order). Logic stub: Task 5. */

export interface TruthToMapConfig {
  /** 2–4; variables are A, B, C, D (A most significant), as in the k-map rooms. */
  nVars: 2 | 3 | 4
  minterms: number[]
  dontCares?: number[]
}
export interface TruthToMapState {
  /** Rows (minterm numbers) already moved onto the map. */
  placed: number[]
  /** Map cells (minterm numbers) the player has selected. */
  picked: number[]
}
export type TruthToMapGoal =
  /** Move every row onto the map. */
  | { kind: 'all-placed' }
  /** Select exactly these cells (e.g. the neighbours of a cell, or a valid group). */
  | { kind: 'pick'; cells: number[] }

export function initial(_c: TruthToMapConfig): TruthToMapState {
  return { placed: [], picked: [] }
}

export function isGoalMet(_s: TruthToMapState, _g: TruthToMapGoal, _c: TruthToMapConfig): boolean {
  return true
}
