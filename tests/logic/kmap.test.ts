import { describe, it, expect } from 'vitest'
import { kmapLayout, groupToTerm, checkCover } from '../../src/logic/kmap'

describe('kmapLayout', () => {
  it('uses Gray order', () => {
    const L = kmapLayout(4)
    expect([0, 1, 2, 3].map(c => L.mintermAt(0, c))).toEqual([0, 1, 3, 2])
    expect([0, 1, 2, 3].map(r => L.mintermAt(r, 0))).toEqual([0, 4, 12, 8])
    expect([L.rows, L.cols]).toEqual([4, 4])
  })
  it('handles 2 and 3 variables', () => {
    const L2 = kmapLayout(2)
    expect([L2.rows, L2.cols]).toEqual([2, 2])
    expect([L2.mintermAt(0, 0), L2.mintermAt(0, 1), L2.mintermAt(1, 0), L2.mintermAt(1, 1)]).toEqual([0, 1, 2, 3])
    const L3 = kmapLayout(3)
    expect([L3.rows, L3.cols]).toEqual([2, 4])
    expect([0, 1, 2, 3].map(c => L3.mintermAt(1, c))).toEqual([4, 5, 7, 6])
  })
  it('covers every minterm exactly once', () => {
    for (const n of [2, 3, 4] as const) {
      const L = kmapLayout(n)
      const s = new Set<number>()
      for (let r = 0; r < L.rows; r++) for (let c = 0; c < L.cols; c++) s.add(L.mintermAt(r, c))
      expect(s.size).toBe(1 << n)
    }
  })
})

describe('groupToTerm', () => {
  it('four corners = B\'D\'', () => {
    expect(groupToTerm(4, { cells: [[0, 0], [0, 3], [3, 0], [3, 3]] })).toEqual({ mask: 0b0101, value: 0 })
  })
  it('rejects non power-of-two', () => {
    expect(groupToTerm(4, { cells: [[0, 0], [0, 1], [0, 3]] })).toBeNull()
  })
  it('rejects non-cubes, duplicates, empty, out of range', () => {
    expect(groupToTerm(4, { cells: [[0, 0], [1, 1]] })).toBeNull()
    expect(groupToTerm(4, { cells: [[0, 0], [0, 0]] })).toBeNull()
    expect(groupToTerm(4, { cells: [] })).toBeNull()
    expect(groupToTerm(4, { cells: [[0, 0], [0, 4]] })).toBeNull()
  })
  it('single cell and full map', () => {
    expect(groupToTerm(3, { cells: [[1, 2]] })).toEqual({ mask: 7, value: 7 })
    const cells: Array<[number, number]> = []
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) cells.push([r, c])
    expect(groupToTerm(3, { cells })).toEqual({ mask: 0, value: 0 })
  })
  it('wrap-around pair', () => {
    expect(groupToTerm(3, { cells: [[0, 0], [0, 3]] })).toEqual({ mask: 0b101, value: 0 })
  })
})

describe('checkCover', () => {
  const g = (...cells: Array<[number, number]>) => ({ cells })
  it('minimal cover', () => {
    const r = checkCover(3, [0, 1, 2, 5, 6, 7], [], [g([0, 0], [0, 1]), g([0, 3], [1, 3]), g([1, 1], [1, 2])])
    expect(r).toMatchObject({ valid: true, covered: true, coversZero: false, isMinimal: true })
    expect(r.expression).toBe("A'B' + BC' + AC")
  })
  it('non-minimal cover (single cells)', () => {
    const r = checkCover(2, [0, 1], [], [g([0, 0]), g([0, 1])])
    expect(r).toMatchObject({ valid: true, covered: true, isMinimal: false })
  })
  it('detects zero cells', () => {
    const r = checkCover(2, [0], [], [g([0, 0], [0, 1])])
    expect(r.coversZero).toBe(true)
    expect(r.isMinimal).toBe(false)
  })
  it("don't-care cells are fine", () => {
    const r = checkCover(2, [0], [1], [g([0, 0], [0, 1])])
    expect(r).toMatchObject({ valid: true, covered: true, coversZero: false, isMinimal: true, expression: "A'" })
  })
  it('uncovered minterm', () => {
    const r = checkCover(2, [0, 3], [], [g([0, 0])])
    expect(r.covered).toBe(false)
    expect(r.isMinimal).toBe(false)
  })
  it('invalid group', () => {
    const r = checkCover(2, [0, 1, 2], [], [g([0, 0], [1, 1]), g([0, 1])])
    expect(r.valid).toBe(false)
    expect(r.isMinimal).toBe(false)
    expect(r.expression).toBe("A'B")
  })
  it('no groups', () => {
    expect(checkCover(2, [], [], []).expression).toBe('0')
  })
})
