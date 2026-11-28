import type { Bit } from './boolean'

/**
 * Finite state machine. States are integer codes; the first state variable is the MSB.
 * Inputs and outputs are integers too: inputs[0] / outputs[0] is the MSB.
 */
export interface Fsm {
  stateBits: number
  stateVars: string[]
  inputs: string[]
  outputs: string[]
  kind: 'moore' | 'mealy'
  /** Valid state codes. Codes not listed are unused (don't-care). Default: all. */
  used?: number[]
  next(s: number, x: number): number
  out(s: number, x: number): number
}

export interface StateRow {
  state: number
  input: number
  /** null for unused state codes */
  next: number | null
  out: number | null
}

/** rows[(state << inputs.length) | input]: state MSB ... input LSB. */
export interface StateTable {
  stateBits: number
  stateVars: string[]
  inputs: string[]
  outputs: string[]
  kind: 'moore' | 'mealy'
  rows: StateRow[]
}

export interface FnCover {
  var: string
  minterms: number[]
  dontCares: number[]
}

export type Partition = number[][]

const usedList = (f: { stateBits: number; used?: number[] }) =>
  f.used ? [...f.used].sort((a, b) => a - b) : Array.from({ length: 1 << f.stateBits }, (_, i) => i)

/** Build an Fsm from literal next/out arrays: next[s][x], out[s][x] (state code s, input code x). */
export function fsmFromRows(spec: {
  stateVars: string[]
  inputs: string[]
  outputs: string[]
  next: number[][]
  out: number[][]
  used?: number[]
}): Fsm {
  const stateBits = spec.stateVars.length
  const nStates = 1 << stateBits
  const nIn = 1 << spec.inputs.length
  const nOutVals = 1 << spec.outputs.length
  const used = usedList({ stateBits, used: spec.used })
  const isUsed = new Set(used)
  const ok = (m: number[][], limit: number, what: string) => {
    if (m.length > nStates) throw new Error(`${what}: at most ${nStates} state rows, got ${m.length}`)
    for (const s of used) {
      if (!m[s] || m[s].length !== nIn) throw new Error(`${what}: state ${s} needs ${nIn} entries`)
      for (const v of m[s]) {
        if (!Number.isInteger(v) || v < 0 || v >= limit) throw new Error(`${what}: value ${v} out of range`)
      }
    }
  }
  ok(spec.next, nStates, 'next')
  ok(spec.out, nOutVals, 'out')
  for (const s of used) {
    for (const v of spec.next[s]) {
      if (!isUsed.has(v)) throw new Error(`next: state ${s} goes to unused state ${v}`)
    }
  }
  const base = {
    stateBits,
    stateVars: [...spec.stateVars],
    inputs: [...spec.inputs],
    outputs: [...spec.outputs],
    used: spec.used ? used : undefined,
    next: (s: number, x: number) => spec.next[s]?.[x] ?? 0,
    out: (s: number, x: number) => spec.out[s]?.[x] ?? 0,
  }
  return { ...base, kind: kindOf(base, used, nIn) }
}

function kindOf(f: Pick<Fsm, 'out'>, used: number[], nIn: number): 'moore' | 'mealy' {
  for (const s of used) {
    for (let x = 1; x < nIn; x++) if (f.out(s, x) !== f.out(s, 0)) return 'mealy'
  }
  return 'moore'
}

/**
 * Build a machine from Boolean next-state / output equations, one function per variable.
 * Each function receives every state variable and input by name. Missing next-state
 * equations for a state variable throw.
 */
export function fromEquations(eqs: {
  stateVars: string[]
  inputs: string[]
  next: Record<string, (v: Record<string, Bit>) => Bit>
  out: Record<string, (v: Record<string, Bit>) => Bit>
  used?: number[]
}): Fsm {
  const { stateVars, inputs } = eqs
  const outputs = Object.keys(eqs.out)
  for (const n of stateVars) if (!eqs.next[n]) throw new Error(`missing next-state equation for ${n}`)
  const env = (s: number, x: number) => {
    const v: Record<string, Bit> = {}
    stateVars.forEach((n, i) => (v[n] = ((s >> (stateVars.length - 1 - i)) & 1) as Bit))
    inputs.forEach((n, i) => (v[n] = ((x >> (inputs.length - 1 - i)) & 1) as Bit))
    return v
  }
  const pack = (names: string[], fns: Record<string, (v: Record<string, Bit>) => Bit>, v: Record<string, Bit>) =>
    names.reduce((acc, n) => (acc << 1) | fns[n](v), 0)
  const base = {
    stateBits: stateVars.length,
    stateVars: [...stateVars],
    inputs: [...inputs],
    outputs,
    used: eqs.used,
    next: (s: number, x: number) => pack(stateVars, eqs.next, env(s, x)),
    out: (s: number, x: number) => pack(outputs, eqs.out, env(s, x)),
  }
  return { ...base, kind: kindOf(base, usedList(base), 1 << inputs.length) }
}

