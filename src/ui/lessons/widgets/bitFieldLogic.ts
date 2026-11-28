/**
 * BitField (spec 6.4.4): IEEE-754 single precision, 32 clickable bits: sign (1) | exponent (8, bias 127) | mantissa (23).
 * Pure logic: the component in BitField.tsx only draws what these functions compute. Goals are normal numbers;
 * zero, infinity, NaN and subnormals are recognised (the widget labels them) but no goal asks for them.
 */

/** The three fields of the word, left to right. */
export type BitFieldPart = 'sign' | 'exponent' | 'mantissa'

export interface BitFieldConfig {
  /** Starting bits: 32 characters of 0/1, sign | exponent (8) | mantissa (23). Default: all zero. */
  bits?: string
  /** Fields the player cannot change (their bits are drawn but disabled), so a step can focus on one field. */
  locked?: BitFieldPart[]
}
export interface BitFieldState {
  /** 32 characters of 0/1. */
  bits: string
}
export interface BitFieldGoal {
  /** The value the bits must encode exactly (a normal single-precision number). */
  value: number
}

export const BIAS = 127
export const WORD = 32
export const EXP_BITS = 8
export const MAN_BITS = 23
/** Index (0 = leftmost bit) where each field starts, and its length. */
export const PARTS: Record<BitFieldPart, { start: number; length: number }> = {
  sign: { start: 0, length: 1 },
  exponent: { start: 1, length: EXP_BITS },
  mantissa: { start: 1 + EXP_BITS, length: MAN_BITS },
}

/** The field that bit `index` (0 = leftmost) belongs to. */
export const partOf = (index: number): BitFieldPart => (index === 0 ? 'sign' : index <= EXP_BITS ? 'exponent' : 'mantissa')

const isWord = (bits: string) => /^[01]{32}$/.test(bits)

/** The widget's starting bits; throws on a malformed `bits` so a typo in lesson content is caught by the validator. */
export function startBits(c: BitFieldConfig): string {
  const bits = c.bits ?? '0'.repeat(WORD)
  if (!isWord(bits)) throw new RangeError(`BitField: bits must be 32 characters of 0/1, got "${bits}"`)
  return bits
}

export function initial(c: BitFieldConfig): BitFieldState {
  return { bits: startBits(c) }
}

/** `bits` with bit `index` flipped. */
export function toggleBit(bits: string, index: number): string {
  if (!isWord(bits)) throw new RangeError('BitField: expected 32 bits')
  if (!Number.isInteger(index) || index < 0 || index >= WORD) throw new RangeError(`BitField: bit ${index} is not 0–31`)
  return bits.slice(0, index) + (bits[index] === '1' ? '0' : '1') + bits.slice(index + 1)
}

/** True when the player may flip bit `index` under this config. */
export const canToggle = (c: BitFieldConfig, index: number): boolean => !(c.locked ?? []).includes(partOf(index))

export type BitFieldKind = 'normal' | 'zero' | 'subnormal' | 'infinity' | 'nan'

export interface Decoded {
  sign: 0 | 1
  /** The stored exponent field E, 0–255. */
  exponent: number
  /** The 23 mantissa bits as written. */
  mantissaBits: string
  kind: BitFieldKind
  /** The real exponent e = E − 127 (meaningful for normal numbers). */
  e: number
  /** 1.M as a number: 1 + mantissa / 2^23 (the hidden 1 included). Exact in a double. */
  significand: number
  /** The value this word stands for, computed from the fields (not from the host's float parser). */
  value: number
}

/** Reads a word. Normal numbers are computed by the formula (−1)^S · 1.M · 2^(E−127). */
export function decode(bits: string): Decoded {
  if (!isWord(bits)) throw new RangeError('BitField: expected 32 bits')
  const sign = Number(bits[0]) as 0 | 1
  const exponent = parseInt(bits.slice(PARTS.exponent.start, PARTS.mantissa.start), 2)
  const mantissaBits = bits.slice(PARTS.mantissa.start)
  const m = parseInt(mantissaBits, 2)
  const s = sign ? -1 : 1
  const significand = 1 + m / 2 ** MAN_BITS
  const e = exponent - BIAS
  if (exponent === 255) return { sign, exponent, mantissaBits, kind: m === 0 ? 'infinity' : 'nan', e, significand, value: m === 0 ? s * Infinity : NaN }
  if (exponent === 0) {
    // zero and subnormals: no hidden 1, exponent fixed at −126
    const value = s * (m / 2 ** MAN_BITS) * 2 ** -126
    return { sign, exponent, mantissaBits, kind: m === 0 ? 'zero' : 'subnormal', e: -126, significand: m / 2 ** MAN_BITS, value }
  }
  return { sign, exponent, mantissaBits, kind: 'normal', e, significand, value: s * significand * 2 ** e }
}

