import { describe, expect, it } from 'vitest'
import {
  toBase, fromBase, findBases, digitsValue, isValidIn,
  complementR, complementR1, encodeIEEE754, decodeIEEE754,
} from '../../src/logic/numbers'

describe('numbers', () => {
  it('converts bases', () => {
    expect(toBase(81, 2)).toBe('1010001')
    expect(fromBase('1010001', 2)).toBe(81)
    expect(toBase(255, 16)).toBe('FF')
    expect(fromBase('ff', 16)).toBe(255)
    expect(toBase(0, 2)).toBe('0')
    expect(() => fromBase('9', 8)).toThrow()
  })
  it('finds bases', () => {
    expect(findBases(r => digitsValue('4', r) ** 2, r => digitsValue('100', r)).filter(r => isValidIn('4', r))).toEqual([])
    expect(findBases(r => 2 * digitsValue('4', r), r => digitsValue('10', r)).filter(r => isValidIn('4', r))).toEqual([8])
  })
  it('complements', () => {
    expect(complementR1('0110', 2)).toBe('1001')
    expect(complementR('0110', 2)).toBe('1010')
    expect(complementR('0250', 10)).toBe('9750')
    expect(complementR1('0250', 10)).toBe('9749')
  })
  it('IEEE754', () => {
    expect(encodeIEEE754(0.5).bits).toBe('00111111000000000000000000000000')
    expect(encodeIEEE754(-6.25).exponent).toBe(129)
    expect(encodeIEEE754(-6.25).sign).toBe(1)
    expect(decodeIEEE754(encodeIEEE754(0.3).bits)).toBeCloseTo(0.3, 6)
  })
})
