/** GateToy: pure logic (stub — replaced by its lessons task). */
export type GateToyConfig = unknown
export type GateToyState = Record<string, never>
export type GateToyGoal = unknown

export function initial(_c: GateToyConfig): GateToyState {
  return {}
}

export function isGoalMet(_s: GateToyState, _g: GateToyGoal, _c: GateToyConfig): boolean {
  return true
}
