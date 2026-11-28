import { describe, it, expect } from 'vitest'
import { validateLessons } from '../../src/content/lessons/validate'
import type { Lesson, Step } from '../../src/content/lessons/types'
import type { World } from '../../src/content/types'
import { registry } from '../../src/ui/lessons/widgets/registry'
import { ltr } from '../../src/content/switching/helpers'
import { node, wire } from '../../src/content/switching/helpers'
import { matchesAnswer, normalizeAnswer } from '../../src/content/lessons/answer'

const world: World = { id: 'w', title: 'w', icon: '', stages: [{ id: 's1', order: 1, title: '', rooms: [], cards: [] }] }

const q = (id: string) => ({ id, prompt: `שאלה ${id}`, options: ['כן', 'לא'], correct: 0 })
const base = (over: Partial<Lesson> = {}): Lesson => ({
  id: 'l1', stage: 's1', order: 1, title: 'שיעור', minutes: 5, blurb: 'שורה', source: 'סילבוס: נושא',
  steps: [
    { id: 'e1', kind: 'explain', text: 'הסבר קצר' },
    { id: 'c1', kind: 'check', prompt: 'מה?', options: ['א', 'ב', 'ג'], correct: 1, feedback: ['לא כי', 'כן כי', 'לא כי ג'] },
    { id: 'n1', kind: 'check-number', prompt: 'כמה?', answer: '45', compute: () => String(40 + 5), feedbackWrong: 'חשבו שוב' },
    { id: 'r', kind: 'recap', points: ['אחת', 'שתיים', 'שלוש'] },
  ],
  skipQuiz: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'].map(q),
  ...over,
})
const withSteps = (steps: Step[]) => base({ steps })
const errs = (l: Lesson | Lesson[], opts?: Parameters<typeof validateLessons>[2]) => validateLessons(world, Array.isArray(l) ? l : [l], opts)
const has = (l: Lesson | Lesson[], re: RegExp, opts?: Parameters<typeof validateLessons>[2]) => {
  const e = errs(l, opts)
  expect(e.some(m => re.test(m)), `expected ${re} in ${JSON.stringify(e)}`).toBe(true)
}
const recap: Step = { id: 'r', kind: 'recap', points: ['אחת', 'שתיים', 'שלוש'] }

