/** BaseDial (spec 6.4.1): a number in base r with digits the player steps up and down. Logic stub: Task 2 implements it. */

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

export function initial(c: BaseDialConfig): BaseDialState {
  return { digits: c.digits ? [...c.digits].map(digitValue) : Array.from({ length: c.width }, () => 0) }
}

export function isGoalMet(_s: BaseDialState, _g: BaseDialGoal, _c: BaseDialConfig): boolean {
  return true
}
