/** BaseDial: pure logic (stub — replaced by its lessons task). */
export type BaseDialConfig = unknown
export type BaseDialState = Record<string, never>
export type BaseDialGoal = unknown

export function initial(_c: BaseDialConfig): BaseDialState {
  return {}
}

export function isGoalMet(_s: BaseDialState, _g: BaseDialGoal, _c: BaseDialConfig): boolean {
  return true
}
