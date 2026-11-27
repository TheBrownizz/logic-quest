import { describe, it, expect } from 'vitest'
import {
  BIAS, canToggle, decode, encodeValue, formatNumber, initial, isGoalMet, partOf, pointStrip, startBits, toHex, toggleBit, trimMantissa,
} from '../../../src/ui/lessons/widgets/bitFieldLogic'
import { decodeIEEE754, encodeIEEE754 } from '../../../src/logic/numbers'

const word = (s: string, e: string, m: string) => s + e + m.padEnd(23, '0')

describe('bitField: decode', () => {
  it('matches the host float parser on normal numbers (the formula, not the parser, computes the value)', () => {
    let seed = 12345
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
    for (let n = 0; n < 2000; n++) {
      const bits = Array.from({ length: 32 }, () => (rnd() < 0.5 ? '0' : '1')).join('')
      const d = decode(bits)
      const ref = decodeIEEE754(bits)
      if (d.kind === 'nan') expect(Number.isNaN(ref)).toBe(true)
      else expect(d.value, bits).toBe(ref)
    }
  })
  it('reads the three fields', () => {
    const d = decode(word('1', '10000001', '1001'))
    expect(d).toMatchObject({ sign: 1, exponent: 129, e: 2, kind: 'normal', value: -6.25 })
    expect(d.significand).toBe(1.5625)
  })
  it('bias is 127: E = 127 is e = 0', () => {
    expect(BIAS).toBe(127)
    expect(decode(word('0', '01111111', '')).value).toBe(1)
    expect(decode(word('0', '01111110', '')).value).toBe(0.5)
    expect(decode(word('0', '10000000', '')).value).toBe(2)
  })
  it('recognises zero, subnormal, infinity and NaN', () => {
    expect(decode('0'.repeat(32)).kind).toBe('zero')
    expect(decode('1' + '0'.repeat(31)).value).toBe(-0)
    expect(decode(word('0', '00000000', '1')).kind).toBe('subnormal')
    expect(decode(word('0', '11111111', '')).value).toBe(Infinity)
    expect(decode(word('1', '11111111', '')).value).toBe(-Infinity)
    expect(decode(word('0', '11111111', '1')).kind).toBe('nan')
  })
  it('rejects a word that is not 32 bits', () => {
    expect(() => decode('0101')).toThrow()
    expect(() => decode('2'.repeat(32))).toThrow()
  })
})

describe('bitField: encodeValue', () => {
  it('round-trips with the host encoder for exactly representable normal numbers', () => {
    for (const v of [1, -1, 0.5, 6.25, -6.25, 12.5, -6.75, 0.15625, 1.625, 1024, 3.5, 0.0078125, Math.fround(1e30), -3.4028234663852886e38]) {
      expect(encodeValue(v), String(v)).toBe(encodeIEEE754(v).bits)
      expect(decode(encodeValue(v)!).value).toBe(v)
    }
  })
  it('is null for zero, non-finite, inexact and subnormal values', () => {
    for (const v of [0, Infinity, NaN, 0.1, 1 / 3, 2 ** -127, 2 ** 130]) expect(encodeValue(v), String(v)).toBeNull()
  })
})

describe('bitField: toggle, lock and parts', () => {
  it('flips exactly one bit', () => {
    const b = '0'.repeat(32)
    expect(toggleBit(b, 0)).toBe('1' + '0'.repeat(31))
    expect(toggleBit(toggleBit(b, 17), 17)).toBe(b)
    expect(() => toggleBit(b, 32)).toThrow()
    expect(() => toggleBit(b, -1)).toThrow()
  })
  it('splits the word 1 | 8 | 23', () => {
    expect([0, 1, 8, 9, 31].map(partOf)).toEqual(['sign', 'exponent', 'exponent', 'mantissa', 'mantissa'])
    expect(Array.from({ length: 32 }, (_, i) => partOf(i)).filter(p => p === 'exponent')).toHaveLength(8)
  })
  it('locked fields cannot be toggled', () => {
    const c = { locked: ['sign', 'mantissa'] as const }
    expect(canToggle({ locked: [...c.locked] }, 0)).toBe(false)
    expect(canToggle({ locked: [...c.locked] }, 5)).toBe(true)
    expect(canToggle({ locked: [...c.locked] }, 20)).toBe(false)
    expect(canToggle({}, 20)).toBe(true)
  })
})

