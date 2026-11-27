import type { Bit } from '../../../logic/boolean'

/** MuxToy (spec 6.4.9): a MUX whose select lines route one data input to the output. Logic stub: Task 6. */

export interface MuxToyConfig {
  /** Number of select lines (2^n data inputs). */
  selectBits: 1 | 2 | 3
  /** 'route': flip select lines and data inputs and watch the routing. 'function': set the data inputs to implement f. */
  mode: 'route' | 'function'
  /** Starting data inputs, length 2^selectBits (D0 first). Default: all zero. */
  inputs?: Bit[]
  /** Short names of the select lines, most significant first (e.g. ['A', 'B']). Default S1, S0 … */
  selectNames?: string[]
}
export interface MuxToyState {
  /** Select line values, most significant first. */
  select: Bit[]
  /** Data input values, D0 first. */
  inputs: Bit[]
}
export type MuxToyGoal =
  /** Route data input D`input` to the output (select = input). */
  | { kind: 'route'; input: number }
  /** Data inputs implement f(select) = Σm(minterms): D_i = 1 exactly for i in minterms. */
  | { kind: 'implements'; minterms: number[] }

export function initial(c: MuxToyConfig): MuxToyState {
  const n = 1 << c.selectBits
  return { select: Array.from({ length: c.selectBits }, () => 0 as Bit), inputs: c.inputs ? [...c.inputs] : Array.from({ length: n }, () => 0 as Bit) }
}

export function isGoalMet(_s: MuxToyState, _g: MuxToyGoal, _c: MuxToyConfig): boolean {
  return true
}
