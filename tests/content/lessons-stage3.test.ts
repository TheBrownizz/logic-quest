import { describe, it, expect } from 'vitest'
import { expectFullLesson, expectLessonsValid, stepCounts } from './lessonTestUtils'
import type { Lesson, Step } from '../../src/content/lessons/types'
import type { GateToyConfig, GateToyGoal } from '../../src/ui/lessons/widgets/gateToyLogic'
import { columnOf } from '../../src/ui/lessons/widgets/gateToyLogic'
import type { IdentityBenchConfig, IdentityBenchGoal } from '../../src/ui/lessons/widgets/identityBenchLogic'
import { differingRows, columns } from '../../src/ui/lessons/widgets/identityBenchLogic'
import { registry } from '../../src/ui/lessons/widgets/registry'
import { evalGate, circuitTruthTable, usesOnly, gateCount } from '../../src/logic/circuit'
import { columnOfDisplay, sameDisplay } from '../ui/widgets/boolExprParser'
import { SYLLABUS } from '../../src/content/switching/syllabus'

const lessons = expectLessonsValid('sw-3-boolean')
const byId = (id: string): Lesson => lessons.find(l => l.id === id)!
const step = (l: Lesson, id: string): Step => l.steps.find(s => s.id === id)!
const strip = (s: string) => s.replace(/[⁦⁩]/g, '').replace(/ /g, ' ')

describe('stage 3 lessons: shape', () => {
  it('there are three, in order, each with a syllabus source', () => {
    expect(lessons.map(l => l.id)).toEqual(['sw-3-l1', 'sw-3-l2', 'sw-3-l3'])
    expect(lessons.map(l => l.title)).toEqual(['שערים וטבלאות אמת', 'חוקי האלגברה ודה-מורגן', 'NAND ו-NOR: שערים אוניברסליים'])
    for (const l of lessons) expect(SYLLABUS.map(t => `סילבוס: ${t}`)).toContain(l.source)
  })
  for (const id of ['sw-3-l1', 'sw-3-l2', 'sw-3-l3']) {
    it(`${id} meets the lesson counts`, () => expectFullLesson(byId(id)))
    it(`${id} never has three explain steps in a row`, () => {
      const ks = byId(id).steps.map(s => s.kind)
      for (let i = 0; i + 2 < ks.length; i++) expect(ks.slice(i, i + 3).every(k => k === 'explain'), `${id}@${i}`).toBe(false)
    })
  }
  it('every check marks one correct option and gives feedback for each wrong one', () => {
    for (const l of lessons) for (const s of l.steps) if (s.kind === 'check') {
      expect(s.feedback).toHaveLength(s.options.length)
      expect(s.correct).toBeLessThan(s.options.length)
    }
  })
  it('3.3 has the NOT and AND try steps, NAND only, 2-input gates', () => {
    const tries = byId('sw-3-l3').steps.filter(s => s.kind === 'try')
    expect(tries.map(t => t.id)).toEqual(['try-not', 'try-and'])
    for (const t of tries) {
      if (t.kind !== 'try' || t.puzzle.type !== 'circuit') throw new Error('circuit expected')
      expect(usesOnly(t.puzzle.reference, ['NAND'])).toBe(true)
      expect(gateCount(t.puzzle.reference)).toBe(t.puzzle.optimalGates)
      // every gate has both inputs wired (2-input gates)
      for (const nd of t.puzzle.reference.nodes) if (nd.kind === 'NAND') expect(t.puzzle.reference.wires.filter(w => w.to.node === nd.id)).toHaveLength(2)
      // reference reproduces the spec independently of the validator
      const tt = circuitTruthTable(t.puzzle.reference, {})
      expect('rows' in tt && tt.rows.map(r => r[0])).toEqual(t.puzzle.spec.rows.map(r => r[0]))
      expect(t.puzzle.spec.inputs).toEqual(t.puzzle.spec.inputs.length === 1 ? ['A'] : ['A', 'B'])
      expect(t.puzzle.spec.outputs).toEqual(['F'])
    }
  })
})

/** Widget steps of every lesson, typed loosely for the cross-checks below. */
const widgets = lessons.flatMap(l => l.steps.filter(s => s.kind === 'widget').map(s => ({ l, s: s as Extract<Step, { kind: 'widget' }> })))

