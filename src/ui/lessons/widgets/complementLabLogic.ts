/**
 * ComplementLab (spec 6.4.3): r−1 and r complements, and subtraction by complement. Works in any base 2–16 and any
 * width 1–12. The complement is always taken over the fixed width: the (r−1) complement of N is (r^w − 1) − N,
 * and the r complement is r^w − N.
 */

export interface ComplementLabConfig {
  /** 2–16. */
  base: number
  /** Number of digit places (the complement is taken over this width), 1–12. */
  digits: number
  /** The number, most significant first, `digits` characters (0-9, A-F). In 'subtract' mode the minuend. */
  value: string
  /** 'complement': value → r−1 complement → r complement. 'subtract': value − other by adding other's complement. */
  mode: 'complement' | 'subtract'
  /** The subtrahend in 'subtract' mode, `digits` characters. */
  other?: string
}
/**
 * The phases a run goes through, in order. 'complement' mode: value, r1 (each digit r−1−d), r (r1 + 1 with the
 * rippling carry). 'subtract' mode adds sum (value + r complement of other) and result (end carry dropped, or
 * no end carry: the result is negative, shown as the complement of the sum).
 */
export type ComplementPhase = 'value' | 'r1' | 'r' | 'sum' | 'result'
export const COMPLEMENT_PHASES: readonly ComplementPhase[] = ['value', 'r1', 'r', 'sum', 'result']
export interface ComplementLabState {
  /** The furthest phase shown. */
  phase: ComplementPhase
}
export interface ComplementLabGoal {
  /** Reach at least this phase. */
  phase: ComplementPhase
}

/** The phases a configuration goes through: the first three in 'complement' mode, all five in 'subtract' mode. */
export const phasesFor = (c: ComplementLabConfig): readonly ComplementPhase[] =>
  c.mode === 'complement' ? COMPLEMENT_PHASES.slice(0, 3) : COMPLEMENT_PHASES

const parse = (s: string, base: number, width: number, what: string): number[] => {
  if (s.length !== width) throw new RangeError(`ComplementLab: ${what} "${s}" must have ${width} digits`)
  return [...s].map(ch => {
    const d = parseInt(ch, 36)
    if (!(d >= 0 && d < base)) throw new RangeError(`ComplementLab: digit "${ch}" of ${what} is not valid in base ${base}`)
    return d
  })
}

/** Digits → value (unsigned). */
export const valueOfDigits = (digits: number[], base: number): number => digits.reduce((v, d) => v * base + d, 0)

/** The (r−1) complement: every digit d becomes r−1−d. */
export const complementR1 = (digits: number[], base: number): number[] => digits.map(d => base - 1 - d)

export interface AddResult {
  /** Sum digits, same width as the operands (the end carry is not included). */
  digits: number[]
  /** carries[i] is the carry produced BY position i (most significant first), i.e. carried into position i−1. */
  carries: boolean[]
  /** A carry came out of the most significant position. */
  endCarry: boolean
}

/** Adds two digit rows of the same width, right to left. */
export function addDigits(a: number[], b: number[], base: number): AddResult {
  const n = a.length
  const digits = new Array<number>(n).fill(0)
  const carries = new Array<boolean>(n).fill(false)
  let carry = 0
  for (let i = n - 1; i >= 0; i--) {
    const t = a[i] + b[i] + carry
    digits[i] = t % base
    carry = t >= base ? 1 : 0
    carries[i] = carry === 1
  }
  return { digits, carries, endCarry: carry === 1 }
}

/** r1 + 1 with the rippling carry: the r complement. `overflow` is true when the carry runs off the top (the number was 0). */
export function addOne(r1: number[], base: number): AddResult {
  return addDigits(r1, r1.map((_, i) => (i === r1.length - 1 ? 1 : 0)), base)
}

export interface ComplementModel {
  base: number
  width: number
  value: number[]
  /** The subtrahend ('subtract' mode). */
  other?: number[]
  /** The row that gets complemented: `value` in 'complement' mode, `other` in 'subtract' mode. */
  target: number[]
  r1: number[]
  /** The r complement of `target`, and the carries that rippled while adding 1. */
  r: AddResult
  /** 'subtract' mode only. */
  sum?: AddResult
  /** An end carry came out of value + r complement of other (true as well when the subtrahend is 0, whose r complement is r^w). */
  endCarry?: boolean
  /** The result: its digits, and whether it is negative (no end carry: the digits are the r complement of the sum, the magnitude). */
  result?: { negative: boolean; digits: number[]; magnitude: number; value: number }
}

/** Everything the lab shows, computed once from the config. */
export function modelOf(c: ComplementLabConfig): ComplementModel {
  if (!Number.isInteger(c.base) || c.base < 2 || c.base > 16) throw new RangeError(`ComplementLab: base ${c.base} is not 2–16`)
  if (!Number.isInteger(c.digits) || c.digits < 1 || c.digits > 12) throw new RangeError(`ComplementLab: digits ${c.digits} is not 1–12`)
  const { base, digits: width } = c
  const value = parse(c.value, base, width, 'value')
  const other = c.mode === 'subtract' ? parse(c.other ?? '', base, width, 'other') : undefined
  const target = other ?? value
  const r1 = complementR1(target, base)
  const r = addOne(r1, base)
  const m: ComplementModel = { base, width, value, other, target, r1, r }
  if (other) {
    const sum = addDigits(value, r.digits, base)
    m.sum = sum
    m.endCarry = sum.endCarry || r.endCarry
    if (m.endCarry) {
      const v = valueOfDigits(sum.digits, base)
      m.result = { negative: false, digits: sum.digits, magnitude: v, value: v }
    } else {
      const mag = addOne(complementR1(sum.digits, base), base).digits
      const v = valueOfDigits(mag, base)
      m.result = { negative: true, digits: mag, magnitude: v, value: -v }
    }
  }
  return m
}

export function initial(c: ComplementLabConfig): ComplementLabState {
  modelOf(c)
  return { phase: 'value' }
}

export const phaseIndex = (p: ComplementPhase): number => COMPLEMENT_PHASES.indexOf(p)

/** The phase after `p` for this config, or null at the last one. */
export function nextPhase(c: ComplementLabConfig, p: ComplementPhase): ComplementPhase | null {
  const ps = phasesFor(c)
  return ps[ps.indexOf(p) + 1] ?? null
}
export function prevPhase(c: ComplementLabConfig, p: ComplementPhase): ComplementPhase | null {
  const ps = phasesFor(c)
  return ps[ps.indexOf(p) - 1] ?? null
}

export function isGoalMet(s: ComplementLabState, g: ComplementLabGoal, c: ComplementLabConfig): boolean {
  if (!phasesFor(c).includes(g.phase)) return false
  return phaseIndex(s.phase) >= phaseIndex(g.phase)
}
