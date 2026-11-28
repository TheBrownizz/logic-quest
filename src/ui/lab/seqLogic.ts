import type { DesignFF, LabPuzzle, MachineSpec } from '../../content/types'
import type { Bit } from '../../logic/boolean'
import { parseExpr, envOf } from '../../logic/expr'
import { dInputs, fromEquations, fsmFromRows, outputInputs, reduceStates, samePartition, stateTable, type Fsm, type Partition, type StateRow, type StateTable } from '../../logic/fsm'
import { minimizeSOP, literalCount } from '../../logic/qm'
import { excitation } from '../../logic/sequential'
import { simulateWave } from '../../logic/waveform'

/* Pure checkers for the sequential puzzle kinds (state-table, fsm-equations, waveform, state-reduce, identify). */

/**
 * The logic-core machine of a content MachineSpec. Equations are parsed with parseExpr over the state
 * variables and inputs; throws a readable error ("A: unexpected …", "missing next-state equation …").
 */
export function machineOf(spec: MachineSpec): Fsm {
  if (spec.from === 'rows') {
    return fsmFromRows({ stateVars: spec.stateVars, inputs: spec.inputs, outputs: spec.outputs, next: spec.next, out: spec.out, used: spec.used })
  }
  const vars = [...spec.stateVars, ...spec.inputs]
  const fn = (name: string, text: string) => {
    const r = parseExpr(text, vars)
    if (!r.ok) throw new Error(`${name}: ${r.error} in "${text}"`)
    return r.eval
  }
  for (const v of spec.stateVars) if (!(v in spec.next)) throw new Error(`missing next-state equation for ${v}`)
  for (const k of Object.keys(spec.next)) if (!spec.stateVars.includes(k)) throw new Error(`next-state equation for unknown variable ${k}`)
  return fromEquations({
    stateVars: spec.stateVars,
    inputs: spec.inputs,
    next: Object.fromEntries(Object.entries(spec.next).map(([k, t]) => [k, fn(k, t)])),
    out: Object.fromEntries(Object.entries(spec.out).map(([k, t]) => [k, fn(k, t)])),
    used: spec.used,
  })
}

export const tableOf = (spec: MachineSpec): StateTable => stateTable(machineOf(spec))

/** A machine driven by inputs named S and R (any case) would list the forbidden S=R=1 input (Review Focus 1). */
export const hasSRInputs = (inputs: string[]): boolean => {
  const up = inputs.map(i => i.toUpperCase())
  return up.includes('S') && up.includes('R')
}

/** The state names used across the game: S<code>. */
export const stateName = (code: number): string => `S${code}`

/** The state variables, then the inputs: the variables of every design function, MSB first. */
export const varsOf = (t: StateTable): string[] => [...t.stateVars, ...t.inputs]

/** The rows of used states, in table order (state MSB … input LSB). */
export const usedRows = (t: StateTable): StateRow[] => t.rows.filter(r => r.next !== null)

const bit = (v: number, i: number, w: number) => ((v >> (w - 1 - i)) & 1) as Bit

/* ---------- state-table ---------- */

/** What the player typed for one used row: the next-state bits (MSB first) and the output bits. null = empty. */
/**
 * The table of a state-table puzzle. With `rows` (the present states asked), only those rows need to be
 * defined: a rows machine's other codes are filled with zeros and `used` is dropped, so a machine whose asked
 * states lead to unasked ones still builds.
 */
export function puzzleTable(p: { machine: MachineSpec; rows?: number[] }): StateTable {
  if (!p.rows) return tableOf(p.machine)
  const m = p.machine
  if (m.from === 'equations') return tableOf({ ...m, used: undefined })
  const n = 1 << m.stateVars.length, nIn = 1 << m.inputs.length
  const pad = (a: number[][]) => Array.from({ length: n }, (_, s) => (p.rows!.includes(s) && a[s] ? a[s] : Array(nIn).fill(0)))
  return tableOf({ ...m, used: undefined, next: pad(m.next), out: pad(m.out) })
}

/** The rows a state-table puzzle asks: every used row, or only the present states in `rows`. */
export const askedRows = (t: StateTable, rows?: number[]): StateRow[] =>
  usedRows(t).filter(r => !rows || rows.includes(r.state))

export interface RowCells { next: Array<Bit | null>; out: Array<Bit | null> }
export interface TableCheck { ok: boolean; wrong: Array<{ row: number; col: 'next' | 'out'; bit: number }>; missing: number }

/** Compares the cells (one entry per asked row) with the table; `fill` says which columns are asked. */
export function checkStateTable(t: StateTable, cells: RowCells[], fill: 'next' | 'out' | 'both' = 'both', asked?: number[]): TableCheck {
  const rows = askedRows(t, asked)
  const wrong: TableCheck['wrong'] = []
  let missing = 0
  rows.forEach((r, i) => {
    const c = cells[i] ?? { next: [], out: [] }
    const cols: Array<['next' | 'out', number, number]> = []
    if (fill !== 'out') cols.push(['next', r.next!, t.stateBits])
    if (fill !== 'next') cols.push(['out', r.out!, t.outputs.length])
    for (const [col, v, w] of cols) for (let b = 0; b < w; b++) {
      const got = c[col][b]
      if (got === null || got === undefined) missing++
      else if (got !== bit(v, b, w)) wrong.push({ row: i, col, bit: b })
    }
  })
  return { ok: wrong.length === 0 && missing === 0, wrong, missing }
}

