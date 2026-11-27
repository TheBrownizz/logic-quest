import type { Bit } from '../../../logic/boolean'
import type { GateKind } from '../../../logic/circuit'
import type { Assignment, BoolExpr } from './types'

/** GateToy (spec 6.4.5): input switches, a lamp, and a truth table that fills as rows are tried. Logic stub: Task 4. */

export interface GateToyConfig {
  /** 1–3 variable names, in truth-table column order (e.g. ['A', 'B']). */
  vars: string[]
  expr: BoolExpr
  /** Draw a single gate of this kind (its inputs are `vars`); otherwise draw the expression as a box. */
  gate?: GateKind
}
export interface GateToyState {
  /** The switch positions. */
  inputs: Assignment
  /** Truth-table rows tried so far (row index: vars[0] is the most significant bit). */
  tried: number[]
}
export type GateToyGoal =
  /** Try every input combination. */
  | { kind: 'all-rows' }
  /** Set the switches so the lamp shows `value`. */
  | { kind: 'output'; value: Bit }

export function initial(c: GateToyConfig): GateToyState {
  return { inputs: Object.fromEntries(c.vars.map(v => [v, 0 as Bit])), tried: [] }
}

export function isGoalMet(_s: GateToyState, _g: GateToyGoal, _c: GateToyConfig): boolean {
  return true
}
