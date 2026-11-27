import type { FC } from 'react'
import type { Bit } from '../../../logic/boolean'

/** Props every widget component receives. */
export interface WidgetProps<C, S, G> {
  config: C
  goal?: G
  /**
   * Report the widget's current state on every change (and once for the initial state). Call it from an effect
   * or an event handler, never during render: it can complete the step, which updates the lesson player.
   */
  onState: (s: S) => void
  /**
   * The step is already complete (the player came back to it, or the lesson is done). A goal widget may then
   * show its final or example state instead of the starting one.
   */
  completed: boolean
  /** True when the user prefers reduced motion: show the final state, skip the animation. */
  reducedMotion: boolean
}

/**
 * A lesson widget: a component plus its pure logic. `initial` and `isGoalMet` live in `<name>Logic.ts`
 * so the validator (node, no DOM) can check that a step's `example` state meets its `goal`.
 */
export interface WidgetDef<C, S, G> {
  Component: FC<WidgetProps<C, S, G>>
  initial: (c: C) => S
  isGoalMet: (s: S, g: G, c: C) => boolean
}

/** Variable values by name, e.g. { A: 1, B: 0 }. */
export type Assignment = Record<string, Bit>

/**
 * A small Boolean expression (GateToy, IdentityBench): a function over the variables plus how it is written.
 * `display` is a formula such as "(A+B)'" (no Hebrew; it renders left to right).
 */
export interface BoolExpr { fn: (v: Assignment) => Bit; display: string }
