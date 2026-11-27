import type { FC } from 'react'

/** Props every widget component receives. */
export interface WidgetProps<C, S, G> {
  config: C
  goal?: G
  /** Call with the widget's current state on every change (and once for the initial state). */
  onState: (s: S) => void
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
