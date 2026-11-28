import { fromBase, toBase } from '../../../logic/numbers'

/**
 * BaseConvert (spec 6.4.2): base conversion step by step. 'divide' mode divides by the target base again and again
 * (each remainder is the next digit, last-found first). 'group' mode regroups bits: 3 bits per octal digit, 4 per
 * hex digit; a binary source is cut into groups from the right, an octal/hex source is expanded digit by digit.
 */

export interface BaseConvertConfig {
  /** Base of `value`: 10 in 'divide' mode; 2, 8 or 16 in 'group' mode. */
  from: number
  /** Target base: 2–16 in 'divide' mode; 2, 8 or 16 in 'group' mode (from ≠ to). */
  to: number
  /** The number to convert, written in base `from` (0-9, A-F). */
  value: string
  /** 'divide': repeated division, each step drops a remainder into the result. 'group': bits regroup into 3s or 4s. */
  mode: 'divide' | 'group'
}
export interface BaseConvertState {
  /** Steps the player has performed (divisions, or groups formed). */
  step: number
  /** The result digits revealed so far, most significant first. */
  result: string
  /** Every step is done and `result` is the whole converted number. */
  finished: boolean
}
export interface BaseConvertGoal {
  /** Run the conversion to the end. */
  finished: true
}

/** One division of the 'divide' mode: n = q·base + r. */
export interface DivStep { n: number; q: number; r: number }
/** One step of the 'group' mode: `bits` (3 or 4, padded with zeros on the left when needed) ↔ one digit of the other base. */
export interface GroupStep { bits: string; digit: string; padded: number }
export interface GroupPlan {
  /** 'cut': a binary source is cut into groups, right to left; 'expand': a source digit opens into its bits, left to right. */
  kind: 'cut' | 'expand'
  /** Bits per group (3 for octal, 4 for hex). */
  size: number
  /** The whole number in binary, no leading zeros. */
  bits: string
  steps: GroupStep[]
}

const BITS: Record<number, number> = { 2: 1, 8: 3, 16: 4 }

function checkConfig(c: BaseConvertConfig): number {
  if (c.mode === 'divide') {
    if (!Number.isInteger(c.to) || c.to < 2 || c.to > 16) throw new RangeError(`BaseConvert: target base ${c.to} is not 2–16`)
  } else {
    if (!(c.from in BITS) || !(c.to in BITS) || c.from === c.to) throw new RangeError(`BaseConvert: group mode needs two different bases from 2, 8, 16`)
  }
  if (!Number.isInteger(c.from) || c.from < 2 || c.from > 16) throw new RangeError(`BaseConvert: source base ${c.from} is not 2–16`)
  return fromBase(c.value, c.from) // throws on a digit that does not belong to the source base
}

/** The value being converted. */
export const valueOfConfig = (c: BaseConvertConfig): number => checkConfig(c)

/** The repeated divisions of n by `base`, until the quotient is 0 (n = 0 takes one step). */
export function divisionSteps(n: number, base: number): DivStep[] {
  const out: DivStep[] = []
  let v = n
  do {
    out.push({ n: v, q: Math.floor(v / base), r: v % base })
    v = Math.floor(v / base)
  } while (v > 0)
  return out
}

/** The group plan of 'group' mode. */
export function groupPlan(c: BaseConvertConfig): GroupPlan {
  const n = checkConfig(c)
  const bits = toBase(n, 2)
  if (c.to === 2) {
    const size = BITS[c.from]
    const digits = toBase(n, c.from)
    const steps = [...digits].map(ch => ({ digit: ch, bits: parseInt(ch, 16).toString(2).padStart(size, '0'), padded: 0 }))
    return { kind: 'expand', size, bits, steps }
  }
  const size = BITS[c.to]
  const len = Math.ceil(bits.length / size) * size
  const padded = bits.padStart(len, '0')
  const steps: GroupStep[] = []
  for (let end = len; end > 0; end -= size) {
    const g = padded.slice(end - size, end)
    // how many of this group's bits are padding (only the leftmost group can have any)
    const pad = Math.max(0, size - Math.max(0, bits.length - (len - end)))
    steps.push({ bits: g, digit: parseInt(g, 2).toString(16).toUpperCase(), padded: Math.min(pad, size) })
  }
  return { kind: 'cut', size, bits, steps }
}

/** How many steps the conversion has. */
export function totalSteps(c: BaseConvertConfig): number {
  const n = checkConfig(c)
  return c.mode === 'divide' ? divisionSteps(n, c.to).length : groupPlan(c).steps.length
}

/** The whole converted number, written in the target base. */
export function expected(c: BaseConvertConfig): string {
  return toBase(checkConfig(c), c.to)
}

const stripZeros = (s: string) => s.replace(/^0+(?=.)/, '')

/** The state after `step` steps. */
export function stateAt(c: BaseConvertConfig, step: number): BaseConvertState {
  const total = totalSteps(c)
  const k = Math.max(0, Math.min(step, total))
  let result = ''
  if (k > 0) {
    if (c.mode === 'divide') {
      const rems = divisionSteps(checkConfig(c), c.to).slice(0, k).map(d => d.r.toString(16).toUpperCase())
      result = rems.reverse().join('') // the remainder found last is the most significant digit
    } else {
      const plan = groupPlan(c)
      result = plan.kind === 'cut'
        ? plan.steps.slice(0, k).map(s => s.digit).reverse().join('')
        : stripZeros(plan.steps.slice(0, k).map(s => s.bits).join(''))
    }
  }
  return { step: k, result, finished: k >= total }
}

/** One more step (no change once finished). */
export const advance = (c: BaseConvertConfig, s: BaseConvertState): BaseConvertState => stateAt(c, s.step + 1)

export function initial(c: BaseConvertConfig): BaseConvertState {
  checkConfig(c)
  return stateAt(c, 0)
}

export function isGoalMet(s: BaseConvertState, _g: BaseConvertGoal, c: BaseConvertConfig): boolean {
  return s.finished && s.result === expected(c)
}