export function stateTable(fsm: Fsm): StateTable {
  const nIn = 1 << fsm.inputs.length
  const used = new Set(usedList(fsm))
  const rows: StateRow[] = []
  for (let s = 0; s < 1 << fsm.stateBits; s++) {
    for (let x = 0; x < nIn; x++) {
      rows.push(
        used.has(s)
          ? { state: s, input: x, next: fsm.next(s, x), out: fsm.out(s, x) }
          : { state: s, input: x, next: null, out: null },
      )
    }
  }
  return { stateBits: fsm.stateBits, stateVars: [...fsm.stateVars], inputs: [...fsm.inputs], outputs: [...fsm.outputs], kind: fsm.kind, rows }
}

const bitOf = (v: number, i: number, n: number) => (v >> (n - 1 - i)) & 1

function cover(table: StateTable, names: string[], pick: (r: StateRow) => number | null): FnCover[] {
  return names.map((name, i) => {
    const minterms: number[] = []
    const dontCares: number[] = []
    table.rows.forEach((r, idx) => {
      const v = pick(r)
      if (v === null) dontCares.push(idx)
      else if (bitOf(v, i, names.length)) minterms.push(idx)
    })
    return { var: name, minterms, dontCares }
  })
}

/** For each D flip-flop (state MSB first): minterms and don't-cares over (state vars, inputs), MSB..LSB. */
export function dInputs(table: StateTable): FnCover[] {
  return cover(table, table.stateVars, r => r.next)
}

/** Same for each output function. */
export function outputInputs(table: StateTable): FnCover[] {
  return cover(table, table.outputs, r => r.out)
}

/** Output depends on the state only. */
export function isMoore(table: StateTable): boolean {
  const nIn = 1 << table.inputs.length
  for (let s = 0; s < table.rows.length; s += nIn) {
    for (let x = 1; x < nIn; x++) if (table.rows[s + x].out !== table.rows[s].out) return false
  }
  return true
}

/**
 * Equivalence-class partition of the used states of a completely specified machine
 * (output-first partition refinement). Groups and members are sorted by state code.
 */
export function reduceStates(table: StateTable): Partition {
  const nIn = 1 << table.inputs.length
  const states = [...new Set(table.rows.filter(r => r.next !== null).map(r => r.state))]
  const row = (s: number, x: number) => table.rows[s * nIn + x]
  let block = new Map<number, number>()
  const refine = (key: (s: number) => string) => {
    const ids = new Map<string, number>()
    const nb = new Map<number, number>()
    for (const s of states) {
      const k = key(s)
      if (!ids.has(k)) ids.set(k, ids.size)
      nb.set(s, ids.get(k)!)
    }
    return nb
  }
  block = refine(s => Array.from({ length: nIn }, (_, x) => row(s, x).out).join(','))
  for (;;) {
    const nb = refine(s => `${block.get(s)}|` + Array.from({ length: nIn }, (_, x) => block.get(row(s, x).next!)).join(','))
    const same = new Set(nb.values()).size === new Set(block.values()).size
    block = nb
    if (same) break
  }
  const groups = new Map<number, number[]>()
  for (const s of states) {
    const b = block.get(s)!
    groups.set(b, [...(groups.get(b) ?? []), s])
  }
  return [...groups.values()].sort((a, b) => a[0] - b[0])
}

/** Same partition regardless of group order, member order, or group naming. */
export function samePartition(a: Partition, b: Partition): boolean {
  const canon = (p: Partition) =>
    p
      .map(g => [...g].sort((x, y) => x - y).join(','))
      .sort()
      .join('|')
  return canon(a) === canon(b)
}

/** True when the reduced machine has at most 2 states (one flip-flop of any type suffices). */
export function canUseSingleFlipFlop(table: StateTable): boolean {
  return reduceStates(table).length <= 2
}
