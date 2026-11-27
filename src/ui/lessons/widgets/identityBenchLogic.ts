import type { Assignment, BoolExpr } from './types'

/** IdentityBench (spec 6.4.6): two expressions side by side with filling truth tables. Logic stub: Task 4. */

export interface IdentityBenchConfig {
  /** 1–3 variable names, in truth-table column order. */
  vars: string[]
  left: BoolExpr
  right: BoolExpr
}
export interface IdentityBenchState {
  /** The current input values. */
  inputs: Assignment
  /** Rows tried so far (row index: vars[0] is the most significant bit). */
  tried: number[]
}
export type IdentityBenchGoal =
  /** Try every row (shows the two are equivalent, or where they differ). */
  | { kind: 'all-rows' }
  /** Find a row where the two expressions differ (the expressions must not be equivalent). */
  | { kind: 'find-difference' }

export function initial(c: IdentityBenchConfig): IdentityBenchState {
  return { inputs: Object.fromEntries(c.vars.map(v => [v, 0 as const])), tried: [] }
}

export function isGoalMet(_s: IdentityBenchState, _g: IdentityBenchGoal, _c: IdentityBenchConfig): boolean {
  return true
}
