import { describe, it, expect } from 'vitest'
import { complementR, complementR1 as engineR1, fromBase, toBase } from '../../../src/logic/numbers'
import {
  addDigits, addOne, initial, isGoalMet, modelOf, nextPhase, phasesFor, prevPhase, valueOfDigits,
} from '../../../src/ui/lessons/widgets/complementLabLogic'
import type { ComplementLabConfig } from '../../../src/ui/lessons/widgets/complementLabLogic'

const str = (d: number[]) => d.map(x => x.toString(16).toUpperCase()).join('')
const comp = (base: number, digits: number, value: string): ComplementLabConfig => ({ base, digits, value, mode: 'complement' })
const sub = (base: number, digits: number, value: string, other: string): ComplementLabConfig => ({ base, digits, value, other, mode: 'subtract' })

describe('ComplementLab logic: complements', () => {
  it('agrees with the engine complements for every 4-digit number in bases 2, 3, 8, 10, 16 (sampled)', () => {
    for (const base of [2, 3, 8, 10, 16]) {
      const w = base === 2 ? 6 : 4
      const max = base ** w
      for (let n = 0; n < max; n += Math.max(1, Math.floor(max / 400))) {
        const v = toBase(n, base).padStart(w, '0')
        const m = modelOf(comp(base, w, v))
        expect(str(m.r1), `r-1 of ${v} base ${base}`).toBe(engineR1(v, base))
        expect(str(m.r.digits), `r of ${v} base ${base}`).toBe(complementR(v, base))
      }
    }
  })
  it('first principles: r1 = (r^w − 1) − N and r = r^w − N (mod r^w)', () => {
    for (const [base, w] of [[2, 5], [10, 3], [8, 3], [16, 2], [5, 3]]) {
      const top = base ** w
      for (let n = 0; n < top; n++) {
        const v = toBase(n, base).padStart(w, '0')
        const m = modelOf(comp(base, w, v))
        expect(valueOfDigits(m.r1, base)).toBe(top - 1 - n)
        expect(valueOfDigits(m.r.digits, base)).toBe((top - n) % top)
        expect(m.r.endCarry).toBe(n === 0) // the carry runs off the top only for 0
      }
    }
  })
  it('known examples', () => {
    expect(str(modelOf(comp(10, 5, '04180')).r1)).toBe('95819')
    expect(str(modelOf(comp(8, 4, '3650')).r1)).toBe('4127')
    expect(str(modelOf(comp(8, 4, '3650')).r.digits)).toBe('4130')
    expect(str(modelOf(comp(2, 4, '0110')).r.digits)).toBe('1010')
    expect(str(modelOf(comp(2, 7, '1000011')).r.digits)).toBe('0111101')
  })
  it('the carry ripples through the trailing (r−1) digits', () => {
    // r1 = 4127 + 1: the 7 becomes 0 and carries, 2 becomes 3 and stops
    const a = addOne([4, 1, 2, 7], 8)
    expect(a.digits).toEqual([4, 1, 3, 0])
    expect(a.carries).toEqual([false, false, false, true])
    expect(a.endCarry).toBe(false)
    expect(addOne([1, 1, 1], 2)).toEqual({ digits: [0, 0, 0], carries: [true, true, true], endCarry: true })
  })
})

