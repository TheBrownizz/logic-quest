import type { Bit } from '../../../logic/boolean'

/**
 * MuxToy (spec 6.4.9): a MUX whose select lines route one data input to the output.
 *
 * Two additions to the pinned types, both optional and used only by this widget:
 * - `extra` (config): the name of one more variable X. The data inputs then cycle through 0, 1, X and X', so
 *   n select lines implement a function of n+1 variables (the select lines carry the first n, X is the last).
 *   The state then also holds `data` (what each input is wired to) and `x` (the value of X); `inputs` is always
 *   what those mean at the current X.
 * - `skin: 'rom'` (config): the same box drawn as a ROM (address lines, stored cells), for the ROM lesson.
 * - goal `implements-x` : the function of n+1 variables Σm(minterms), X the least significant variable.
 *
 * Pure: no DOM, so the lesson validator can run it in node.
 */

/** What a data input is wired to in `extra` mode: a constant, X, or X'. */
export type DataSrc = 0 | 1 | 'x' | 'nx'
export const DATA_CYCLE: readonly DataSrc[] = [0, 1, 'x', 'nx']

export interface MuxToyConfig {
  /** Number of select lines (2^n data inputs). */
  selectBits: 1 | 2 | 3
  /** 'route': flip select lines and data inputs and watch the routing. 'function': set the data inputs to implement f. */
  mode: 'route' | 'function'
  /** Starting data inputs, length 2^selectBits (D0 first). Default: all zero. */
  inputs?: Bit[]
  /** Short names of the select lines, most significant first (e.g. ['A', 'B']). Default S1, S0 … */
  selectNames?: string[]
  /** Name of the extra variable X (function mode); see the file comment. */
  extra?: string
  /** Draw the box as a ROM (address lines and stored cells). */
  skin?: 'rom'
}
export interface MuxToyState {
  /** Select line values, most significant first. */
  select: Bit[]
  /** Data input values, D0 first. */
  inputs: Bit[]
  /** `extra` mode: what each data input is wired to, D0 first. */
  data?: DataSrc[]
  /** `extra` mode: the value of X. */
  x?: Bit
}
export type MuxToyGoal =
  /** Route data input D`input` to the output (select = input). */
  | { kind: 'route'; input: number }
  /** Data inputs implement f(select) = Σm(minterms): D_i = 1 exactly for i in minterms. */
  | { kind: 'implements'; minterms: number[] }
  /** `extra` mode: the data inputs implement the (n+1)-variable function Σm(minterms), select lines first, X last. */
  | { kind: 'implements-x'; minterms: number[] }

/** Number of data inputs. */
export const dataCount = (c: Pick<MuxToyConfig, 'selectBits'>): number => 1 << c.selectBits

/** Select line names, most significant first. */
export function selectNames(c: MuxToyConfig): string[] {
  if (c.selectNames && c.selectNames.length === c.selectBits) return c.selectNames
  return Array.from({ length: c.selectBits }, (_, k) => `S${c.selectBits - 1 - k}`)
}

/** The value of a data source at X = x. */
export const evalSrc = (src: DataSrc, x: Bit): Bit => (src === 'x' ? x : src === 'nx' ? ((x ^ 1) as Bit) : src)

/** Index of the selected data input: the select lines read as a binary number, most significant first. */
export const selectIndex = (select: Bit[]): number => select.reduce<number>((acc, b) => acc * 2 + b, 0)

export function initial(c: MuxToyConfig): MuxToyState {
  const n = dataCount(c)
  const select = Array.from({ length: c.selectBits }, () => 0 as Bit)
  if (c.extra !== undefined) {
    const data = Array.from({ length: n }, () => 0 as DataSrc)
    return { select, inputs: data.map(() => 0 as Bit), data, x: 0 }
  }
  return { select, inputs: c.inputs ? [...c.inputs] : Array.from({ length: n }, () => 0 as Bit) }
}

