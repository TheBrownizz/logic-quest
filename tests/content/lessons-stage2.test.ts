import { lessonsForStage } from '../../src/content/lessons/catalog'
import { describe, it, expect } from 'vitest'
import { expectFullLesson, expectLessonsValid, goalWidgets } from './lessonTestUtils'
import { encodeNeighbour, figures } from '../../src/content/switching/lessons/stage2'
import { decode, encodeValue, isGoalMet, initial } from '../../src/ui/lessons/widgets/bitFieldLogic'
import { initial as initialCL, isGoalMet as isGoalMetCL } from '../../src/ui/lessons/widgets/complementLabLogic'
import type { ComplementLabConfig, ComplementLabGoal, ComplementLabState } from '../../src/ui/lessons/widgets/complementLabLogic'
import { initial as initialBC, isGoalMet as isGoalMetBC } from '../../src/ui/lessons/widgets/baseConvertLogic'
import type { BaseConvertConfig, BaseConvertGoal, BaseConvertState } from '../../src/ui/lessons/widgets/baseConvertLogic'
import type { Step } from '../../src/content/lessons/types'
import type { BitFieldConfig, BitFieldGoal, BitFieldState } from '../../src/ui/lessons/widgets/bitFieldLogic'

const STAGE = 'sw-2-arith'
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length
type W = Extract<Step, { kind: 'widget' }>

describe('stage 2 lessons', () => {
  const lessons = expectLessonsValid(STAGE)

  it('are the three lessons 2.1–2.3, each a full lesson', () => {
    expect(lessons.map(l => l.id)).toEqual(['sw-2-l1', 'sw-2-l2', 'sw-2-l3'])
    for (const l of lessons) expectFullLesson(l)
    expect(new Set(lessons.map(l => l.source))).toEqual(new Set(['סילבוס: אריתמטיקה בינארית, נקודה צפה (תקן IEEE) וקודים']))
  })

  it('explain steps stay at about 60 words', () => {
    for (const l of lessons) for (const s of l.steps) if (s.kind === 'explain') expect(words(s.text), `${l.id}/${s.id}`).toBeLessThanOrEqual(60)
  })

  it('every BitField goal is a normal float32 reachable with the unlocked fields', () => {
    for (const l of lessons) for (const s of (goalWidgets(l) as W[]).filter(w => w.widget === 'BitField')) {
      const c = s.config as BitFieldConfig, g = s.goal as BitFieldGoal
      const target = encodeValue(g.value)
      expect(target, `${l.id}/${s.id}`).not.toBeNull()
      expect(isGoalMet({ bits: target! }, g, c)).toBe(true)
      expect((s.example as BitFieldState).bits).toBe(target)
      // only unlocked bits differ between the start and the answer
      const start = initial(c).bits
      for (let i = 0; i < 32; i++) if (start[i] !== target![i]) {
        const part = i === 0 ? 'sign' : i <= 8 ? 'exponent' : 'mantissa'
        expect(c.locked ?? [], `${l.id}/${s.id} bit ${i}`).not.toContain(part)
      }
    }
  })

  it('goal values decode as intended', () => {
    const goals = lessons.flatMap(l => goalWidgets(l) as W[]).filter(w => w.widget === 'BitField').map(s => (s.goal as BitFieldGoal).value)
    expect(goals).toEqual([-6.5, 0.25, 1.875, -6.25, 0.03125])
    expect(decode(encodeValue(-6.25)!)).toMatchObject({ sign: 1, exponent: 129, mantissaBits: '1001'.padEnd(23, '0') })
    expect(decode(encodeValue(0.03125)!).exponent).toBe(122)
  })

  it('the ComplementLab and BaseConvert steps have goals that their examples meet (so they open unfinished)', () => {
    const find = (id: string) => lessons.flatMap(l => l.steps).find(s => s.id === id) as W
    const neg = find('negate'), bin = find('binary')
    expect(neg.goal).toEqual({ phase: 'r' })
    expect(isGoalMetCL(neg.example as ComplementLabState, neg.goal as ComplementLabGoal, neg.config as ComplementLabConfig)).toBe(true)
    expect(isGoalMetCL(initialCL(neg.config as ComplementLabConfig), neg.goal as ComplementLabGoal, neg.config as ComplementLabConfig)).toBe(false)
    expect(bin.goal).toEqual({ finished: true })
    expect(isGoalMetBC(bin.example as BaseConvertState, bin.goal as BaseConvertGoal, bin.config as BaseConvertConfig)).toBe(true)
    expect(isGoalMetBC(initialBC(bin.config as BaseConvertConfig), bin.goal as BaseConvertGoal, bin.config as BaseConvertConfig)).toBe(false)
  })

  it('the invented neighbour code follows its definition', () => {
    expect(['0110', '1011', '1101'].map(encodeNeighbour)).toEqual(['1010', '1101', '0111'])
    expect(() => encodeNeighbour('101')).toThrow()
  })

  it('figures are SVG with ids prefixed s2-', () => {
    for (const [id, svg] of Object.entries(figures)) {
      expect(id.startsWith('s2-')).toBe(true)
      expect(svg.trimStart().startsWith('<svg')).toBe(true)
    }
  })
})

// ── Self-review: every keyed answer re-derived from first principles (independent of the lesson's own compute()). ──