describe('widget configs: the display string describes the function', () => {
  for (const { l, s } of widgets) {
    if (s.widget === 'GateToy') {
      it(`${l.id}/${s.id} (GateToy)`, () => {
        const c = s.config as GateToyConfig
        expect(columnOfDisplay(c.expr.display, c.vars)).toEqual(columnOf(c.vars, c.expr))
        if (c.gate) {
          const col = Array.from({ length: 1 << c.vars.length }, (_, r) => evalGate(c.gate!, c.vars.map((_, k) => ((r >> (c.vars.length - 1 - k)) & 1) as 0 | 1)))
          expect(columnOf(c.vars, c.expr), 'the drawn gate matches the expression').toEqual(col)
        }
      })
    } else if (s.widget === 'IdentityBench') {
      it(`${l.id}/${s.id} (IdentityBench)`, () => {
        const c = s.config as IdentityBenchConfig
        const [lc, rc] = columns(c)
        expect(columnOfDisplay(c.left.display, c.vars)).toEqual(lc)
        expect(columnOfDisplay(c.right.display, c.vars)).toEqual(rc)
        const g = s.goal as IdentityBenchGoal
        if (g.kind === 'find-difference') expect(differingRows(c).length).toBeGreaterThan(0)
      })
    }
  }
  it('every widget step has a goal and an example that reaches it from a fresh state', () => {
    for (const { l, s } of widgets) {
      expect(s.goal, `${l.id}/${s.id}`).toBeDefined()
      const def = registry[s.widget] as unknown as { initial: (c: unknown) => unknown; isGoalMet: (st: unknown, g: unknown, c: unknown) => boolean }
      expect(def.isGoalMet(def.initial(s.config), s.goal, s.config), `${s.id} already met`).toBe(false)
      expect(def.isGoalMet(s.example, s.goal, s.config), `${s.id} example`).toBe(true)
    }
  })
  it('GateToy goals: the single lit row of AND3 is 111, and the box expression lights 3 of 8 rows', () => {
    const and3 = step(byId('sw-3-l1'), 'and3') as Extract<Step, { kind: 'widget' }>
    const c = and3.config as GateToyConfig
    expect(columnOf(c.vars, c.expr)).toEqual([0, 0, 0, 0, 0, 0, 0, 1])
    expect((and3.goal as GateToyGoal).kind).toBe('output')
    const box = step(byId('sw-3-l1'), 'box') as Extract<Step, { kind: 'widget' }>
    const bc = box.config as GateToyConfig
    expect(columnOf(bc.vars, bc.expr).filter(x => x === 1)).toHaveLength(3)
  })
})

/** The formulas of a check option or prompt, without the LTR isolate marks. */
const formula = (s: string) => strip(s).trim()
const sides = (s: string): [string, string] => { const [a, b] = formula(s).split('=').map(x => x.trim()); return [a, b] }

