import type { Hint, LabPuzzle } from '../types'

/** The interactive widgets a `widget` step can show (see src/ui/lessons/widgets/registry.ts). */
export type WidgetName =
  | 'BaseDial' | 'BaseConvert' | 'ComplementLab' | 'BitField' | 'GateToy'
  | 'IdentityBench' | 'TruthToMap' | 'RippleTimeline' | 'MuxToy'
  | 'LatchToy' | 'ClockScope' | 'StateWalker'

export const WIDGET_NAMES: readonly WidgetName[] = [
  'BaseDial', 'BaseConvert', 'ComplementLab', 'BitField', 'GateToy',
  'IdentityBench', 'TruthToMap', 'RippleTimeline', 'MuxToy',
  'LatchToy', 'ClockScope', 'StateWalker',
]

/**
 * One screen of a lesson. A step is "complete" (and "המשך" opens) when:
 * explain / recap: at once; widget: when the widget's state meets `goal` (at once when there is no goal);
 * check: the correct option is chosen; check-number: the answer is typed; try: the puzzle is solved.
 */
export type Step =
  | { id: string; kind: 'explain'; text: string; figure?: string /* id in the stage file's `figures` map (inline SVG markup) */ }
  | { id: string; kind: 'widget'; prompt: string; widget: WidgetName; config: unknown; goal?: unknown; example?: unknown /* a state that meets goal; required when goal is set */ }
  | { id: string; kind: 'check'; prompt: string; options: string[]; correct: number; feedback: string[] /* same length; feedback[correct] = praise/explanation */ }
  | { id: string; kind: 'check-number'; prompt: string; answer: string; compute: () => string; feedbackWrong: string }
  | { id: string; kind: 'try'; prompt: string; puzzle: LabPuzzle; hints: Hint[] }
  | { id: string; kind: 'recap'; points: string[] }

export type StepKind = Step['kind']

/** A skip-quiz question (check format, no feedback: the quiz stops at the first wrong answer). */
export interface SkipQuestion { id: string; prompt: string; options: string[]; correct: number }

export interface Lesson {
  id: string
  stage: string
  order: number
  title: string
  /** Estimated minutes. */
  minutes: number
  /** One line for the lesson card. */
  blurb: string
  /** Ends with exactly one `recap` step, which is the lesson's finish screen. */
  steps: Step[]
  /** At least 6 questions; the quiz draws 4. */
  skipQuiz: SkipQuestion[]
  /** "סילבוס: <topic>" */
  source: string
}

/** Inline SVG markup by id, for `explain` steps' `figure`. Each stage lessons file exports its own map. */
export type Figures = Record<string, string>
