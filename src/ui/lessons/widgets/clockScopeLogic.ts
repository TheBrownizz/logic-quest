import type { Bit } from '../../../logic/boolean'
import { simulateWave, type WaveKind } from '../../../logic/waveform'

/**
 * ClockScope (spec 6.4): scrolling waveforms of a clock, the inputs and Q, showing level- vs edge-sensitivity.
 * The player moves a cursor along the columns and/or predicts Q column by column. Pure: no DOM.
 * Every config must pass validateWaveConfig(kind, clk, inputs, q0) (the lesson validator checks it, and
 * `compare` too).
 */
export interface ClockScopeConfig {
  kind: WaveKind
  /** One value per column; a clock phase may span several columns. */
  clk: Bit[]
  /** Inputs by name for the kind: D | S,R | T | J,K. */
  inputs: Record<string, Bit[]>
  /** Q before column 0. */
  q0: Bit
  /** Draw the true Q (false: the player predicts it). */
  showQ: boolean
  /** Also draw Q of another kind on the same inputs (e.g. latch-D vs ff-D). */
  compare?: WaveKind
}
export interface ClockScopeState {
  /** The column the cursor is on (0-based). */
  cursor: number
  /** The player's predicted Q per column (null = not yet). */
  guess: Array<Bit | null>
}
export type ClockScopeGoal =
  /** Predict Q in every column. */
  | { kind: 'predict' }
  /** Predict Q right in these columns (0-based). */
  | { kind: 'predict-at'; cols: number[] }
  /** Move the cursor to the last column (watch the whole trace). */
  | { kind: 'scan' }

export const qOf = (c: Pick<ClockScopeConfig, 'kind' | 'clk' | 'inputs' | 'q0'>, kind: WaveKind = c.kind): Bit[] => simulateWave(kind, c.clk, c.inputs, c.q0)

export function initial(c: ClockScopeConfig): ClockScopeState {
  return { cursor: 0, guess: c.clk.map(() => null) }
}

export const moveCursor = (s: ClockScopeState, c: ClockScopeConfig, to: number): ClockScopeState =>
  ({ ...s, cursor: Math.max(0, Math.min(c.clk.length - 1, to)) })

export const setGuess = (s: ClockScopeState, col: number, v: Bit | null): ClockScopeState =>
  ({ ...s, guess: s.guess.map((x, i) => (i === col ? v : x)) })

export function isGoalMet(s: ClockScopeState, g: ClockScopeGoal, c: ClockScopeConfig): boolean {
  switch (g.kind) {
    case 'scan': return s.cursor >= c.clk.length - 1
    case 'predict': { const q = qOf(c); return q.every((v, i) => s.guess[i] === v) }
    case 'predict-at': { const q = qOf(c); return g.cols.length > 0 && g.cols.every(i => s.guess[i] === q[i]) }
    default: return false
  }
}