describe('checks and quiz answers derived independently', () => {
  const l2 = byId('sw-3-l2')
  it('3.2 not-identity: exactly option 3 is not an identity', () => {
    const c = step(l2, 'not-identity') as Extract<Step, { kind: 'check' }>
    const eq = c.options.map(o => { const [a, b] = sides(o); return sameDisplay(a, b, ['A', 'B']) })
    expect(eq).toEqual([true, true, false, true])
    expect(c.correct).toBe(2)
  })
  it('3.2 distribute-check: only A·B + A·C equals A·(B+C)', () => {
    const c = step(l2, 'distribute-check') as Extract<Step, { kind: 'check' }>
    expect(c.options.map(o => sameDisplay('A·(B+C)', o, ['A', 'B', 'C']))).toEqual([true, false, false, false])
    expect(c.correct).toBe(0)
  })
  it('3.2 demorgan-three: only A\'+B\'+C\' equals (A·B·C)\'', () => {
    const c = step(l2, 'demorgan-three') as Extract<Step, { kind: 'check' }>
    expect(c.options.map(o => sameDisplay("(A·B·C)'", o, ['A', 'B', 'C']))).toEqual([true, false, false, false])
    expect(c.correct).toBe(0)
  })
  it('3.2 complement: A·A\' is the constant 0', () => {
    expect(columnOfDisplay("A·A'", ['A'])).toEqual([0, 0])
    expect(columnOfDisplay("A+A'", ['A'])).toEqual([1, 1])
    expect(columnOfDisplay('A·A', ['A'])).toEqual([0, 1])
  })
  it('3.2 skip quiz', () => {
    const q = byId('sw-3-l2').skipQuiz
    const get = (id: string) => q.find(x => x.id === id)!
    expect(columnOfDisplay("A+A'", ['A'])).toEqual([1, 1]) // q1 -> "1"
    expect(get('q1').options[get('q1').correct]).toBe('1')
    expect(sameDisplay("(A+B)'", "A'·B'", ['A', 'B'])).toBe(true) // q2
    expect(get('q2').options[get('q2').correct]).toBe(formula(get('q2').options[1]))
    expect(columnOfDisplay('A·0', ['A'])).toEqual([0, 0]) // q3
    const q4 = get('q4').options.map(o => { const [a, b] = sides(o); return sameDisplay(a, b, ['A', 'B', 'C']) })
    expect(q4).toEqual([true, false, false, false])
    expect(get('q4').correct).toBe(0)
    expect(sameDisplay("(A·B)'", "A'+B'", ['A', 'B'])).toBe(true) // q7
    expect(get('q7').correct).toBe(0)
    expect(sameDisplay('A+A·B', 'A', ['A', 'B'])).toBe(true) // q8
    expect(get('q8').correct).toBe(0)
    expect(sameDisplay("(A+B)'", "A'+B'", ['A', 'B'])).toBe(false) // the trap option of q2
  })
  it('3.1 skip quiz and checks follow from the gate definitions', () => {
    const g = (k: Parameters<typeof evalGate>[0], a: 0 | 1, b: 0 | 1) => evalGate(k, [a, b])
    // or-zero: OR is 0 only at 00
    expect([0, 1, 2, 3].map(r => g('OR', (r >> 1) as 0 | 1, (r & 1) as 0 | 1))).toEqual([0, 1, 1, 1])
    // which-gate: the only 1 at row 00 is NOR; AND/XNOR/NAND are not
    const col = (k: Parameters<typeof evalGate>[0]) => [0, 1, 2, 3].map(r => g(k, (r >> 1) as 0 | 1, (r & 1) as 0 | 1)).join('')
    expect(col('NOR')).toBe('1000')
    expect(col('AND')).toBe('0001')
    expect(col('XNOR')).toBe('1001')
    expect(col('NAND')).toBe('1110')
    expect(col('XOR')).toBe('0110')
    // skip quiz: AND(1,0)=0; NAND=0 only at 11 and is the 1-everywhere-but-all-ones gate (also for 3 inputs)
    expect(g('AND', 1, 0)).toBe(0)
    expect(evalGate('NAND', [1, 1, 1])).toBe(0)
    expect([0, 1, 2, 3, 4, 5, 6].every(r => evalGate('NAND', [(r >> 2) & 1, (r >> 1) & 1, r & 1] as (0 | 1)[]) === 1)).toBe(true)
    // q7: (A+B)·C' at A=0,B=1,C=0 is 1
    expect(columnOfDisplay("(A+B)·C'", ['A', 'B', 'C'])[0b010]).toBe(1)
    // count-rows: 3 of 8, and the distractors are what the feedback says they are
    const c = columnOfDisplay("(A+B)·C'", ['A', 'B', 'C'])
    expect(c.filter(x => x === 1)).toHaveLength(3)
    expect(columnOfDisplay("C'", ['A', 'B', 'C']).filter(x => x === 1)).toHaveLength(4)
    expect(columnOfDisplay('A+B', ['A', 'B', 'C']).filter(x => x === 1)).toHaveLength(6)
  })
  it('3.3 checks and skip quiz', () => {
    const l3 = byId('sw-3-l3')
    // NAND(A,A) = A'
    expect(columnOfDisplay("(A·A)'", ['A'])).toEqual([1, 0])
    // OR from NAND: A+B = (A'·B')', built from 3 NAND gates (2 inverters and one NAND)
    expect(sameDisplay('A+B', "(A'·B')'", ['A', 'B'])).toBe(true)
    const orCheck = step(l3, 'or-count') as Extract<Step, { kind: 'check' }>
    expect(orCheck.options[orCheck.correct]).toBe('3')
    const q8 = l3.skipQuiz.find(x => x.id === 'q8')!
    expect(q8.options.map(o => sameDisplay('A+B', o, ['A', 'B']))).toEqual([true, false, false, false])
    expect(q8.correct).toBe(0)
    // NAND then NOT is AND: NAND(NAND(A,B), NAND(A,B))
    expect(sameDisplay("((A·B)')'", 'A·B', ['A', 'B'])).toBe(true)
    // universality: gates that are 0 on the all-zero row cannot make NOT; NOR(A,A)=A' and A·B=(A'+B')' are NOR-only
    for (const k of ['AND', 'OR', 'XOR'] as const) expect(evalGate(k, [0, 0])).toBe(0)
    expect(evalGate('NOT', [0])).toBe(1)
    expect(evalGate('NOR', [0, 0])).toBe(1)
    expect(sameDisplay("(A'+B')'", 'A·B', ['A', 'B'])).toBe(true)
    expect([0, 1].map(a => evalGate('NOR', [a as 0 | 1, a as 0 | 1]))).toEqual([1, 0])
    const wu = step(l3, 'which-universal') as Extract<Step, { kind: 'check' }>
    expect(wu.options[wu.correct]).toBe('NOR בלבד')
    // skip quiz: q1 NAND(A,A)=A', q5 one gate for NOT, q6 two gates for AND, q7 XOR not universal (0 at 00)
    const qs = l3.skipQuiz
    expect(qs.find(x => x.id === 'q1')!.options[qs.find(x => x.id === 'q1')!.correct]).toBe("A'")
    expect(qs.find(x => x.id === 'q5')!.options[qs.find(x => x.id === 'q5')!.correct]).toBe('1')
    expect(qs.find(x => x.id === 'q6')!.options[qs.find(x => x.id === 'q6')!.correct]).toBe('2')
    expect(qs.find(x => x.id === 'q7')!.options[qs.find(x => x.id === 'q7')!.correct]).toBe('XOR')
    expect(qs.find(x => x.id === 'q2')!.options[qs.find(x => x.id === 'q2')!.correct]).toBe('כששתי הכניסות הן 0')
    expect(qs.find(x => x.id === 'q3')!.options[qs.find(x => x.id === 'q3')!.correct]).toBe('AND')
  })
})

describe('stage 3 step counts', () => {
  it('3.3 has both try steps and a goal widget', () => {
    expect(stepCounts(byId('sw-3-l3')).try).toBe(2)
    expect(stepCounts(byId('sw-3-l1')).widget).toBeGreaterThanOrEqual(5)
  })
})
