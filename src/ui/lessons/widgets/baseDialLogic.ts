/**
 * BaseDial (spec 6.4.1): a number in base r with digits the player steps up and down. The digits are independent
 * (like a combination lock): the place weights r^i turn them into a value. Any base 2–16, any width 1–12, and an
 * unsigned or signed (r's complement) reading.
 */

export interface BaseDialConfig {
  /** 2–16. */
  base: number
  /** Number of digit places, 1–12. */
  width: number
  /** Starting digits, most significant first, exactly `width` characters (0-9, A-F). Default: all zero. */
  digits?: string
  /** Show the value as signed (r's complement, e.g. two's complement in base 2) instead of unsigned. */
  signed?: boolean
}
export interface BaseDialState {
  /** Digit values, most significant first; each 0 … base−1; length `width`. */
  digits: number[]
}
export interface BaseDialGoal {
  /** The decimal value to reach (signed when config.signed). */
  value: number
}

const digitValue = (ch: string) => parseInt(ch, 36)

/** The character of a digit value: 0-9, then A-F. */
export const digitChar = (d: number): string => d.toString(16).toUpperCase()

/** Throws on a config the dial cannot show (bad base, width or starting digits). Lesson tests run it on every BaseDial step. */
export function checkConfig(c: BaseDialConfig): void {
  if (!Number.isInteger(c.base) || c.base < 2 || c.base > 16) throw new RangeError(`BaseDial: base ${c.base} is not 2–16`)
  if (!Number.isInteger(c.width) || c.width < 1 || c.width > 12) throw new RangeError(`BaseDial: width ${c.width} is not 1–12`)
  if (c.digits !== undefined) {
    if (c.digits.length !== c.width) throw new RangeError(`BaseDial: digits "${c.digits}" must have ${c.width} characters`)
    for (const ch of c.digits) {
      const d = digitValue(ch)
      if (!(d >= 0 && d < c.base)) throw new RangeError(`BaseDial: digit "${ch}" is not valid in base ${c.base}`)
    }
  }
}

/** The place weights, most significant first: r^(width−1) … r^1, r^0. */
export function placeWeights(c: BaseDialConfig): number[] {
  return Array.from({ length: c.width }, (_, i) => c.base ** (c.width - 1 - i))
}

/** The unsigned value of the digits. */
export function unsignedValue(digits: number[], base: number): number {
  let v = 0
  for (const d of digits) v = v * base + d
  return v
}

/** The smallest unsigned value that reads as negative when signed: ⌈r^width / 2⌉. */
export function signedThreshold(c: BaseDialConfig): number {
  return Math.ceil(c.base ** c.width / 2)
}

/** True when the digits read as a negative number (signed reading only). */
export function isNegative(digits: number[], c: BaseDialConfig): boolean {
  return !!c.signed && unsignedValue(digits, c.base) >= signedThreshold(c)
}

/** The value the digits stand for: unsigned, or signed in r's complement (value − r^width when it is past the top half). */
export function valueOf(digits: number[], c: BaseDialConfig): number {
  const u = unsignedValue(digits, c.base)
  return isNegative(digits, c) ? u - c.base ** c.width : u
}

/** The smallest and largest value the dial can show. */
export function valueRange(c: BaseDialConfig): { min: number; max: number } {
  const n = c.base ** c.width
  // signed: values u ≥ ⌈n/2⌉ read as u − n, so the smallest is ⌈n/2⌉ − n and the largest ⌈n/2⌉ − 1
  return c.signed ? { min: Math.ceil(n / 2) - n, max: Math.ceil(n / 2) - 1 } : { min: 0, max: n - 1 }
}

/** The digits that show `value`, or null when the dial cannot reach it. */
export function digitsForValue(value: number, c: BaseDialConfig): number[] | null {
  if (!Number.isInteger(value)) return null
  const { min, max } = valueRange(c)
  if (value < min || value > max) return null
  let u = value < 0 ? value + c.base ** c.width : value
  const out: number[] = []
  for (let i = 0; i < c.width; i++) { out.unshift(u % c.base); u = Math.floor(u / c.base) }
  return out
}

/** The digits after stepping digit `i` by `dir` (+1 / −1), wrapping around like an odometer wheel. */
export function stepDigit(digits: number[], i: number, dir: 1 | -1, base: number): number[] {
  return digits.map((d, j) => (j === i ? (d + dir + base) % base : d))
}

/** The dial shown for a missing config (no base, width or digits at all): base 2, four places. */
export const DEFAULT_CONFIG: BaseDialConfig = { base: 2, width: 4 }

export function initial(c: BaseDialConfig): BaseDialState {
  const missing = c.base === undefined && c.width === undefined && c.digits === undefined
  const cfg = missing ? DEFAULT_CONFIG : c
  // a bad base, width or starting digit throws, so validateLessons reports a content typo
  checkConfig(cfg)
  return { digits: cfg.digits ? [...cfg.digits].map(digitValue) : Array.from({ length: cfg.width }, () => 0) }
}

export function isGoalMet(s: BaseDialState, g: BaseDialGoal, c: BaseDialConfig): boolean {
  if (s.digits.length !== c.width) return false
  return valueOf(s.digits, c) === g.value
}
