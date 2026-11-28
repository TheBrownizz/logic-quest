import type { Bit } from '../../../logic/boolean'

/**
 * LatchToy (spec 6.4): a latch built from two cross-coupled gates (or a gated latch) with animated feedback.
 * The player flips the inputs and watches Q "catch" the value, hold it, and (SR) hit the forbidden input.
 * Pure: no DOM, so the lesson validator can run it in node. Task 3 may refine the logic but keeps these types.
 *
 * Inputs by kind (the state's `inputs` holds exactly these keys, plus E when `enable`):
 * - 'SR-NOR':  S, R active high. 10 set, 01 reset, 00 hold, 11 forbidden (Q = Q' = 0).
 * - 'SR-NAND': S, R active low (drawn S', R'). 01 set, 10 reset, 11 hold, 00 forbidden (Q = Q' = 1).
 * - 'D':       D (and E): Q follows D while enabled. Always has an enable (E).
 * - 'JK':      J, K (and E): 10 set, 01 reset, 00 hold, 11 toggles once per change into 11 while enabled
 *              (the real level-sensitive JK latch races; the widget shows one toggle and says so).
 */
export type LatchKind = 'SR-NOR' | 'SR-NAND' | 'D' | 'JK'

export interface LatchToyConfig {
  kind: LatchKind
  /** Add an enable input E (gated latch). Implied for 'D' and 'JK'. */
  enable?: boolean
  /** Q before the first change (default 0). */
  q0?: Bit
  /** Show the inner gates and the feedback wires (default true). */
  showGates?: boolean
}
export interface LatchToyState {
  /** Input values by name (S, R, D, J, K, E). */
  inputs: Record<string, Bit>
  q: Bit
  /** Q' as the gates drive it: equal to Q only in the forbidden state. */
  qn: Bit
  /** Times Q changed since the start. */
  changes: number
  /** The forbidden input was applied at least once. */
  sawForbidden: boolean
  /** Times a JK latch toggled. */
  toggles: number
}
export type LatchToyGoal =
  /** Reach Q = value. */
  | { kind: 'q'; value: Bit }
  /** Store `value` and then hold it: Q = value with the inputs at "hold" (and/or E = 0). */
  | { kind: 'hold'; value: Bit }
  /** Apply the forbidden SR input (Q = Q'). */
  | { kind: 'forbidden' }
  /** Make a JK latch toggle at least `count` times. */
  | { kind: 'toggle'; count: number }

export const hasEnable = (c: LatchToyConfig): boolean => c.enable === true || c.kind === 'D' || c.kind === 'JK'

/** The input names of a configuration, in display order. */
export function inputNames(c: LatchToyConfig): string[] {
  const base = c.kind === 'D' ? ['D'] : c.kind === 'JK' ? ['J', 'K'] : ['S', 'R']
  return hasEnable(c) ? [...base, 'E'] : base
}

/** The inputs at rest: hold for SR (NAND inputs idle at 1), E = 0. */
export function initial(c: LatchToyConfig): LatchToyState {
  const idle: Bit = c.kind === 'SR-NAND' ? 1 : 0
  const inputs = Object.fromEntries(inputNames(c).map(n => [n, n === 'E' ? 0 : idle])) as Record<string, Bit>
  const q = c.q0 ?? 0
  return { inputs, q, qn: (q ^ 1) as Bit, changes: 0, sawForbidden: false, toggles: 0 }
}

/** Whether the latch's inputs are the forbidden SR combination (only while enabled). */
export function isForbiddenInput(c: LatchToyConfig, inputs: Record<string, Bit>): boolean {
  if (hasEnable(c) && inputs.E === 0) return false
  if (c.kind === 'SR-NOR') return inputs.S === 1 && inputs.R === 1
  if (c.kind === 'SR-NAND') return inputs.S === 0 && inputs.R === 0
  return false
}

/** Whether the inputs hold the stored value (E = 0, or the SR/JK hold combination). */
export function isHolding(c: LatchToyConfig, inputs: Record<string, Bit>): boolean {
  if (hasEnable(c) && inputs.E === 0) return true
  if (c.kind === 'SR-NOR' || c.kind === 'JK') return (c.kind === 'JK' ? inputs.J === 0 && inputs.K === 0 : inputs.S === 0 && inputs.R === 0)
  if (c.kind === 'SR-NAND') return inputs.S === 1 && inputs.R === 1
  return false
}

/** The state after setting input `name` to `v`. */
export function setInput(s: LatchToyState, c: LatchToyConfig, name: string, v: Bit): LatchToyState {
  const inputs = { ...s.inputs, [name]: v }
  const enabled = !hasEnable(c) || inputs.E === 1
  let q = s.q, qn = s.qn, toggles = s.toggles, sawForbidden = s.sawForbidden
  if (isForbiddenInput(c, inputs)) {
    const both: Bit = c.kind === 'SR-NOR' ? 0 : 1
    q = both; qn = both; sawForbidden = true
  } else if (enabled) {
    const i = inputs
    let next: Bit | null = null
    if (c.kind === 'SR-NOR') next = i.S ? 1 : i.R ? 0 : null
    else if (c.kind === 'SR-NAND') next = i.S === 0 ? 1 : i.R === 0 ? 0 : null
    else if (c.kind === 'D') next = i.D
    else if (i.J && i.K) {
      const entered = !(s.inputs.J && s.inputs.K && (s.inputs.E ?? 1))
      if (entered) { next = (s.q ^ 1) as Bit; toggles++ }
    } else next = i.J ? 1 : i.K ? 0 : null
    if (next !== null) { q = next; qn = (next ^ 1) as Bit }
    else if (q === qn) qn = (q ^ 1) as Bit // leaving the forbidden state into hold: the latch settles (Q kept)
  }
  return { inputs, q, qn, toggles, sawForbidden, changes: s.changes + (q !== s.q ? 1 : 0) }
}

export function isGoalMet(s: LatchToyState, g: LatchToyGoal, c: LatchToyConfig): boolean {
  switch (g.kind) {
    case 'q': return s.q === g.value && s.qn !== s.q
    case 'hold': return s.q === g.value && s.qn !== s.q && isHolding(c, s.inputs) && s.changes > 0
    case 'forbidden': return s.sawForbidden && s.q === s.qn
    case 'toggle': return c.kind === 'JK' && s.toggles >= g.count
    default: return false
  }
}