describe('bitField: initial and isGoalMet', () => {
  it('starts all zero by default, or at the given bits, and throws on a malformed word', () => {
    expect(initial({}).bits).toBe('0'.repeat(32))
    const one = encodeValue(1)!
    expect(initial({ bits: one }).bits).toBe(one)
    expect(() => startBits({ bits: '101' })).toThrow()
  })
  it('is met only by the exact normal number', () => {
    const g = { value: -6.25 }
    expect(isGoalMet({ bits: word('1', '10000001', '1001') }, g, {})).toBe(true)
    expect(isGoalMet({ bits: word('0', '10000001', '1001') }, g, {})).toBe(false)
    expect(isGoalMet({ bits: word('1', '10000010', '1001') }, g, {})).toBe(false)
    expect(isGoalMet({ bits: word('1', '10000001', '10011') }, g, {})).toBe(false)
  })
  it('is never met for a goal that is not an exact normal number', () => {
    for (const v of [0.1, 0, Infinity]) expect(isGoalMet({ bits: encodeIEEE754(Math.fround(v)).bits }, { value: v }, {})).toBe(false)
  })
  it('a non-normal word never meets a goal', () => {
    expect(isGoalMet({ bits: '0'.repeat(32) }, { value: 1 }, {})).toBe(false)
  })
})

describe('bitField: display helpers', () => {
  it('hex of the word', () => {
    expect(toHex(encodeValue(-6.25)!)).toBe('C0C80000')
    expect(toHex(encodeValue(1)!)).toBe('3F800000')
    expect(toHex('0'.repeat(32))).toBe('00000000')
  })
  it('formatNumber is exact for short decimals and marks the rest', () => {
    expect(formatNumber(-6.25)).toEqual({ text: '−6.25', exact: true })
    expect(formatNumber(0.125)).toEqual({ text: '0.125', exact: true })
    expect(formatNumber(1.625)).toEqual({ text: '1.625', exact: true })
    const tenth = formatNumber(Math.fround(0.1))
    expect(tenth.exact).toBe(false)
    expect(tenth.text).toBe('0.100000001')
    expect(formatNumber(Infinity).text).toBe('∞')
    expect(formatNumber(NaN).text).toBe('NaN')
  })
  it('trimMantissa drops trailing zeros', () => {
    expect(trimMantissa('10010000000000000000000')).toBe('1001')
    expect(trimMantissa('0'.repeat(23))).toBe('')
  })
})

describe('bitField: the binary-point strip', () => {
  it('6.25: 1.1001 × 2² becomes 110.01', () => {
    const s = pointStrip(encodeValue(6.25)!)!
    expect(s.digits.join('')).toBe('11001')
    expect([s.from, s.to, s.hidden]).toEqual([1, 3, 0])
    expect(s.shifted).toBe('110.01')
  })
  it('pads zeros on the right when the point runs past the last digit (8 = 1 × 2³)', () => {
    const s = pointStrip(encodeValue(8)!)!
    expect(s.digits.join('')).toBe('1000')
    expect(s.shifted).toBe('1000')
  })
  it('moves left for a negative exponent (0.125 = 0.001)', () => {
    const s = pointStrip(encodeValue(0.125)!)!
    expect(s.shifted).toBe('0.001')
    expect(s.digits.join('')).toBe('0001')
    expect([s.from, s.to, s.hidden]).toEqual([4, 1, 3])
  })
  it('0.5 = 0.1 and 1 stays 1', () => {
    expect(pointStrip(encodeValue(0.5)!)!.shifted).toBe('0.1')
    const one = pointStrip(encodeValue(1)!)!
    expect(one.shifted).toBe('1')
    expect(one.from).toBe(one.to)
  })
  it('the shifted digits always read back as |value|', () => {
    for (const v of [6.25, 3.5, 0.375, 12.5, 100.75, 0.0625, 1.625, 45, 0.15625, 1000.5]) {
      const s = pointStrip(encodeValue(v)!)!
      const [int, frac = ''] = s.shifted.split('.')
      const got = parseInt(int, 2) + [...frac].reduce((a, b, i) => a + Number(b) / 2 ** (i + 1), 0)
      expect(got, String(v)).toBe(v)
    }
  })
  it('is null for non-normal words and very large exponents', () => {
    expect(pointStrip('0'.repeat(32))).toBeNull()
    expect(pointStrip(encodeValue(2 ** 40)!)).toBeNull()
    expect(pointStrip(encodeValue(2 ** -40)!)).toBeNull()
  })
})
