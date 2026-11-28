import { describe, it, expect } from 'vitest'
import { envOf, mintermsOf, parseExpr, type ParsedExpr } from '../../src/logic/expr'

const ok = (t: string, vars: string[]): ParsedExpr => {
  const r = parseExpr(t, vars)
  if (!r.ok) throw new Error(`${t}: ${r.error}`)
  return r
}

describe('parseExpr', () => {
  it('reads SOP with juxtaposition, primes and multi-letter variables', () => {
    const e = ok("A'X + AB'", ['A', 'B', 'X'])
    expect(mintermsOf(e, ['A', 'B', 'X'])).toEqual([1, 3, 4, 5])
    expect(e.literals).toBe(4)
    const q = ok("Q1Q0' + X", ['Q1', 'Q0', 'X'])
    expect(mintermsOf(q, ['Q1', 'Q0', 'X'])).toEqual([1, 3, 4, 5, 7])
  })
  it('accepts ·, *, ⊕, ^, parentheses, prefix not and constants', () => {
    expect(mintermsOf(ok('A·B + A*X', ['A', 'B', 'X']), ['A', 'B', 'X'])).toEqual([5, 6, 7])
    expect(mintermsOf(ok('A ⊕ B', ['A', 'B']), ['A', 'B'])).toEqual([1, 2])
    expect(mintermsOf(ok('A^B', ['A', 'B']), ['A', 'B'])).toEqual([1, 2])
    expect(mintermsOf(ok("(A+B)'", ['A', 'B']), ['A', 'B'])).toEqual([0])
    expect(mintermsOf(ok('!A', ['A']), ['A'])).toEqual([0])
    expect(mintermsOf(ok('1', ['A']), ['A'])).toEqual([0, 1])
    expect(mintermsOf(ok('0', ['A']), ['A'])).toEqual([])
  })
  it('drops a leading "name =" and ignores case when unambiguous', () => {
    expect(mintermsOf(ok("DA = a'x", ['A', 'X']), ['A', 'X'])).toEqual([1])
  })
  it('reports errors with a position', () => {
    for (const t of ['', 'A +', 'A + Z', '(A', 'A)']) {
      const r = parseExpr(t, ['A', 'B'])
      expect(r.ok, t).toBe(false)
    }
  })
  it('envOf: vars[0] is the MSB', () => {
    expect(envOf(['A', 'B', 'X'], 5)).toEqual({ A: 1, B: 0, X: 1 })
  })
})