const plain = (s: string) => s.replace(/[⁦-⁩]/g, '').replace(/ /g, ' ').replace(/−/g, '-')
const bin = (n: number, w: number) => (((n % 2 ** w) + 2 ** w) % 2 ** w).toString(2).padStart(w, '0')
const signed = (b: string) => parseInt(b, 2) - (b[0] === '1' ? 2 ** b.length : 0)
const twos = (b: string) => bin(2 ** b.length - parseInt(b, 2), b.length)
const bcd = (n: number) => [...String(n)].map(d => bin(Number(d), 4)).join(' ')
const gray = (b: string) => [...b].map((x, i) => (i === 0 ? x : String(Number(x) ^ Number(b[i - 1])))).join('')
const ones = (b: string) => [...b].filter(x => x === '1').length
const f32 = (hex: string) => { const dv = new DataView(new ArrayBuffer(4)); dv.setUint32(0, parseInt(hex, 16)); return dv.getFloat32(0) }
const hexOf = (v: number) => { const dv = new DataView(new ArrayBuffer(4)); dv.setFloat32(0, v); return dv.getUint32(0).toString(16).toUpperCase().padStart(8, '0') }
const expField = (v: number) => Math.floor(Math.log2(Math.abs(v))) + 127

describe('stage 2 lessons: answers re-derived', () => {
  const [l1, l2, l3] = lessonsForStage(STAGE)
  const step = (l: typeof l1, id: string) => l.steps.find(s => s.id === id)!
  const keyed = (l: typeof l1, id: string) => { const s = step(l, id); if (s.kind !== 'check') throw new Error(id); return plain(s.options[s.correct]) }
  const quiz = (l: typeof l1, id: string) => { const q = l.skipQuiz.find(x => x.id === id)!; return plain(q.options[q.correct]) }
  const num = (l: typeof l1, id: string) => { const s = step(l, id); if (s.kind === 'check-number') return s.answer; if (s.kind === 'try' && s.puzzle.type === 'number') return s.puzzle.answer; throw new Error(id) }

  it('2.1', () => {
    expect(keyed(l1, 'add-check')).toBe(bin(5 + 3, 4))
    expect(num(l1, 'width-num')).toBe(bin(13 + 7, 4))
    expect(keyed(l1, 'signed-check')).toBe(String(signed('1010')))
    expect(num(l1, 'sub-try')).toBe(bin(6 - 3, 4))
    expect(bin(0b0110 + parseInt(twos('0011'), 2), 4)).toBe('0011')
    // explain examples
    expect(bin(12 + 5, 4)).toBe('0001'); expect(bin(7 + parseInt(twos('0101'), 2), 4)).toBe('0010'); expect(twos('0101')).toBe('1011')
    expect(signed(bin(5 + 4, 4))).toBe(-7); expect(twos('0110')).toBe('1010')
    // overflow check: 6 + 5 in 4 signed bits gives 1011 = −5, carry into the sign bit 1, carry out 0
    const s = bin(6 + 5, 4)
    expect([s, signed(s)]).toEqual(['1011', -5])
    expect(((0b110 + 0b101) >> 3) & 1).toBe(1)
    expect((0b0110 + 0b0101) >> 4).toBe(0)
    expect(keyed(l1, 'overflow-check')).toContain('-5')
    expect(quiz(l1, 'q1')).toBe(bin(7 + 1, 4))
    expect(quiz(l1, 'q2')).toBe(`${-(2 ** 7)} עד ${2 ** 7 - 1}`)
    expect(quiz(l1, 'q3')).toBe(twos('00101100'))
    expect(quiz(l1, 'q4')).toBe(String(signed('11111111')))
    expect(quiz(l1, 'q7').startsWith(twos('1000'))).toBe(true)
  })

  it('2.2', () => {
    expect(keyed(l2, 'bias-check')).toBe(String(0b10000100 - 127))
    expect(Number(keyed(l2, 'mantissa-check'))).toBe(1 + 1 / 4 + 1 / 8)
    expect(1 + 0.5 + 0.125).toBe(1.625)
    expect(Number(num(l2, 'exp-num'))).toBe(expField(20))
    expect(Number(num(l2, 'decode'))).toBe(f32('C1200000'))
    expect(f32('C1200000')).toBe(-1.25 * 8)
    // explain examples
    expect(hexOf(10.5)).toBe('41280000'); expect(expField(10.5)).toBe(130);
    expect(1 + 1 / 4 + 1 / 16).toBe(10.5 / 8)
    expect(6.25).toBe((1 + 1 / 2 + 1 / 16) * 4)
    expect(hexOf(-6.25)).toBe('C0C80000')
    expect(quiz(l2, 'q3')).toBe(String(0b10000011 - 127))
    expect(Number(quiz(l2, 'q4'))).toBe(1.5)
    expect(Number(quiz(l2, 'q5'))).toBe(f32('3F800000'))
    expect(Number(quiz(l2, 'q6'))).toBe(f32('40400000'))
  })

  it('2.3', () => {
    expect(keyed(l3, 'bcd-check')).toBe(bcd(47))
    expect((47).toString(2)).toBe('101111')
    expect(num(l3, 'gray-num')).toBe(gray('1011'))
    expect(bcd(59)).toBe('0101 1001'); expect((59).toString(2)).toBe('111011')
    expect([ones('1100101') % 2, ones('1100111') % 2]).toEqual([0, 1])
    expect(ones('10110110')).toBe(5)
    expect(keyed(l3, 'parity-check')).toContain('אי-זוגי')
    expect(keyed(l3, 'excess-check')).toBe(String(0b0110 - 8))
    expect(bin(-3 + 8, 4)).toBe('0101')
    expect(expField(0.03125)).toBe(122)
    expect(quiz(l3, 'q1')).toBe(bcd(905)); expect((905).toString(2)).toBe('1110001001')
    expect(quiz(l3, 'q2')).toBe(String(4 * 4))
    expect(quiz(l3, 'q3')).toBe(gray('1100'))
    expect(quiz(l3, 'q6')).toBe(bin(-5 + 8, 4))
    expect(quiz(l3, 'q7')).toBe('12')
  })
})
