import type { MachineSpec } from '../../../content/types'
import type { StateTable } from '../../../logic/fsm'
import { tableOf } from '../../lab/seqLogic'

/**
 * StateWalker (spec 6.4): a state diagram where the player feeds inputs and the current state jumps along the
 * arrow. It shows where a Moore or Mealy output is written. Pure: no DOM.
 * `kind` is how the diagram is drawn: 'moore' needs a Moore machine (the lesson validator checks it).
 */
export interface StateWalkerConfig {
  /** The machine (states S<code>). */
  table: MachineSpec
  kind: 'moore' | 'mealy'
  /** Diagram layout; default 'auto' (row, triangle, square, circle by state count). */
  layout?: 'auto' | 'row' | 'circle'
  /** Starting state code (default: the lowest used code). */
  start?: number
}
/** One step: in state `from` the player applied input `input`; the machine went to `to` and showed `out`. */
export interface WalkStep { from: number; input: number; to: number; out: number }
export interface StateWalkerState {
  /** The current state code. */
  state: number
  /** Every step so far, oldest first. */
  history: WalkStep[]
}
export type StateWalkerGoal =
  /** Get to state `state` (at least one step). */
  | { kind: 'reach'; state: number }
  /**
   * Produce this output sequence: the outputs of the last steps equal `seq` (Mealy: the output on each arrow
   * taken; Moore: the output of each state entered).
   */
  | { kind: 'outputs'; seq: number[] }

const cache = new WeakMap<MachineSpec, StateTable>()
export function tableOfConfig(c: StateWalkerConfig): StateTable {
  let t = cache.get(c.table)
  if (!t) { t = tableOf(c.table); cache.set(c.table, t) }
  return t
}

const usedCodes = (t: StateTable) => [...new Set(t.rows.filter(r => r.next !== null).map(r => r.state))]

export function initial(c: StateWalkerConfig): StateWalkerState {
  const t = tableOfConfig(c)
  const start = c.start ?? Math.min(...usedCodes(t))
  if (!usedCodes(t).includes(start)) throw new Error(`start state ${start} is not a used state`)
  return { state: start, history: [] }
}

/** The state after applying input code `input`. Moore: the step's output is the new state's output. */
export function step(s: StateWalkerState, c: StateWalkerConfig, input: number): StateWalkerState {
  const t = tableOfConfig(c)
  const nIn = 1 << t.inputs.length
  const row = t.rows[s.state * nIn + input]
  const to = row.next!
  const out = c.kind === 'moore' ? t.rows[to * nIn].out! : row.out!
  return { state: to, history: [...s.history, { from: s.state, input, to, out }] }
}

export function isGoalMet(s: StateWalkerState, g: StateWalkerGoal, _c: StateWalkerConfig): boolean {
  switch (g.kind) {
    case 'reach': return s.history.length > 0 && s.state === g.state
    case 'outputs': {
      const outs = s.history.map(h => h.out)
      return g.seq.length > 0 && outs.length >= g.seq.length && g.seq.every((v, i) => outs[outs.length - g.seq.length + i] === v)
    }
    default: return false
  }
}
