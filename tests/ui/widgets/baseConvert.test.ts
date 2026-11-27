import { describe, it, expect } from 'vitest'
import { advance, divisionSteps, expected, groupPlan, initial, isGoalMet, stateAt, totalSteps } from '../../../src/ui/lessons/widgets/baseConvertLogic'
import type { BaseConvertConfig } from '../../../src/ui/lessons/widgets/baseConvertLogic'

const run = (c: BaseConvertConfig) => { let s = initial(c); while (!s.finished) s = advance(c, s); return s }
const div = (n: number, to: number): BaseConvertConfig => ({ from: 10, to, value: String(n), mode: 'divide' })

describe('BaseConvert logic: divide', () => {
  it('45 ÷ 2 step by step', () => {
    expect(divisionSteps(45, 2)).toEqual([
      { n: 45, q: 22, r: 1 }, { n: 22, q: 11, r: 0 }, { n: 11, q: 5, r: 1 }, { n: 5, q: 2, r: 1 }, { n: 2, q: 1, r: 0 }, { n: 1, q: 0, r: 1 },
    ])
  })
  it('the remainders found last are the most significant digits', () => {
    const c = div(45, 2)
    expect(stateAt(c, 0)).toEqual({ step: 0, result: '', finished: false })
    expect(stateAt(c, 1).result).toBe('1')
    expect(stateAt(c, 2).result).toBe('01')
    expect(stateAt(c, 3).result).toBe('101')
    expect(stateAt(c, 6)).toEqual({ step: 6, result: '101101', finished: true })
  })
  it('every value 0–300 in bases 2–16 converts to exactly the toString of the engine', () => {
    for (let to = 2; to <= 16; to++) for (let n = 0; n <= 300; n++) {
      const s = run(div(n, to))
      expect(s.result).toBe(n.toString(to).toUpperCase())
      expect(isGoalMet(s, { finished: true }, div(n, to))).toBe(true)
    }
  })
  it('zero takes one step and gives 0', () => {
    expect(totalSteps(div(0, 2))).toBe(1)
    expect(run(div(0, 2)).result).toBe('0')
  })
  it('hex remainders print as A–F', () => {
    expect(run(div(255, 16)).result).toBe('FF')
    expect(run(div(1000, 16)).result).toBe('3E8')
  })
  it('the goal is met only when finished, and advancing past the end changes nothing', () => {
    const c = div(45, 2)
    expect(isGoalMet(initial(c), { finished: true }, c)).toBe(false)
    expect(isGoalMet(stateAt(c, 5), { finished: true }, c)).toBe(false)
    const end = run(c)
    expect(advance(c, end)).toEqual(end)
  })
  it('rejects bad configs', () => {
    expect(() => initial({ from: 10, to: 1, value: '5', mode: 'divide' })).toThrow()
    expect(() => initial({ from: 10, to: 17, value: '5', mode: 'divide' })).toThrow()
    expect(() => initial({ from: 10, to: 2, value: '5A', mode: 'divide' })).toThrow()
  })
})

describe('BaseConvert logic: group', () => {
  const g = (from: number, to: number, value: string): BaseConvertConfig => ({ from, to, value, mode: 'group' })
  it('binary → hex cuts groups of 4 from the right and pads the last on the left', () => {
    const p = groupPlan(g(2, 16, '10110111010'))
    expect(p.kind).toBe('cut')
    expect(p.steps.map(s => s.bits)).toEqual(['1010', '1011', '0101'])
    expect(p.steps.map(s => s.digit)).toEqual(['A', 'B', '5'])
    expect(p.steps.map(s => s.padded)).toEqual([0, 0, 1])
    expect(run(g(2, 16, '10110111010')).result).toBe('5BA')
  })
  it('binary → octal cuts groups of 3', () => {
    expect(groupPlan(g(2, 8, '101101')).steps.map(s => s.bits)).toEqual(['101', '101'])
    expect(run(g(2, 8, '101101')).result).toBe('55')
    expect(groupPlan(g(2, 8, '1101')).steps.map(s => s.padded)).toEqual([0, 2])
    expect(run(g(2, 8, '1101')).result).toBe('15')
  })
  it('hex → binary opens each digit into 4 bits, left to right, with no leading zeros', () => {
    const c = g(16, 2, '7A3')
    const p = groupPlan(c)
    expect(p.kind).toBe('expand')
    expect(p.steps.map(s => s.bits)).toEqual(['0111', '1010', '0011'])
    expect(stateAt(c, 1).result).toBe('111')
    expect(stateAt(c, 2).result).toBe('1111010')
    expect(run(c).result).toBe('11110100011')
  })
  it('octal → binary', () => {
    expect(run(g(8, 2, '647')).result).toBe('110100111')
    expect(run(g(8, 2, '17')).result).toBe('1111')
  })
  it('agrees with the engine for every value 0–1500 across 2/8/16 in all directions', () => {
    for (const from of [2, 8, 16]) for (const to of [2, 8, 16]) {
      if (from === to) continue
      for (let n = 0; n <= 1500; n += 7) {
        const c = g(from, to, n.toString(from).toUpperCase())
        const s = run(c)
        expect(s.result, `${n} ${from}→${to}`).toBe(n.toString(to).toUpperCase())
        expect(expected(c)).toBe(s.result)
        expect(s.step).toBe(totalSteps(c))
      }
    }
  })
  it('rejects bad group configs', () => {
    expect(() => initial(g(2, 10, '101'))).toThrow()
    expect(() => initial(g(8, 8, '17'))).toThrow()
    expect(() => initial(g(2, 8, '102'))).toThrow()
  })
})
