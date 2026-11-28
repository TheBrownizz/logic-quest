import type { Step } from '../../../content/lessons/types'
import type { World } from '../../../content/types'

/** Props of every step view. `completed` survives going back and forward; `onComplete` is idempotent. */
export interface StepProps<K extends Step['kind']> {
  step: Extract<Step, { kind: K }>
  completed: boolean
  onComplete: () => void
  reducedMotion: boolean
  /** `?autofill=1` (tests, demos): widget goals and `try` puzzles count as done on arrival. */
  autofill: boolean
  world: World
}
