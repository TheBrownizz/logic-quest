import { describe, it, expect } from 'vitest'
import { nextState, excitation, isForbidden, inputCount, type FFType } from '../../src/logic/sequential'
import type { Bit } from '../../src/logic/boolean'

const combos = (n: number): Bit[][] =>
  Array.from({ length: 1 << n }, (_, i) =>
    Array.from({ length: n }, (_, j) => ((i >> (n - 1 - j)) & 1) as Bit),
  )

describe('nextState: characteristic tables', () => {
  it('D: Q+ = D', () => {
    for (const q of [0, 1] as Bit[]) for (const d of [0, 1] as Bit[]) expect(nextState('D', q, [d])).toBe(d)
  })
  it('T: Q+ = Q xor T', () => {
    for (const q of [0, 1] as Bit[]) for (const t of [0, 1] as Bit[]) expect(nextState('T', q, [t])).toBe((q ^ t) as Bit)
  })
  it('JK: hold / reset / set / toggle (J=K=1 toggles)', () => {
    for (const q of [0, 1] as Bit[]) {
      expect(nextState('JK', q, [0, 0])).toBe(q)
      expect(nextState('JK', q, [0, 1])).toBe(0)
      expect(nextState('JK', q, [1, 0])).toBe(1)
      expect(nextState('JK', q, [1, 1])).toBe((1 - q) as Bit)
    }
  })
  it('SR: hold / reset / set', () => {
    for (const q of [0, 1] as Bit[]) {
      expect(nextState('SR', q, [0, 0])).toBe(q)
      expect(nextState('SR', q, [0, 1])).toBe(0)
      expect(nextState('SR', q, [1, 0])).toBe(1)
    }
  })
  it('SR: S=R=1 is forbidden and throws', () => {
    expect(isForbidden('SR', [1, 1])).toBe(true)
    expect(isForbidden('SR', [1, 0])).toBe(false)
    for (const t of ['D', 'T', 'JK'] as FFType[]) {
      for (const inp of combos(inputCount(t))) expect(isForbidden(t, inp)).toBe(false)
    }
    for (const q of [0, 1] as Bit[]) expect(() => nextState('SR', q, [1, 1])).toThrow()
  })
  it('rejects a wrong number of inputs', () => {
    expect(() => nextState('JK', 0, [1])).toThrow()
    expect(() => nextState('D', 0, [1, 0])).toThrow()
  })
})

describe('excitation: exhaustive consistency with nextState', () => {
  for (const t of ['D', 'T', 'JK', 'SR'] as FFType[]) {
    it(`${t}: a combination drives q to qNext exactly when it matches the pattern`, () => {
      const n = inputCount(t)
      for (const q of [0, 1] as Bit[]) {
        for (const qn of [0, 1] as Bit[]) {
          const pat = excitation(t, q, qn)
          expect(pat).toHaveLength(n)
          for (const inp of combos(n)) {
            const matches = pat.every((p, i) => p === 'x' || p === inp[i])
            if (isForbidden(t, inp)) {
              expect(matches).toBe(false)
            } else {
              expect(nextState(t, q, inp) === qn).toBe(matches)
            }
          }
        }
      }
    })
  }
  it('known textbook excitation tables', () => {
    expect(excitation('D', 0, 1)).toEqual([1])
    expect(excitation('T', 1, 1)).toEqual([0])
    expect(excitation('T', 0, 1)).toEqual([1])
    expect(excitation('JK', 0, 0)).toEqual([0, 'x'])
    expect(excitation('JK', 0, 1)).toEqual([1, 'x'])
    expect(excitation('JK', 1, 0)).toEqual(['x', 1])
    expect(excitation('JK', 1, 1)).toEqual(['x', 0])
    expect(excitation('SR', 0, 0)).toEqual([0, 'x'])
    expect(excitation('SR', 0, 1)).toEqual([1, 0])
    expect(excitation('SR', 1, 0)).toEqual([0, 1])
    expect(excitation('SR', 1, 1)).toEqual(['x', 0])
  })
})