/** The state after setting select line `k` (0 = the most significant) to `v`. */
export function setSelect(s: MuxToyState, k: number, v: Bit): MuxToyState {
  return { ...s, select: s.select.map((b, i) => (i === k ? v : b)) }
}

/** The state after flipping data input `i` (constants 0/1 only; in `extra` mode use cycleData). */
export function toggleInput(s: MuxToyState, i: number): MuxToyState {
  return { ...s, inputs: s.inputs.map((b, j) => (j === i ? ((b ^ 1) as Bit) : b)) }
}

/** `extra` mode: recompute `inputs` from `data` and `x`. */
export function withData(s: MuxToyState, data: DataSrc[], x: Bit): MuxToyState {
  return { ...s, data, x, inputs: data.map(d => evalSrc(d, x)) }
}

/** `extra` mode: the next source for data input `i` (0 → 1 → X → X' → 0). */
export function cycleData(s: MuxToyState, i: number): MuxToyState {
  const data = s.data ?? s.inputs
  const next = data.map((d, j) => (j === i ? DATA_CYCLE[(DATA_CYCLE.indexOf(d) + 1) % DATA_CYCLE.length] : d))
  return withData(s, next, s.x ?? 0)
}

/** `extra` mode: the state after setting X. */
export const setX = (s: MuxToyState, x: Bit): MuxToyState => withData(s, s.data ?? s.inputs, x)

/** The output Y: the selected data input. */
export const output = (s: MuxToyState): Bit => s.inputs[selectIndex(s.select)]

/** The minterms the MUX implements right now, sorted: over the select lines, or with X as the last variable. */
export function implementedMinterms(s: MuxToyState, c: MuxToyConfig): number[] {
  const out: number[] = []
  if (c.extra !== undefined) {
    const data = s.data ?? []
    data.forEach((d, i) => {
      if (evalSrc(d, 0)) out.push(2 * i)
      if (evalSrc(d, 1)) out.push(2 * i + 1)
    })
  } else {
    s.inputs.forEach((b, i) => { if (b) out.push(i) })
  }
  return out
}

/**
 * The data source a row needs to implement Σm(minterms) of n+1 variables (X last): the pair (F(i,0), F(i,1))
 * is (0,0) → 0, (1,1) → 1, (0,1) → X, (1,0) → X'.
 */
export function requiredData(minterms: number[], selectBits: number): DataSrc[] {
  const set = new Set(minterms)
  return Array.from({ length: 1 << selectBits }, (_, i): DataSrc => {
    const f0 = set.has(2 * i), f1 = set.has(2 * i + 1)
    return f0 && f1 ? 1 : !f0 && !f1 ? 0 : f1 ? 'x' : 'nx'
  })
}

const sameSet = (a: number[], b: number[]) => a.length === b.length && [...a].sort((p, q) => p - q).every((v, i) => v === [...b].sort((p, q) => p - q)[i])

/** A state that meets `g` (the final state a revisited, completed step shows). */
export function goalState(c: MuxToyConfig, g: MuxToyGoal): MuxToyState {
  const s = initial(c)
  switch (g.kind) {
    case 'route': return { ...s, select: s.select.map((_, k) => ((g.input >> (c.selectBits - 1 - k)) & 1) as Bit) }
    case 'implements': return { ...s, inputs: s.inputs.map((_, i) => (g.minterms.includes(i) ? 1 : 0) as Bit) }
    case 'implements-x': return withData(s, requiredData(g.minterms, c.selectBits), s.x ?? 0)
    default: return s
  }
}

export function isGoalMet(s: MuxToyState, g: MuxToyGoal, c: MuxToyConfig): boolean {
  switch (g.kind) {
    case 'route': return selectIndex(s.select) === g.input
    case 'implements': return c.extra === undefined && sameSet(implementedMinterms(s, c), g.minterms)
    case 'implements-x': return c.extra !== undefined && sameSet(implementedMinterms(s, c), g.minterms)
    default: return false
  }
}
