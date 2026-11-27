import { describe, it, expect } from 'vitest'
import { checkConfig, digitsForValue, initial, isGoalMet, isNegative, placeWeights, stepDigit, valueOf, valueRange, unsignedValue } from '../../../src/ui/lessons/widgets/baseDialLogic'
import type { BaseDialConfig } from '../../../src/ui/lessons/widgets/baseDialLogic'

const bin6: BaseDialConfig = { base: 2, width: 6 }

describe('BaseDial logic', () => {
  it('starts at all zeros, or at the given digits', () => {
    expect(initial(bin6).digits).toEqual([0, 0, 0, 0, 0, 0])
    expect(initial({ base: 16, width: 3, digits: '1AF' }).digits).toEqual([1, 10, 15])
  })
  it('rejects a bad config (so a typo in a lesson is caught by the validator)', () => {
    expect(() => initial({ base: 1, width: 3 })).toThrow()
    expect(() => initial({ base: 17, width: 3 })).toThrow()
    expect(() => initial({ base: 2, width: 13 })).toThrow()
    expect(() => initial({ base: 2 } as BaseDialConfig)).toThrow()
    expect(initial({} as BaseDialConfig).digits).toEqual([0, 0, 0, 0]) // a missing config falls back to the default dial
    expect(() => checkConfig({ base: 1, width: 3 })).toThrow()
    expect(() => checkConfig({ base: 17, width: 3 })).toThrow()
    expect(() => checkConfig({ base: 2, width: 0 })).toThrow()
    expect(() => checkConfig({ base: 2, width: 13 })).toThrow()
    expect(() => checkConfig({ base: 16, width: 12 })).not.toThrow()
    expect(() => initial({ base: 2, width: 3, digits: '10' })).toThrow()
    expect(() => initial({ base: 2, width: 3, digits: '102' })).toThrow()
  })
  it('place weights are r^(w-1) … 1', () => {
    expect(placeWeights({ base: 2, width: 4 })).toEqual([8, 4, 2, 1])
    expect(placeWeights({ base: 5, width: 3 })).toEqual([25, 5, 1])
    expect(placeWeights({ base: 16, width: 2 })).toEqual([16, 1])
  })
  it('the value is the sum of digit × weight', () => {
    expect(valueOf([1, 0, 1, 1], { base: 2, width: 4 })).toBe(11)
    expect(valueOf([4, 0, 3], { base: 5, width: 3 })).toBe(4 * 25 + 3)
    expect(valueOf([15, 15], { base: 16, width: 2 })).toBe(255)
    // against parseInt for every 6-bit pattern
    for (let n = 0; n < 64; n++) expect(unsignedValue([...n.toString(2).padStart(6, '0')].map(Number), 2)).toBe(n)
  })
  it('stepping wraps around the base and leaves the other digits alone', () => {
    expect(stepDigit([1, 0, 1], 1, 1, 2)).toEqual([1, 1, 1])
    expect(stepDigit([1, 1, 1], 1, 1, 2)).toEqual([1, 0, 1])
    expect(stepDigit([0, 0], 0, -1, 8)).toEqual([7, 0])
    expect(stepDigit([5, 15], 1, 1, 16)).toEqual([5, 0])
  })
  it('signed reading: two’s complement in base 2', () => {
    const c: BaseDialConfig = { base: 2, width: 4, signed: true }
    expect(valueOf([0, 1, 1, 1], c)).toBe(7)
    expect(valueOf([1, 0, 0, 0], c)).toBe(-8)
    expect(valueOf([1, 1, 1, 1], c)).toBe(-1)
    expect(valueOf([1, 0, 1, 1], c)).toBe(-5)
    expect(isNegative([1, 0, 0, 0], c)).toBe(true)
    expect(isNegative([0, 1, 1, 1], c)).toBe(false)
    expect(valueRange(c)).toEqual({ min: -8, max: 7 })
    expect(valueRange({ base: 2, width: 4 })).toEqual({ min: 0, max: 15 })
  })
  it('signed reading works in other bases (symmetric for odd r)', () => {
    expect(valueRange({ base: 10, width: 2, signed: true })).toEqual({ min: -50, max: 49 })
    expect(valueRange({ base: 3, width: 2, signed: true })).toEqual({ min: -4, max: 4 })
    expect(valueOf([9, 9], { base: 10, width: 2, signed: true })).toBe(-1)
    expect(valueOf([5, 0], { base: 10, width: 2, signed: true })).toBe(-50)
  })
  it('digitsForValue inverts valueOf over the whole range (signed and unsigned)', () => {
    for (const c of [{ base: 2, width: 5 }, { base: 2, width: 5, signed: true }, { base: 3, width: 3, signed: true }, { base: 16, width: 2 }] as BaseDialConfig[]) {
      const { min, max } = valueRange(c)
      for (let v = min; v <= max; v++) expect(valueOf(digitsForValue(v, c)!, c)).toBe(v)
      expect(digitsForValue(max + 1, c)).toBeNull()
      expect(digitsForValue(min - 1, c)).toBeNull()
    }
    expect(digitsForValue(1.5, bin6)).toBeNull()
  })
  it('isGoalMet: the value reaches the goal, in the signed reading too', () => {
    expect(isGoalMet({ digits: [1, 0, 1, 1, 0, 1] }, { value: 45 }, bin6)).toBe(true)
    expect(isGoalMet({ digits: [1, 0, 1, 1, 0, 0] }, { value: 45 }, bin6)).toBe(false)
    expect(isGoalMet(initial(bin6), { value: 45 }, bin6)).toBe(false)
    const s: BaseDialConfig = { base: 2, width: 4, signed: true }
    expect(isGoalMet({ digits: [1, 0, 1, 1] }, { value: -5 }, s)).toBe(true)
    expect(isGoalMet({ digits: [1, 0, 1, 1] }, { value: 11 }, s)).toBe(false)
    expect(isGoalMet({ digits: [1, 0] }, { value: 2 }, bin6)).toBe(false) // wrong width never meets a goal
  })
})
