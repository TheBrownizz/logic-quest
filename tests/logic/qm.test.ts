import { describe, it, expect } from 'vitest'
import { minimizeSOP, primeImplicants, formatSOP, literalCount } from '../../src/logic/qm'

describe('qm', () => {
  it('minimal cover of Σm(0,1,2,5,6,7)', () => {
    const t = minimizeSOP(3, [0, 1, 2, 5, 6, 7])
    expect(t.length).toBe(3)
    expect(literalCount(t)).toBe(6)
  })
  it('don\'t cares help', () => {
    const t = minimizeSOP(4, [1, 3, 7, 11, 15], [0, 2, 5])
    expect(formatSOP(t, ['A', 'B', 'C', 'D']).split('+').length).toBe(2)
  })
  it('PIs not only don\'t-cares', () => {
    expect(primeImplicants(2, [3], [0]).some(t => t.mask === 3 && t.value === 0)).toBe(false)
  })
  it('edge cases', () => {
    expect(minimizeSOP(3, [])).toEqual([])
    expect(minimizeSOP(2, [0, 1, 2, 3])).toEqual([{ mask: 0, value: 0 }])
    expect(minimizeSOP(2, [0, 1], [2, 3])).toEqual([{ mask: 0, value: 0 }])
  })
  it('formats', () => {
    expect(formatSOP([], ['A'])).toBe('0')
    expect(formatSOP([{ mask: 0, value: 0 }], ['A'])).toBe('1')
    expect(formatSOP([{ mask: 3, value: 2 }, { mask: 1, value: 1 }], ['A', 'B'])).toBe("AB' + B")
  })
  it('result covers exactly minterms (random 4-var)', () => {
    for (let s = 1; s < 200; s++) {
      const ms: number[] = [], ds: number[] = []
      for (let i = 0; i < 16; i++) { const r = (s * 2654435761 + i * 40503) >>> 7; const k = r % 3; if (k === 0) ms.push(i); else if (k === 1 && r % 5 === 0) ds.push(i) }
      const t = minimizeSOP(4, ms, ds)
      for (let i = 0; i < 16; i++) {
        const on = t.some(x => (i & x.mask) === x.value)
        if (ms.includes(i)) expect(on).toBe(true)
        else if (!ds.includes(i)) expect(on).toBe(false)
      }
    }
  })
})
