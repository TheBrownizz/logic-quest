import type { Bit } from '../../../logic/boolean'
import type { Assignment, BoolExpr } from './types'
import { assignmentOf, columnOf, evalExpr, rowCount, rowOf, withRow } from './gateToyLogic'

/**
 * IdentityBench (spec 6.4.6): two expressions side by side with filling truth tables. Pure logic.
 * Stage 4 reuses this with any pair of expressions of up to 3 variables.
 */

export interface IdentityBenchConfig {
  /** 1–3 variable names, in truth-table column order. */
  vars: string[]
  left: BoolExpr
  right: BoolExpr
}
export interface IdentityBenchState {
  /** The current input values. */
  inputs: Assignment
  /** Rows tried so far (row index: vars[0] is the most significant bit). Sorted, no repeats. */
  tried: number[]
}
export type IdentityBenchGoal =
  /** Try every row (shows the two are equivalent, or where they differ). */
  | { kind: 'all-rows' }
  /** Find a row where the two expressions differ (the expressions must not be equivalent). */
  | { kind: 'find-difference' }

/** The two expressions' values on a row. */
export function rowValues(c: IdentityBenchConfig, row: number): [Bit, Bit] {
  const a = assignmentOf(c.vars, row)
  return [evalExpr(c.left, a), evalExpr(c.right, a)]
}

/** The rows where the two expressions differ, ascending. */
export function differingRows(c: IdentityBenchConfig): number[] {
  return Array.from({ length: rowCount(c.vars.length) }, (_, r) => r).filter(r => { const [l, rt] = rowValues(c, r); return l !== rt })
}

/** Equivalent: equal on every row (perfect induction). */
export const equivalent = (c: IdentityBenchConfig): boolean => differingRows(c).length === 0

/** Both truth-table columns (row 0 first). */
export const columns = (c: IdentityBenchConfig): [Bit[], Bit[]] => [columnOf(c.vars, c.left), columnOf(c.vars, c.right)]

/** Flips one input; the row it lands on counts as tried. */
export function flip(c: IdentityBenchConfig, s: IdentityBenchState, v: string): IdentityBenchState {
  const inputs: Assignment = { ...s.inputs, [v]: s.inputs[v] ? 0 : 1 }
  return { inputs, tried: withRow(s.tried, rowOf(c.vars, inputs)) }
}

/** Sets the inputs to a table row; it counts as tried. */
export function pickRow(c: IdentityBenchConfig, s: IdentityBenchState, row: number): IdentityBenchState {
  return { inputs: assignmentOf(c.vars, row), tried: withRow(s.tried, row) }
}

/** The tried rows where the expressions differ. */
export const triedDifferences = (c: IdentityBenchConfig, s: IdentityBenchState): number[] =>
  s.tried.filter(r => { const [l, rt] = rowValues(c, r); return l !== rt })

/** The pinned starting state: every input 0, nothing tried yet. */
export function initial(c: IdentityBenchConfig): IdentityBenchState {
  return { inputs: Object.fromEntries(c.vars.map(v => [v, 0 as const])) as Assignment, tried: [] }
}

/** The state the widget shows when it opens: the starting row is on screen, so it counts as tried. */
export function opened(c: IdentityBenchConfig): IdentityBenchState {
  const s = initial(c)
  return { ...s, tried: withRow(s.tried, rowOf(c.vars, s.inputs)) }
}

export function isGoalMet(s: IdentityBenchState, g: IdentityBenchGoal, c: IdentityBenchConfig): boolean {
  if (g.kind === 'all-rows') return Array.from({ length: rowCount(c.vars.length) }, (_, r) => r).every(r => s.tried.includes(r))
  return triedDifferences(c, s).length > 0
}
