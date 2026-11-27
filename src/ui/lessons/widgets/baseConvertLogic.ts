/** BaseConvert (spec 6.4.2): base conversion step by step. Logic stub: Task 2 implements it. */

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

export function initial(_c: BaseConvertConfig): BaseConvertState {
  return { step: 0, result: '', finished: false }
}

export function isGoalMet(_s: BaseConvertState, _g: BaseConvertGoal, _c: BaseConvertConfig): boolean {
  return true
}
