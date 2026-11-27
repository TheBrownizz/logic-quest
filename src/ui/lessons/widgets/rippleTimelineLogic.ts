/** RippleTimeline (spec 6.4.8): a ripple-carry adder with a draggable timeline. Logic stub: Task 6 implements it. */

export interface RippleTimelineConfig {
  /** Operand A, most significant first (e.g. '0111'); 2–8 bits. */
  a: string
  /** Operand B, same length as `a`. */
  b: string
  /** Delays in ns: one full adder, and the XOR on each B input (used when `m` is set). */
  delays: { fa: number; xor?: number }
  /** Adder/subtractor control: B passes through XOR with M, and M is the carry in. Absent: a plain adder, carry in 0. */
  m?: 0 | 1
}
export interface RippleTimelineState {
  /** The time on the timeline, in ns. */
  t: number
}
export type RippleTimelineGoal =
  /** Drag until every output has settled (t ≥ the worst-case delay). */
  | { kind: 'settled' }
  /** Drag to at least `t` ns. */
  | { kind: 'time'; t: number }

export function initial(_c: RippleTimelineConfig): RippleTimelineState {
  return { t: 0 }
}

export function isGoalMet(_s: RippleTimelineState, _g: RippleTimelineGoal, _c: RippleTimelineConfig): boolean {
  return true
}
