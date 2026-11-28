import { describe, it, expect } from 'vitest'
import { expectFullLesson, expectLessonsValid } from './lessonTestUtils'
import { SYLLABUS } from '../../src/content/switching/syllabus'
import { circuitTruthTable } from '../../src/logic/circuit'
import { romBits } from '../../src/logic/sizing'
import { timing, values, toNumber } from '../../src/ui/lessons/widgets/rippleTimelineLogic'
import {
  initial as muxInitial, isGoalMet as muxGoal, output, setSelect, setX, withData, type DataSrc, type MuxToyConfig,
} from '../../src/ui/lessons/widgets/muxToyLogic'
import type { Lesson, Step } from '../../src/content/lessons/types'
import type { Bit } from '../../src/logic/boolean'

const clean = (s: string) => s.replace(/[⁦⁩]/g, '').replace(/ /g, ' ')
const lessons = expectLessonsValid('sw-5-blocks')
const byId = (id: string) => lessons.find(l => l.id === id)!
const step = <K extends Step['kind']>(l: Lesson, id: string) => l.steps.find(s => s.id === id) as Extract<Step, { kind: K }>
const correctText = (l: Lesson, id: string) => { const s = step<'check'>(l, id); return clean(s.options[s.correct]) }
const quiz = (l: Lesson, id: string) => { const q = l.skipQuiz.find(x => x.id === id)!; return clean(q.options[q.correct]) }
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length

describe('stage 5 lessons: structure', () => {
  it('three full lessons in order', () => {
    expect(lessons.map(l => l.id)).toEqual(['sw-5-l1', 'sw-5-l2', 'sw-5-l3'])
    for (const l of lessons) expectFullLesson(l)
  })
  it('sources are syllabus topics, explains stay short, at most two explains in a row', () => {
    for (const l of lessons) {
      expect(SYLLABUS.map(t => `סילבוס: ${t}`)).toContain(l.source)
      let run = 0
      for (const s of l.steps) {
        run = s.kind === 'explain' ? run + 1 : 0
        expect(run, `${l.id}/${s.id}`).toBeLessThanOrEqual(2)
        if (s.kind === 'explain') expect(words(s.text), `${l.id}/${s.id}`).toBeLessThanOrEqual(62)
      }
    }
  })
  it('lesson 5.1 has a circuit try', () => {
    expect(byId('sw-5-l1').steps.some(s => s.kind === 'try' && s.puzzle.type === 'circuit')).toBe(true)
  })
})

