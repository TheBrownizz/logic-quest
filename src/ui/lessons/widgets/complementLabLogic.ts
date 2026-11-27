/** ComplementLab (spec 6.4.3): r−1 and r complements, and subtraction by complement. Logic stub: Task 2 implements it. */

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

export function initial(_c: ComplementLabConfig): ComplementLabState {
  return { phase: 'value' }
}

export function isGoalMet(_s: ComplementLabState, _g: ComplementLabGoal, _c: ComplementLabConfig): boolean {
  return true
}
