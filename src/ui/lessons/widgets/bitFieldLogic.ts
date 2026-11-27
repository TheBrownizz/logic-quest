/** BitField (spec 6.4.4): IEEE-754 single precision, 32 clickable bits. Logic stub: Task 3 implements it. */

export interface BitFieldConfig {
  /** Starting bits: 32 characters of 0/1, sign | exponent (8) | mantissa (23). Default: all zero. */
  bits?: string
}
export interface BitFieldState {
  /** 32 characters of 0/1. */
  bits: string
}
export interface BitFieldGoal {
  /** The value the bits must encode exactly (a normal single-precision number). */
  value: number
}

export function initial(c: BitFieldConfig): BitFieldState {
  return { bits: c.bits ?? '0'.repeat(32) }
}

export function isGoalMet(_s: BitFieldState, _g: BitFieldGoal, _c: BitFieldConfig): boolean {
  return true
}
