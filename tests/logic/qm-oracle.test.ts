import { describe, it, expect } from 'vitest'
import { minimizeSOP, literalCount, type Term } from '../../src/logic/qm'

describe('minimizeSOP vs brute-force oracle (3 variables)', () => {
  // all 27 cubes over 3 vars
  const cubes: Array<{ term: Term; cells: number }> = []
  for (let mask = 0; mask < 8; mask++) {
    for (let value = 0; value < 8; value++) {
      if ((value & mask) !== value) continue
      let cells = 0
      for (let m = 0; m < 8; m++) if ((m & mask) === value) cells |= 1 << m
      cubes.push({ term: { mask, value }, cells })
    }
  }
  const pop = (x: number) => { let c = 0; while (x) { c += x & 1; x >>= 1 } return c }

  it('matches for all 256 functions', () => {
    expect(cubes.length).toBe(27)
    for (let f = 0; f < 256; f++) {
      const minterms: number[] = []
      for (let m = 0; m < 8; m++) if (f & (1 << m)) minterms.push(m)
      // exhaustive oracle: DP over every reachable union of implicants (all subsets, collapsed by union)
      const imps = cubes.filter(c => (c.cells & ~f) === 0)
      const INF = Infinity
      const dp = new Array<number>(256).fill(INF) // cost = terms*100 + literals
      dp[0] = 0
      for (let u = 0; u < 256; u++) {
        if (dp[u] === INF) continue
        for (const c of imps) {
          const v = u | c.cells
          const cost = dp[u] + 100 + pop(c.term.mask)
          if (cost < dp[v]) dp[v] = cost
        }
      }
      const best = [Math.floor(dp[f] / 100), dp[f] % 100]
      const got = minimizeSOP(3, minterms)
      expect([got.length, literalCount(got)], `f=${f}`).toEqual(best)
    }
  })
})