/** The 32 bits that encode `value` exactly, or null when it is not a normal single-precision number. */
export function encodeValue(value: number): string | null {
  if (!Number.isFinite(value) || value === 0 || Math.fround(value) !== value) return null
  const dv = new DataView(new ArrayBuffer(4))
  dv.setFloat32(0, value)
  const bits = dv.getUint32(0).toString(2).padStart(WORD, '0')
  return decode(bits).kind === 'normal' ? bits : null
}

/** The goal is met when the bits are a normal number whose value is exactly `goal.value`. */
export function isGoalMet(s: BitFieldState, g: BitFieldGoal, _c: BitFieldConfig): boolean {
  if (!isWord(s.bits)) return false
  const d = decode(s.bits)
  return d.kind === 'normal' && encodeValue(g.value) !== null && d.value === g.value
}

/** The word as eight hex digits, e.g. "C0C80000". */
export const toHex = (bits: string): string => parseInt(bits, 2).toString(16).toUpperCase().padStart(8, '0')

/**
 * A number for display: the shortest decimal (up to 9 significant digits) that reads back as exactly `v`,
 * and `exact` false (show "≈") when no such short decimal exists.
 */
export function formatNumber(v: number): { text: string; exact: boolean } {
  if (Number.isNaN(v)) return { text: 'NaN', exact: true }
  if (!Number.isFinite(v)) return { text: v < 0 ? '−∞' : '∞', exact: true }
  if (v === 0) return { text: Object.is(v, -0) ? '−0' : '0', exact: true }
  const show = (n: number) => String(n).replace('-', '−')
  for (let p = 1; p <= 9; p++) {
    const r = Number(v.toPrecision(p))
    if (r === v) return { text: show(r), exact: true }
  }
  return { text: show(Number(v.toPrecision(9))), exact: false }
}

/** The mantissa with trailing zeros dropped ("1001" for 1001000…0), "" when all zero. */
export const trimMantissa = (mantissaBits: string): string => mantissaBits.replace(/0+$/, '')

/** The largest |e| for which the binary point strip is drawn (beyond it the strip would be pages wide). */
export const STRIP_MAX_E = 10

export interface PointStrip {
  /** The binary digits of 1.M·2^e laid out in one row (zeros padded as the point moves). */
  digits: string[]
  /** Where the point sits before it moves, and after: the number of digits to its left. */
  from: number
  to: number
  /** The index in `digits` of the hidden 1. */
  hidden: number
  /** The shifted number written out, e.g. "110.1". */
  shifted: string
}

/**
 * The binary-point animation's data: 1.M written as a row of digits, and how far the point travels (e places,
 * right when e > 0, left when e < 0). Null for non-normal words or when |e| is too large to draw.
 */
export function pointStrip(bits: string): PointStrip | null {
  const d = decode(bits)
  if (d.kind !== 'normal' || Math.abs(d.e) > STRIP_MAX_E) return null
  let digits = ['1', ...trimMantissa(d.mantissaBits)]
  let from = 1
  let hidden = 0
  let to = 1 + d.e
  if (to > digits.length) digits = [...digits, ...Array(to - digits.length).fill('0')]
  if (to < 0) {
    // the point moves past the left end: pad zeros so that it sits right after the first digit
    const pad = 1 - to
    digits = [...Array(pad).fill('0'), ...digits]
    from += pad; hidden += pad; to += pad
  } else if (to === 0) {
    digits = ['0', ...digits]
    from += 1; hidden += 1; to = 1
  }
  const shifted = digits.slice(0, to).join('') + (to < digits.length ? '.' + digits.slice(to).join('') : '')
  return { digits, from, to, hidden, shifted }
}
