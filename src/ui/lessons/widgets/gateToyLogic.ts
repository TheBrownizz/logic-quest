import type { Bit } from '../../../logic/boolean'
import type { GateKind } from '../../../logic/circuit'
import type { Assignment, BoolExpr } from './types'

/**
 * GateToy (spec 6.4.5): input switches, a lamp, and a truth table that fills as rows are tried.
 * Pure logic. The expression is a plain function plus its display string (no parser). Stage 4 reuses this
 * with any expression of up to 3 variables.
 */

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
  /** Truth-table rows tried so far (row index: vars[0] is the most significant bit). Sorted, no repeats. */
  tried: number[]
}
export type GateToyGoal =
  /** Try every input combination. */
  | { kind: 'all-rows' }
  /** Set the switches so the lamp shows `value`. */
  | { kind: 'output'; value: Bit }

export const MAX_VARS = 3

/** Number of truth-table rows for `n` variables. */
export const rowCount = (n: number): number => 1 << n

/** The row index of an assignment: vars[0] is the most significant bit. */
export function rowOf(vars: string[], a: Assignment): number {
  return vars.reduce((acc, v) => acc * 2 + (a[v] ? 1 : 0), 0)
}

/** The assignment of a row index (inverse of rowOf). */
export function assignmentOf(vars: string[], row: number): Assignment {
  const n = vars.length
  return Object.fromEntries(vars.map((v, i) => [v, ((row >> (n - 1 - i)) & 1) as Bit]))
}

/** The expression's value under an assignment. */
export const evalExpr = (e: BoolExpr, a: Assignment): Bit => (e.fn(a) ? 1 : 0)

/** The expression's whole truth-table column, row 0 first. */
export function columnOf(vars: string[], e: BoolExpr): Bit[] {
  return Array.from({ length: rowCount(vars.length) }, (_, r) => evalExpr(e, assignmentOf(vars, r)))
}

/** `tried` with `row` added (sorted, no repeats). */
export function withRow(tried: number[], row: number): number[] {
  return tried.includes(row) ? tried : [...tried, row].sort((x, y) => x - y)
}

/** The lamp: the expression under the current switches. */
export const outputOf = (c: GateToyConfig, s: GateToyState): Bit => evalExpr(c.expr, s.inputs)

/** Flips one switch; the row it lands on counts as tried. */
export function flip(c: GateToyConfig, s: GateToyState, v: string): GateToyState {
  const inputs: Assignment = { ...s.inputs, [v]: s.inputs[v] ? 0 : 1 }
  return { inputs, tried: withRow(s.tried, rowOf(c.vars, inputs)) }
}

/** Sets every switch to a table row (clicking the row); it counts as tried. */
export function pickRow(c: GateToyConfig, s: GateToyState, row: number): GateToyState {
  return { inputs: assignmentOf(c.vars, row), tried: withRow(s.tried, row) }
}

/** The pinned starting state: every switch off, nothing tried yet. */
export function initial(c: GateToyConfig): GateToyState {
  return { inputs: Object.fromEntries(c.vars.map(v => [v, 0 as Bit])), tried: [] }
}

/** The state the widget shows when it opens: the starting row is on screen (its output is visible), so it counts as tried. */
export function opened(c: GateToyConfig): GateToyState {
  const s = initial(c)
  return { ...s, tried: withRow(s.tried, rowOf(c.vars, s.inputs)) }
}

export function isGoalMet(s: GateToyState, g: GateToyGoal, c: GateToyConfig): boolean {
  if (g.kind === 'all-rows') return s.tried.length >= rowCount(c.vars.length) && Array.from({ length: rowCount(c.vars.length) }, (_, r) => r).every(r => s.tried.includes(r))
  return outputOf(c, s) === g.value
}

// ---- drawing layout (pure, so it can be unit tested) ----
/** The expression box: its width follows the text (mono 14px ≈ 8.4 units a character). */
const CHAR_W = 8.4
const BOX_PAD = 24
const BOX_MIN = 108
/** Widest box in the standard drawing (x 148 to 300, leaving an output wire before the lamp). */
const BOX_FIT = 152
/** How far the drawing may widen for a long expression before the text is squeezed with textLength. */
const MAX_EXTRA = 180

/** Box width, the extra drawing width it needs, and the squeezed text length (when even the widest box is too narrow). */
export function boxLayout(label: string): { w: number; extra: number; textLength?: number } {
  const textW = [...label].length * CHAR_W
  const want = Math.max(BOX_MIN, Math.ceil(textW + BOX_PAD))
  const w = Math.min(want, BOX_FIT + MAX_EXTRA)
  return { w, extra: Math.max(0, w - BOX_FIT), textLength: textW + BOX_PAD > w ? w - BOX_PAD : undefined }
}