/* ---------- fsm-equations ---------- */

/** One function the player writes: a flip-flop input (DA, TA, JA, KA …) or an output, as a cover over varsOf. */
export interface DesignFn { name: string; kind: 'ff' | 'out'; minterms: number[]; dontCares: number[] }

/** The flip-flop input functions (state MSB first; J before K) and then the output functions of `t`. */
export function designFunctions(t: StateTable, ff: DesignFF = 'D'): DesignFn[] {
  const outs: DesignFn[] = outputInputs(t).map(c => ({ name: c.var, kind: 'out', minterms: c.minterms, dontCares: c.dontCares }))
  if (ff === 'D') return [...dInputs(t).map((c): DesignFn => ({ name: `D${c.var}`, kind: 'ff', minterms: c.minterms, dontCares: c.dontCares })), ...outs]
  const w = t.stateBits
  const fns: DesignFn[] = []
  t.stateVars.forEach((v, i) => {
    const names = ff === 'T' ? [`T${v}`] : [`J${v}`, `K${v}`]
    const covers = names.map(() => ({ minterms: [] as number[], dontCares: [] as number[] }))
    t.rows.forEach((r, idx) => {
      if (r.next === null) { covers.forEach(c => c.dontCares.push(idx)); return }
      const inp = excitation(ff, bit(r.state, i, w), bit(r.next, i, w))
      inp.forEach((x, k) => { if (x === 'x') covers[k].dontCares.push(idx); else if (x === 1) covers[k].minterms.push(idx) })
    })
    names.forEach((name, k) => fns.push({ name, kind: 'ff', ...covers[k] }))
  })
  return [...fns, ...outs]
}

/** The sum over `fns` of the QM-minimal SOP literal counts (don't-cares used). */
export function minLiterals(fns: DesignFn[], nVars: number): number {
  return fns.reduce((s, f) => s + literalCount(minimizeSOP(nVars, f.minterms, f.dontCares)), 0)
}

export type EqStatus = { status: 'ok' } | { status: 'empty' } | { status: 'parse'; error: string } | { status: 'wrong'; row: number }
export interface EquationsCheck {
  ok: boolean
  results: Record<string, EqStatus>
  literals: number
  minLiterals: number
  /** Every equation is a sum of products (required for the optimal star; correctness accepts any equivalent form). */
  sop: boolean
  optimal: boolean
}

/**
 * Checks typed equations against the covers: each must equal 1 on its minterms and 0 on every other row that
 * is not a don't-care (so any use of the don't-cares is accepted). Optimal: total literals <= the QM minimum.
 */
export function checkEquations(fns: DesignFn[], vars: string[], answers: Record<string, string>): EquationsCheck {
  const results: Record<string, EqStatus> = {}
  let literals = 0
  let sop = true
  for (const f of fns) {
    const text = (answers[f.name] ?? '').trim()
    if (text === '') { results[f.name] = { status: 'empty' }; continue }
    const e = parseExpr(text, vars)
    if (!e.ok) { results[f.name] = { status: 'parse', error: e.error }; continue }
    literals += e.literals
    sop &&= e.sop
    const ones = new Set(f.minterms), dc = new Set(f.dontCares)
    let row = -1
    for (let m = 0; m < 1 << vars.length && row < 0; m++) {
      if (dc.has(m)) continue
      if (e.eval(envOf(vars, m)) !== (ones.has(m) ? 1 : 0)) row = m
    }
    results[f.name] = row < 0 ? { status: 'ok' } : { status: 'wrong', row }
  }
  const ok = fns.every(f => results[f.name].status === 'ok')
  const min = minLiterals(fns, vars.length)
  return { ok, results, literals, minLiterals: min, sop, optimal: ok && sop && literals <= min }
}

/* ---------- waveform ---------- */

type WavePz = Extract<LabPuzzle, { type: 'waveform' }>

/** The Q the player must draw. */
export const waveAnswer = (p: Pick<WavePz, 'kind' | 'clk' | 'inputs' | 'q0'>): Bit[] => simulateWave(p.kind, p.clk, p.inputs, p.q0)

/** Columns where the drawn Q is wrong or empty. */
export function checkWave(p: Pick<WavePz, 'kind' | 'clk' | 'inputs' | 'q0'>, q: Array<Bit | null>): { ok: boolean; wrong: number[] } {
  const want = waveAnswer(p)
  const wrong = want.flatMap((v, i) => (q[i] === v ? [] : [i]))
  return { ok: wrong.length === 0, wrong }
}

/* ---------- state-reduce ---------- */

/** The used state codes of a table, ascending. */
export const usedStates = (t: StateTable): number[] => [...new Set(usedRows(t).map(r => r.state))]

/**
 * The player's grouping (state code → any group label) against reduceStates. Labels and group order do not
 * matter. `unassigned`: used states with no group; `expectedGroups`: how many classes the machine has.
 */
export function checkPartition(t: StateTable, groups: Record<number, number>): { ok: boolean; unassigned: number[]; expectedGroups: number } {
  const states = usedStates(t)
  const want = reduceStates(t)
  const unassigned = states.filter(s => groups[s] === undefined)
  if (unassigned.length) return { ok: false, unassigned, expectedGroups: want.length }
  const by = new Map<number, number[]>()
  for (const s of states) by.set(groups[s], [...(by.get(groups[s]) ?? []), s])
  const got: Partition = [...by.values()]
  return { ok: samePartition(got, want), unassigned, expectedGroups: want.length }
}
