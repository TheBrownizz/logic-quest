import { referenceChips } from '../chips'
import { lintText } from '../lint'
import type { World } from '../types'
import { validateRoom } from '../validate'
import { registry } from '../../ui/lessons/widgets/registry'
import { normalizeAnswer } from './answer'
import { allFigures } from './catalog'
import { WIDGET_NAMES, type Figures, type Lesson, type SkipQuestion, type Step, type WidgetName } from './types'

/** An explain step's text is "at most about 60 words"; above this it is an error. */
export const EXPLAIN_MAX_WORDS = 70
const RECAP_POINTS = [3, 5] as const
const OPTIONS = [2, 4] as const
export const MIN_SKIP_QUIZ = 6

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e))
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length
const blank = (s: unknown) => typeof s !== 'string' || s.trim() === ''

export interface ValidateLessonsOptions {
  /** Figures by id (default: every world's lesson figures). */
  figures?: Figures
  /** Widget logic by name (default: the real registry). Tests pass their own. */
  widgets?: Record<WidgetName, { initial: (c: never) => unknown; isGoalMet: (s: never, g: never, c: never) => boolean }>
}

/** Options of a check step or a skip question: 2–4, distinct, non-empty, `correct` an index into them. */
function checkOptions(options: string[], correct: number, err: (m: string) => void): void {
  if (options.length < OPTIONS[0] || options.length > OPTIONS[1]) err(`${options.length} options (need 2–4)`)
  if (new Set(options.map(o => o.trim())).size !== options.length) err('options are not distinct')
  if (options.some(blank)) err('empty option')
  if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) err('correct out of range')
}

function validateStep(lesson: Lesson, step: Step, world: World, opts: Required<ValidateLessonsOptions>, err: (m: string) => void, errs: string[]): void {
  switch (step.kind) {
    case 'explain': {
      if (blank(step.text)) err('explain text is empty')
      const n = words(step.text)
      if (n > EXPLAIN_MAX_WORDS) err(`explain has ${n} words (max about 60)`)
      if (step.figure !== undefined) {
        const f = opts.figures[step.figure]
        if (f === undefined) err(`figure "${step.figure}" not found`)
        else if (!/^\s*<svg[\s>]/.test(f)) err(`figure "${step.figure}" is not SVG markup`)
      }
      break
    }
    case 'widget': {
      if (blank(step.prompt)) err('prompt is empty')
      if (!WIDGET_NAMES.includes(step.widget)) { err(`unknown widget "${step.widget}"`); break }
      // user-visible sentences belong in `prompt`; config holds short labels only
      for (const [path, str] of configStrings(step.config)) {
        if (/[֐-׿]/.test(str)) err(`${path} has Hebrew text; put sentences in the prompt (config holds short labels only)`)
        else if (str.length > CONFIG_LABEL_MAX) err(`${path} is ${str.length} characters (config labels are at most ${CONFIG_LABEL_MAX})`)
      }
      const def = opts.widgets[step.widget]
      let init: unknown
      try { init = def.initial(step.config as never) } catch (e) { err(`initial(config) threw: ${msg(e)}`); break }
      if (step.goal === undefined) break
      if (step.example === undefined) { err('goal without an example (a state that meets it)'); break }
      try {
        if (!def.isGoalMet(step.example as never, step.goal as never, step.config as never)) err('example does not meet the goal')
        // a goal the starting state already meets asks nothing of the player (usually a typo)
        else if (def.isGoalMet(init as never, step.goal as never, step.config as never)) err('goal is already met by the initial state')
      } catch (e) { err(`isGoalMet threw: ${msg(e)}`) }
      break
    }
    case 'check': {
      if (blank(step.prompt)) err('prompt is empty')
      checkOptions(step.options, step.correct, err)
      if (step.feedback.length !== step.options.length) err(`feedback has ${step.feedback.length} entries for ${step.options.length} options`)
      if (step.feedback.some(blank)) err('empty feedback')
      break
    }
    case 'check-number': {
      if (blank(step.prompt)) err('prompt is empty')
      if (blank(step.answer)) err('answer is empty')
      if (blank(step.feedbackWrong)) err('feedbackWrong is empty')
      let got: string
      try { got = step.compute() } catch (e) { err(`compute() threw: ${msg(e)}`); break }
      if (normalizeAnswer(got) !== normalizeAnswer(step.answer)) err(`compute() gives "${got}" but answer is "${step.answer}"`)
      break
    }
    case 'try': {
      if (blank(step.prompt)) err('prompt is empty')
      const p = step.puzzle
      if (p.type === 'circuit') {
        // An embedded lab has no chips: its palette is exactly `allowed`, and it never stores a chip.
        if (p.unlocksChip) err('try steps cannot unlock chips')
        if (p.reference.nodes.some(n => typeof n.kind === 'object')) err('try circuits cannot use chips')
      }
      validateRoom({ id: `${lesson.id}/${step.id}`, title: lesson.title, intro: step.prompt, puzzle: p, hints: step.hints }, referenceChips(world), errs)
      break
    }
    case 'recap': {
      const n = step.points.length
      if (n < RECAP_POINTS[0] || n > RECAP_POINTS[1]) err(`recap has ${n} points (need 3–5)`)
      if (step.points.some(blank)) err('empty recap point')
      break
    }
    default:
      err(`unknown step kind "${(step as { kind: string }).kind}"`)
  }
}

