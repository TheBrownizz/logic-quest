import { describe, it, expect } from 'vitest'
import { expectFullLesson, expectLessonsValid, stepCounts } from './lessonTestUtils'
import type { Lesson, SkipQuestion, Step } from '../../src/content/lessons/types'
import { modelOf } from '../../src/ui/lessons/widgets/complementLabLogic'
import { stateAt, totalSteps } from '../../src/ui/lessons/widgets/baseConvertLogic'
import { checkConfig, valueOf } from '../../src/ui/lessons/widgets/baseDialLogic'

const lessons = expectLessonsValid('sw-1-numbers')
const byId = (id: string) => lessons.find(l => l.id === id)!
const step = (l: string, s: string) => byId(l).steps.find(x => x.id === s)! as Step
const quiz = (l: string, q: string) => byId(l).skipQuiz.find(x => x.id === q)! as SkipQuestion
const answerOf = (q: SkipQuestion) => q.options[q.correct]
const check = (l: string, s: string) => { const x = step(l, s); if (x.kind !== 'check') throw new Error(s); return x.options[x.correct] }
const num = (l: string, s: string) => { const x = step(l, s); if (x.kind !== 'check-number') throw new Error(s); return x.answer }

// Independent re-derivations, from first principles (no shared engine helpers).
const val = (s: string, r: number) => [...s].reduce((v, ch) => v * r + parseInt(ch, 36), 0)
const write = (n: number, r: number, w = 0) => n.toString(r).toUpperCase().padStart(w, '0')
const r1 = (s: string, r: number) => [...s].map(ch => (r - 1 - parseInt(ch, 36)).toString(r).toUpperCase()).join('')
const rc = (s: string, r: number) => write((r ** s.length - val(s, r)) % r ** s.length, r, s.length)

describe('stage 1 lessons', () => {
  it('three full lessons, 1.1 keeps the id sw-1-l1, in order', () => {
    expect(lessons.map(l => l.id)).toEqual(['sw-1-l1', 'sw-1-l2', 'sw-1-l3'])
    lessons.forEach(expectFullLesson)
  })
  it('never more than 2 explain steps in a row, and every explain stays near 60 words', () => {
    for (const l of lessons as Lesson[]) {
      let run = 0
      for (const s of l.steps) {
        run = s.kind === 'explain' ? run + 1 : 0
        expect(run, `${l.id}/${s.id}`).toBeLessThanOrEqual(2)
        if (s.kind === 'explain') expect(s.text.split(/\s+/).length, `${l.id}/${s.id}`).toBeLessThanOrEqual(62)
      }
      expect(stepCounts(l).check).toBeGreaterThanOrEqual(2)
    }
  })
  it('skip-quiz options are distinct', () => {
    for (const l of lessons) for (const q of l.skipQuiz) expect(new Set(q.options).size, `${l.id}/${q.id}`).toBe(q.options.length)
  })
})