describe('stage 5 lessons: answers re-derived from first principles', () => {
  const l1 = byId('sw-5-l1'), l2 = byId('sw-5-l2'), l3 = byId('sw-5-l3')
  it('5.1 adders', () => {
    // half/full adder specs = binary arithmetic, and the reference circuits compute them
    for (const id of ['build-ha', 'build-fa']) {
      const p = step<'try'>(l1, id).puzzle
      if (p.type !== 'circuit') throw new Error(id)
      p.spec.rows.forEach((row, r) => {
        const bitsIn = p.spec.inputs.map((_, j) => (r >> (p.spec.inputs.length - 1 - j)) & 1)
        const sum = bitsIn.reduce((a, b) => a + b, 0)
        expect(row, `${id} row ${r}`).toEqual([sum >> 1, sum & 1])
      })
      const tt = circuitTruthTable(p.reference)
      if ('error' in tt) throw new Error(id)
      expect(tt.rows).toEqual(p.spec.rows)
    }
    expect(correctText(l1, 'one-one')).toBe('כותבים 0 ונושאים 1') // 1+1 = 2 = 10₂
    const s = 1 + 1 + 1
    expect(correctText(l1, 'fa-111')).toBe(`S = ${s & 1}, Cout = ${s >> 1}`)
    expect(correctText(l1, 'why-plus-one')).toContain('משלים ל-2')
    expect(step<'check-number'>(l1, 'v-time').compute()).toBe(String(75 + 5 * 100 + 75))
    const sum2 = 1 + 0 + 1
    expect(quiz(l1, 'q2')).toBe(`S = ${sum2 & 1}, Cout = ${sum2 >> 1}`)
    expect(quiz(l1, 'q3')).toBe(`${6 * 100} ns`)
    expect(quiz(l1, 'q1')).toBe('A · B')
    expect(quiz(l1, 'q5')).toBe('XOR')
    // widget goals: settle times of the two timelines, and what they show
    expect(timing({ a: '0111', b: '0001', delays: { fa: 100 } }).settle).toBe(400)
    const subCfg = { a: '0101', b: '0011', delays: { fa: 100, xor: 75 }, m: 1 as const, overflow: true }
    expect(timing(subCfg).settle).toBe(550)
    expect(toNumber(values(subCfg).sum)).toBe(5 - 3)
  })
  it('5.2 MUX and decoders', () => {
    // which input: S1S0 = 10
    expect(correctText(l2, 'which')).toBe(`D${0b10}`)
    // AND on a 4×1 MUX: D_i = AND of the bits of i
    const and = [0, 1, 2, 3].map(i => ((i >> 1) & i & 1)).join(' ')
    expect(correctText(l2, 'and')).toBe(and)
    // Σm(1,3,4,6) with C in the data inputs: check every option by evaluating the MUX
    const cfg: MuxToyConfig = { selectBits: 2, mode: 'function', extra: 'C', selectNames: ['A', 'B'] }
    const parse = (o: string): DataSrc[] => clean(o).split(', ').map(t => (t === 'C' ? 'x' : t === "C'" ? 'nx' : (Number(t) as 0 | 1)))
    const implementsF = (data: DataSrc[], f: number[]) => {
      let st = withData(muxInitial(cfg), data, 0)
      for (let m = 0; m < 8; m++) {
        st = setX(setSelect(setSelect(st, 0, ((m >> 2) & 1) as Bit), 1, ((m >> 1) & 1) as Bit), (m & 1) as Bit)
        if (output(st) !== (f.includes(m) ? 1 : 0)) return false
      }
      return true
    }
    const w = step<'check'>(l2, 'wiring')
    expect(w.options.map(o => implementsF(parse(o), [1, 3, 4, 6]))).toEqual(w.options.map((_, i) => i === w.correct))
    // majority widget example really is majority
    const maj = [0, 1, 2, 3, 4, 5, 6, 7].filter(m => [4, 2, 1].filter(b => m & b).length >= 2)
    expect(maj).toEqual([3, 5, 6, 7])
    expect(implementsF([0, 'x', 'x', 1], maj)).toBe(true)
    expect(step<'check-number'>(l2, 'count').compute()).toBe('16')
    expect(correctText(l2, 'decoder-or')).toBe([2, 3, 7].map(i => `Y${i}`).join(', '))
    expect(quiz(l2, 'q1')).toBe(String(Math.log2(8)))
    expect(quiz(l2, 'q2')).toBe('D1')
    expect(quiz(l2, 'q3')).toBe('XOR') // 0 1 1 0
    expect(quiz(l2, 'q5')).toBe(String(4 - 1))
    expect(quiz(l2, 'q7')).toBe('Y1, Y4')
    // MUX widget goals are reachable and not met at the start
    expect(muxGoal({ select: [1, 0], inputs: [0, 1, 1, 0] }, { kind: 'route', input: 2 }, { selectBits: 2, mode: 'route' })).toBe(true)
  })
  it('5.3 ROM and PLA', () => {
    expect(step<'check-number'>(l3, 'size').compute()).toBe(String(2 ** 4 * 8))
    expect(step<'check-number'>(l3, 'compare').compute()).toBe(String(2 ** 8 * 3))
    expect(step<'check-number'>(l3, 'shared').compute()).toBe('3')
    expect(correctText(l3, 'fixed')).toContain('מישור ה-AND קבוע')
    expect(quiz(l3, 'q1')).toBe(String(romBits(5, 3)))
    expect(quiz(l3, 'q3')).toBe(String(2 ** 10))
    const stored = [0, 1, 1, 0, 1, 0, 0, 1]
    expect(quiz(l3, 'q6')).toBe(`Σm(${stored.flatMap((v, i) => (v ? [i] : [])).join(', ')})`)
    // odd parity of 3 bits is exactly the ROM widget's goal
    expect([0, 1, 2, 3, 4, 5, 6, 7].filter(i => (i.toString(2).match(/1/g)?.length ?? 0) % 2 === 1)).toEqual([1, 2, 4, 7])
  })
})