describe('validateLessons', () => {
  it('accepts a good lesson', () => {
    expect(errs(base())).toEqual([])
  })

  it('unique ids: lessons, steps within a lesson, skip questions within a lesson', () => {
    has([base(), base()], /l1: duplicate lesson id/)
    has(withSteps([{ id: 'e1', kind: 'explain', text: 'א' }, { id: 'e1', kind: 'explain', text: 'ב' }, recap]), /duplicate step id "e1"/)
    has(base({ skipQuiz: ['q1', 'q1', 'q3', 'q4', 'q5', 'q6'].map(q) }), /duplicate skip question id "q1"/)
  })

  it('the stage exists', () => {
    has(base({ stage: 'nope' }), /stage "nope" does not exist/)
  })

  it('basic fields: title, blurb, minutes, source', () => {
    has(base({ source: ' ' }), /source is empty/)
    has(base({ title: '' }), /title is empty/)
    has(base({ blurb: '' }), /blurb is empty/)
    has(base({ minutes: 0 }), /minutes/)
  })

  it('steps: non-empty, at most 2 explain in a row, ending in exactly one recap', () => {
    has(withSteps([]), /no steps/)
    const e = (id: string): Step => ({ id, kind: 'explain', text: 'א' })
    expect(errs(withSteps([e('a'), e('b'), recap]))).toEqual([])
    has(withSteps([e('a'), e('b'), e('c'), recap]), /3 explain steps in a row/)
    has(withSteps([e('a')]), /last step must be a recap/)
    has(withSteps([recap, e('a'), { ...recap, id: 'r2' }]), /only the last step may be a recap/)
    has(withSteps([e('a'), { id: 'r', kind: 'recap', points: ['א'] }]), /recap has 1 points/)
  })

  it('explain text is at most about 60 words', () => {
    has(withSteps([{ id: 'a', kind: 'explain', text: Array(80).fill('מילה').join(' ') }, recap]), /explain has 80 words/)
  })

  it('a figure id must exist in the figures map and be SVG markup', () => {
    const l = withSteps([{ id: 'a', kind: 'explain', text: 'א', figure: 'f1' }, recap])
    has(l, /figure "f1" not found/, { figures: {} })
    expect(errs(l, { figures: { f1: '<svg viewBox="0 0 10 10"></svg>' } })).toEqual([])
    has(l, /figure "f1" is not SVG markup/, { figures: { f1: '<div></div>' } })
  })

  it('check: feedback per option, correct in range, distinct options, 2–4 options', () => {
    const c = (over: object): Step => ({ id: 'c', kind: 'check', prompt: 'מה?', options: ['א', 'ב'], correct: 0, feedback: ['כן', 'לא'], ...over }) as Step
    has(withSteps([c({ feedback: ['כן'] }), recap]), /feedback has 1 entries for 2 options/)
    has(withSteps([c({ correct: 2 }), recap]), /correct out of range/)
    has(withSteps([c({ correct: -1 }), recap]), /correct out of range/)
    has(withSteps([c({ correct: 0.5 }), recap]), /correct out of range/)
    has(withSteps([c({ options: ['א', 'א'] }), recap]), /options are not distinct/)
    has(withSteps([c({ options: ['א'], feedback: ['x'] }), recap]), /1 options \(need 2–4\)/)
    has(withSteps([c({ options: ['א', 'ב', 'ג', 'ד', 'ה'], feedback: ['1', '2', '3', '4', '5'] }), recap]), /5 options \(need 2–4\)/)
    has(withSteps([c({ feedback: ['כן', ' '] }), recap]), /empty feedback/)
  })

  it('check-number: compute() equals answer after normalising', () => {
    const n = (answer: string, compute: () => string): Step => ({ id: 'n', kind: 'check-number', prompt: 'כמה?', answer, compute, feedbackWrong: 'לא' })
    expect(errs(withSteps([n('1011 0101', () => '10110101'), recap]))).toEqual([])
    expect(errs(withSteps([n('5ba', () => '5BA'), recap]))).toEqual([])
    has(withSteps([n('46', () => '45'), recap]), /compute\(\) gives "45" but answer is "46"/)
    has(withSteps([n('46', () => { throw new Error('boom') }), recap]), /compute\(\) threw: boom/)
  })

  it('try: the puzzle passes the same validation as a room', () => {
    const t = (puzzle: Extract<Step, { kind: 'try' }>['puzzle']): Step => ({ id: 't', kind: 'try', prompt: 'נסו', puzzle, hints: [] })
    expect(errs(withSteps([t({ type: 'number', prompt: 'כמה?', answer: '5', check: 'numeric', compute: () => '5' }), recap]))).toEqual([])
    has(withSteps([t({ type: 'number', prompt: 'כמה?', answer: '5', check: 'numeric', compute: () => '6' }), recap]), /l1\/t: compute\(\) gives "6"/)
    has(withSteps([t({ type: 'kmap', nVars: 2, minterms: [9], dontCares: [] }), recap]), /l1\/t: k-map cells out of range/)
    // a NOT gate from NAND: good reference, then one that doesn't match its spec
    const spec = { inputs: ['A'], outputs: ['Y'], rows: [[1], [0]] as (0 | 1)[][] }
    const ref = { nodes: [node('A', 'IN', 'A'), node('g', 'NAND'), node('Y', 'OUT', 'Y')], wires: [wire('A', 'g', 0), wire('A', 'g', 1), wire('g', 'Y')] }
    expect(errs(withSteps([t({ type: 'circuit', spec, allowed: ['NAND'], optimalGates: 1, reference: ref }), recap]))).toEqual([])
    has(withSteps([t({ type: 'circuit', spec: { ...spec, rows: [[0], [1]] }, allowed: ['NAND'], optimalGates: 1, reference: ref }), recap]), /reference does not match spec/)
    has(withSteps([t({ type: 'circuit', spec, allowed: ['NAND'], optimalGates: 1, reference: ref, unlocksChip: { name: 'X', inputs: ['A'], outputs: ['Y'] } }), recap]), /try steps cannot unlock chips/)
    const chipRef = { nodes: [node('A', 'IN', 'A'), node('g', { chip: 'HA' }), node('Y', 'OUT', 'Y')], wires: [] }
    has(withSteps([t({ type: 'circuit', spec, allowed: ['NAND'], optimalGates: 1, reference: chipRef }), recap]), /try circuits cannot use chips/)
  })

  it('widget: known name; a goal needs an example that meets it; config must load', () => {
    const w = (over: object): Step => ({ id: 'w', kind: 'widget', prompt: 'הזיזו', widget: 'BaseDial', config: { base: 2, width: 4 }, ...over }) as Step
    expect(errs(withSteps([w({}), recap]))).toEqual([])
    has(withSteps([w({ widget: 'Nope' }), recap]), /unknown widget "Nope"/)
    has(withSteps([w({ goal: { value: 45 } }), recap]), /goal without an example/)
    // Review Focus 4: a goal unreachable because of a content typo is caught through isGoalMet(example, goal)
    const widgets = {
      ...registry,
      BaseDial: { ...registry.BaseDial, initial: () => ({ value: 0 }), isGoalMet: (s: { value: number }, g: { value: number }) => s.value === g.value },
    }
    expect(errs(withSteps([w({ goal: { value: 45 }, example: { value: 45 } }), recap]), { widgets })).toEqual([])
    has(withSteps([w({ goal: { value: 45 }, example: { value: 54 } }), recap]), /example does not meet the goal/, { widgets })
    has(withSteps([w({ goal: { value: 0 }, example: { value: 0 } }), recap]), /goal is already met by the initial state/, { widgets })
    const throwing = { ...registry, BaseDial: { ...registry.BaseDial, initial: () => { throw new Error('bad config') } } }
    has(withSteps([w({}), recap]), /initial\(config\) threw: bad config/, { widgets: throwing })
  })

  it('widget config: every string is linted, and config holds short non-Hebrew labels only', () => {
    const w = (config: unknown): Step => ({ id: 'w', kind: 'widget', prompt: 'הזיזו', widget: 'GateToy', config })
    const fn = () => 0 as const
    expect(errs(withSteps([w({ vars: ['A', 'B'], expr: { fn, display: "(A+B)'" } }), recap]))).toEqual([])
    has(withSteps([w({ vars: ['A'], expr: { fn, display: 'שער 2^4 = 16' } }), recap]), /l1\/w: config.expr.display: formula outside an LTR isolate/)
    has(withSteps([w({ vars: ['A'], expr: { fn, display: 'הסבר' } }), recap]), /config.expr.display has Hebrew text/)
    has(withSteps([w({ vars: ['A'], nested: [{ label: 'x'.repeat(41) }], expr: { fn, display: 'A' } }), recap]), /config.nested\[0\].label is 41 characters/)
  })

  it('check-number and the player share one normalisation (spaces, case, Unicode minus)', () => {
    const n = (answer: string, got: string): Step => ({ id: 'n', kind: 'check-number', prompt: 'כמה?', answer, compute: () => got, feedbackWrong: 'לא' })
    expect(errs(withSteps([n('−6.25', '-6.25'), recap]))).toEqual([])
    expect(normalizeAnswer(' −6.25 ')).toBe('-6.25')
    expect(matchesAnswer('-6.25', '−6.25')).toBe(true)
  })

  it('skip quiz: at least 6 questions, each with distinct options and a correct index in range', () => {
    has(base({ skipQuiz: ['q1', 'q2', 'q3', 'q4', 'q5'].map(q) }), /skipQuiz has 5 questions \(need at least 6\)/)
    has(base({ skipQuiz: [...['q1', 'q2', 'q3', 'q4', 'q5'].map(q), { ...q('q6'), options: ['א', 'א'] }] }), /q6: options are not distinct/)
    has(base({ skipQuiz: [...['q1', 'q2', 'q3', 'q4', 'q5'].map(q), { ...q('q6'), correct: 2 }] }), /q6: correct out of range/)
  })

  it('the content text lint applies to every string', () => {
    const bad = 'למשל 2^4 = 16 פונקציות'
    has(base({ title: bad }), /title: formula outside an LTR isolate/)
    has(base({ blurb: bad }), /blurb: formula/)
    has(withSteps([{ id: 'a', kind: 'explain', text: bad }, recap]), /l1\/a: text: formula/)
    has(withSteps([{ id: 'c', kind: 'check', prompt: 'מה?', options: ['א', bad], correct: 0, feedback: ['כן', 'לא'] }, recap]), /l1\/c: option 2: formula/)
    has(withSteps([{ id: 'c', kind: 'check', prompt: 'מה?', options: ['א', 'ב'], correct: 0, feedback: ['כן', 'מחוץ לטווח 8− עד 7'] }, recap]), /l1\/c: feedback 2: negative number/)
    has(withSteps([{ id: 'r', kind: 'recap', points: ['א', 'ב', bad] }]), /l1\/r: point 3: formula/)
    has(base({ skipQuiz: [...['q1', 'q2', 'q3', 'q4', 'q5'].map(q), { ...q('q6'), prompt: bad }] }), /q6: prompt: formula/)
    // the same text in an isolate is fine
    expect(errs(base({ title: `למשל ${ltr('2^4 = 16')} פונקציות` }))).toEqual([])
  })
})