describe('stage 1 answers, re-derived', () => {
  it('1.1 checks', () => {
    expect(check('sw-1-l1', 'weight')).toBe(String(2 ** 3))
    expect(num('sw-1-l1', 'to-dec')).toBe(String(2 * 16 + 10))
    // only one option holds a digit ≥ 5
    const legal = step('sw-1-l1', 'legal'); if (legal.kind !== 'check') throw new Error()
    expect(legal.options.filter(o => [...o].some(c => +c >= 5))).toEqual([check('sw-1-l1', 'legal')])
    // (31)_r = 16 → 3r + 1 = 16
    const rs = Array.from({ length: 30 }, (_, i) => i + 4).filter(r => 3 * r + 1 === 16)
    expect(num('sw-1-l1', 'find-r-num')).toBe(rs.join(','))
    const t = step('sw-1-l1', 'try-r'); if (t.kind !== 'try' || t.puzzle.type !== 'number') throw new Error()
    // (13)_r + (24)_r = (41)_r, digits up to 4 so r ≥ 5
    const sol = Array.from({ length: 32 }, (_, i) => i + 5).filter(r => (r + 3) + (2 * r + 4) === 4 * r + 1)
    expect(t.puzzle.answer).toBe(sol.join(','))
  })
  it('1.1 widget goals: the examples are the goal values written in the base', () => {
    for (const [id, base, width, v] of [['dial10', 10, 3, 207], ['dial2', 2, 6, 45], ['dial16', 16, 2, 171]] as const) {
      const s = step('sw-1-l1', id); if (s.kind !== 'widget') throw new Error()
      expect(s.goal).toEqual({ value: v })
      expect((s.example as { digits: number[] }).digits.map(d => d.toString(16)).join('')).toBe(v.toString(base).padStart(width, '0'))
      expect(() => checkConfig(s.config as never)).not.toThrow()
      expect(valueOf((s.example as { digits: number[] }).digits, s.config as never)).toBe(v)
    }
  })
  it('1.1 skip quiz', () => {
    expect(answerOf(quiz('sw-1-l1', 'q1'))).toBe(String(val('101101', 2)))
    expect(answerOf(quiz('sw-1-l1', 'q2'))).toBe('0 עד 7')
    expect(answerOf(quiz('sw-1-l1', 'q3'))).toBe(String(5 ** 2))
    expect(answerOf(quiz('sw-1-l1', 'q4'))).toBe('42')
    expect(answerOf(quiz('sw-1-l1', 'q5'))).toBe(String((14 - 4) / 2))
    expect(answerOf(quiz('sw-1-l1', 'q6'))).toBe(String(2 ** 3 - 1))
    expect(answerOf(quiz('sw-1-l1', 'q7'))).toBe('פי 16')
  })
  it('1.2 checks and widgets', () => {
    expect(num('sw-1-l2', 'to-bin')).toBe(write(37, 2))
    expect(num('sw-1-l2', 'hex-bin-num')).toBe(write(0xd5, 2, 8))
    const t = step('sw-1-l2', 'try-oct-hex'); if (t.kind !== 'try' || t.puzzle.type !== 'number') throw new Error()
    expect(t.puzzle.answer).toBe(write(val('35', 8), 16))
    for (const id of ['divide2', 'divide8', 'bin-hex', 'hex-bin']) {
      const s = step('sw-1-l2', id); if (s.kind !== 'widget') throw new Error()
      const c = s.config as { from: number; to: number; value: string }
      const ex = s.example as { step: number; result: string; finished: boolean }
      expect(ex.result, id).toBe(write(val(c.value, c.from), c.to))
      expect(ex.step).toBe(totalSteps(s.config as never))
      expect(stateAt(s.config as never, ex.step)).toEqual(ex)
    }
    expect(check('sw-1-l2', 'rem-meaning')).toContain('הימנית')
    expect(check('sw-1-l2', 'via2')).toContain('3 ביטים')
  })
  it('1.2 skip quiz', () => {
    expect(answerOf(quiz('sw-1-l2', 'q1'))).toBe(write(45, 2))
    expect(answerOf(quiz('sw-1-l2', 'q2'))).toBe('מהאחרונה לראשונה')
    expect(answerOf(quiz('sw-1-l2', 'q3'))).toBe('4')
    expect(answerOf(quiz('sw-1-l2', 'q4'))).toBe(write(val('10110111', 2), 16))
    expect(answerOf(quiz('sw-1-l2', 'q5'))).toBe(write(0x5e, 2, 8))
    expect(answerOf(quiz('sw-1-l2', 'q6'))).toBe(write(val('17', 8), 2))
    expect(answerOf(quiz('sw-1-l2', 'q7'))).toContain('דרך בסיס 2')
  })
  it('1.3 checks and widgets', () => {
    expect(num('sw-1-l3', 'r1-num')).toBe(r1('5072', 10))
    expect(check('sw-1-l3', 'twos')).toBe(rc('0110', 2))
    expect(num('sw-1-l3', 'hex-comp')).toBe(rc('2A0', 16))
    expect(num('sw-1-l3', 'six-bit')).toBe(write(val('110010', 2) - val('011101', 2), 2, 6))
    expect(check('sw-1-l3', 'carry-meaning')).toContain('זורקים')
    expect(check('sw-1-l3', 'end-around')).toContain('הימנית')
    // r1-sub's worked example: 73 − 29 with the 9's complement and the end-around carry
    expect(r1('29', 10)).toBe('70')
    expect(73 + 70).toBe(143)
    expect((143 % 100) + 1).toBe(73 - 29)
    // the end-around rule itself, every 2-digit pair: carry → add it back; no carry → −(9's complement of the sum)
    for (let a = 0; a < 100; a++) for (let b = 0; b < 100; b++) {
      const s = a + val(r1(write(b, 10, 2), 10), 10)
      const got = s >= 100 ? (s % 100) + 1 : -val(r1(write(s, 10, 2), 10), 10)
      expect(got + 0, `${a}-${b}`).toBe(a - b) // a = b gives −0 (the 9's complement's second zero)
    }
    // the subtraction widgets give the true difference
    for (const [id, diff] of [['sub-pos', 73 - 29], ['sub-neg', 13 - 18]] as const) {
      const s = step('sw-1-l3', id); if (s.kind !== 'widget') throw new Error()
      const c = s.config as { base: number; value: string; other: string }
      expect(val(c.value, c.base) - val(c.other, c.base)).toBe(diff)
      expect(modelOf(s.config as never).result!.value).toBe(diff)
    }
    expect(modelOf({ base: 10, digits: 5, value: '03726', mode: 'complement' }).r1.join('')).toBe(r1('03726', 10))
  })
  it('1.3 skip quiz', () => {
    expect(answerOf(quiz('sw-1-l3', 'q1'))).toBe(r1('4057', 10))
    expect(answerOf(quiz('sw-1-l3', 'q2'))).toBe(rc('4057', 10))
    expect(answerOf(quiz('sw-1-l3', 'q3'))).toBe(rc('0110', 2))
    expect(answerOf(quiz('sw-1-l3', 'q4'))).toBe(r1('10110', 2))
    expect(answerOf(quiz('sw-1-l3', 'q5'))).toBe('זורקים אותו, והתוצאה חיובית')
    expect(answerOf(quiz('sw-1-l3', 'q6'))).toContain('שלילית')
    expect(answerOf(quiz('sw-1-l3', 'q7'))).toBe(String((83 + val(rc('27', 10), 10)) % 100))
    expect(answerOf(quiz('sw-1-l3', 'q8'))).toBe('המשלים ל-r גדול ב-1')
  })
})