/** Longest string a widget config may hold: config carries short labels (variable names, formulas) only. */
export const CONFIG_LABEL_MAX = 40

/** Every string inside a widget config (objects and arrays, recursively), with its path ("config.left.display"). */
export function configStrings(v: unknown, path = 'config', seen = new Set<unknown>()): Array<[string, string]> {
  if (typeof v === 'string') return [[path, v]]
  if (typeof v !== 'object' || v === null || seen.has(v)) return []
  seen.add(v)
  if (Array.isArray(v)) return v.flatMap((x, i) => configStrings(x, `${path}[${i}]`, seen))
  return Object.entries(v).flatMap(([k, x]) => configStrings(x, `${path}.${k}`, seen))
}

/** Every user-visible string of a step, labelled for error messages. */
function stepTexts(step: Step): Array<[string, string]> {
  switch (step.kind) {
    case 'explain': return [['text', step.text]]
    case 'widget': return [['prompt', step.prompt], ...configStrings(step.config)]
    case 'check': return [['prompt', step.prompt], ...step.options.map((o, i): [string, string] => [`option ${i + 1}`, o]), ...step.feedback.map((f, i): [string, string] => [`feedback ${i + 1}`, f])]
    case 'check-number': return [['prompt', step.prompt], ['feedbackWrong', step.feedbackWrong]]
    case 'try': {
      const p = step.puzzle as { prompt?: string; definition?: string }
      return [['prompt', step.prompt], ...step.hints.map((h, i): [string, string] => [`hint ${i + 1}`, h.text]),
        ...(p.prompt ? [['puzzle prompt', p.prompt] as [string, string]] : []),
        ...(p.definition ?? '').split('\n').filter(Boolean).map((l, i): [string, string] => [`definition line ${i + 1}`, l])]
    }
    case 'recap': return step.points.map((p, i): [string, string] => [`point ${i + 1}`, p])
    default: return []
  }
}

const quizTexts = (q: SkipQuestion): Array<[string, string]> =>
  [['prompt', q.prompt], ...q.options.map((o, i): [string, string] => [`option ${i + 1}`, o])]

function lint(where: string, texts: Array<[string, string]>, errs: string[]): void {
  for (const [label, t] of texts) for (const m of lintText(t)) errs.push(`${where}: ${label}: ${m}`)
}

/**
 * Checks lessons against `world`. Returns readable problems ("<lesson>[/<step>]: ..."), [] when all is well.
 * See README ("שיעורים") for the rules.
 */
export function validateLessons(world: World, lessons: Lesson[], options: ValidateLessonsOptions = {}): string[] {
  const opts: Required<ValidateLessonsOptions> = { figures: options.figures ?? allFigures, widgets: options.widgets ?? registry }
  const errs: string[] = []
  const lessonIds = new Set<string>()
  for (const l of lessons) {
    const err = (m: string) => errs.push(`${l.id}: ${m}`)
    if (lessonIds.has(l.id)) err('duplicate lesson id')
    lessonIds.add(l.id)
    if (!world.stages.some(s => s.id === l.stage)) err(`stage "${l.stage}" does not exist`)
    if (blank(l.title)) err('title is empty')
    if (blank(l.blurb)) err('blurb is empty')
    if (blank(l.source)) err('source is empty')
    if (!(Number.isFinite(l.minutes) && l.minutes > 0)) err('minutes must be a positive number')
    if (!Number.isFinite(l.order)) err('order must be a number')
    lint(l.id, [['title', l.title], ['blurb', l.blurb]], errs)

    if (l.steps.length === 0) err('no steps')
    const stepIds = new Set<string>()
    let explainRun = 0
    l.steps.forEach((step, i) => {
      if (blank(step.id)) err(`step ${i + 1} has no id`)
      if (stepIds.has(step.id)) err(`duplicate step id "${step.id}"`)
      stepIds.add(step.id)
      explainRun = step.kind === 'explain' ? explainRun + 1 : 0
      if (explainRun === 3) err(`3 explain steps in a row (at "${step.id}"; max 2)`)
      if (step.kind === 'recap' && i !== l.steps.length - 1) err(`only the last step may be a recap ("${step.id}")`)
      const where = `${l.id}/${step.id}`
      validateStep(l, step, world, opts, m => errs.push(`${where}: ${m}`), errs)
      lint(where, stepTexts(step), errs)
    })
    if (l.steps.length > 0 && l.steps[l.steps.length - 1].kind !== 'recap') err('the last step must be a recap (the finish screen)')

    if (l.skipQuiz.length < MIN_SKIP_QUIZ) err(`skipQuiz has ${l.skipQuiz.length} questions (need at least ${MIN_SKIP_QUIZ})`)
    const qIds = new Set<string>()
    for (const q of l.skipQuiz) {
      const where = `${l.id}/quiz/${q.id}`
      if (qIds.has(q.id)) err(`duplicate skip question id "${q.id}"`)
      qIds.add(q.id)
      if (blank(q.prompt)) errs.push(`${where}: prompt is empty`)
      checkOptions(q.options, q.correct, m => errs.push(`${where}: ${m}`))
      lint(where, quizTexts(q), errs)
    }
  }
  return errs
}