describe('ComplementLab logic: subtraction', () => {
  it('addDigits matches decimal addition and reports the end carry', () => {
    expect(addDigits([9, 9], [0, 1], 10)).toEqual({ digits: [0, 0], carries: [true, true], endCarry: true })
    expect(addDigits([1, 2], [3, 4], 10)).toEqual({ digits: [4, 6], carries: [false, false], endCarry: false })
  })
  it('M − N for every pair in base 2 width 4: result and sign come out right', () => {
    for (let a = 0; a < 16; a++) for (let b = 0; b < 16; b++) {
      const m = modelOf(sub(2, 4, a.toString(2).padStart(4, '0'), b.toString(2).padStart(4, '0')))
      expect(m.result!.value, `${a}-${b}`).toBe(a - b)
      expect(m.result!.negative).toBe(a < b)
      expect(m.endCarry).toBe(a >= b) // end carry exactly when M ≥ N (including N = 0)
    }
  })
  it('M − N in bases 3, 8, 10, 16 (all pairs of a small width)', () => {
    for (const [base, w] of [[3, 3], [8, 2], [10, 2], [16, 2]]) {
      const top = base ** w
      for (let a = 0; a < top; a += 1) for (let b = 0; b < top; b += Math.max(1, Math.floor(top / 20))) {
        const m = modelOf(sub(base, w, toBase(a, base).padStart(w, '0'), toBase(b, base).padStart(w, '0')))
        expect(m.result!.value, `${a}-${b} base ${base}`).toBe(a - b)
      }
    }
  })
  it('worked example: 1010100 − 1000011 (7 bits) = 0010001 with an end carry', () => {
    const m = modelOf(sub(2, 7, '1010100', '1000011'))
    expect(str(m.r.digits)).toBe('0111101')
    expect(str(m.sum!.digits)).toBe('0010001')
    expect(m.endCarry).toBe(true)
    expect(m.result).toEqual({ negative: false, digits: [0, 0, 1, 0, 0, 0, 1], magnitude: 17, value: 17 })
    expect(fromBase('1010100', 2) - fromBase('1000011', 2)).toBe(17)
  })
  it('no end carry: the result is negative and its magnitude is the complement of the sum', () => {
    // 29 − 57 in base 10, 2 digits: 29 + 43 = 72, no carry, magnitude = 100 − 72 = 28
    const m = modelOf(sub(10, 2, '29', '57'))
    expect(str(m.sum!.digits)).toBe('72')
    expect(m.endCarry).toBe(false)
    expect(m.result).toEqual({ negative: true, digits: [2, 8], magnitude: 28, value: -28 })
  })
  it('subtracting zero keeps the end carry (the r complement of 0 is r^w)', () => {
    const m = modelOf(sub(10, 2, '35', '00'))
    expect(m.endCarry).toBe(true)
    expect(m.result!.value).toBe(35)
  })
  it('rejects a missing or wrong-width operand', () => {
    expect(() => modelOf({ base: 10, digits: 2, value: '35', mode: 'subtract' })).toThrow()
    expect(() => modelOf(sub(10, 2, '35', '100'))).toThrow()
    expect(() => modelOf(comp(2, 3, '102'))).toThrow()
    expect(() => modelOf(comp(2, 3, '10'))).toThrow()
  })
})

describe('ComplementLab logic: phases and goal', () => {
  it('complement mode has 3 phases, subtract mode 5', () => {
    expect(phasesFor(comp(10, 2, '35'))).toEqual(['value', 'r1', 'r'])
    expect(phasesFor(sub(10, 2, '35', '12'))).toEqual(['value', 'r1', 'r', 'sum', 'result'])
  })
  it('next and previous phases stop at the ends', () => {
    const c = comp(10, 2, '35')
    expect(nextPhase(c, 'value')).toBe('r1')
    expect(nextPhase(c, 'r')).toBeNull()
    expect(prevPhase(c, 'value')).toBeNull()
    expect(prevPhase(c, 'r')).toBe('r1')
    expect(nextPhase(sub(10, 2, '35', '12'), 'r')).toBe('sum')
  })
  it('the goal is met at or past the phase; a phase the mode never reaches is never met', () => {
    const c = comp(10, 2, '35')
    expect(initial(c)).toEqual({ phase: 'value' })
    expect(isGoalMet({ phase: 'value' }, { phase: 'r' }, c)).toBe(false)
    expect(isGoalMet({ phase: 'r1' }, { phase: 'r' }, c)).toBe(false)
    expect(isGoalMet({ phase: 'r' }, { phase: 'r' }, c)).toBe(true)
    expect(isGoalMet({ phase: 'r' }, { phase: 'result' }, c)).toBe(false)
    const s = sub(10, 2, '35', '12')
    expect(isGoalMet({ phase: 'result' }, { phase: 'result' }, s)).toBe(true)
    expect(isGoalMet({ phase: 'sum' }, { phase: 'result' }, s)).toBe(false)
  })
})
