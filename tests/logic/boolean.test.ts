import { describe, it, expect } from 'vitest'
import { tableFromMinterms, matches } from '../../src/logic/boolean'

describe('boolean tables', () => {
  it('builds table with MSB-first inputs and don\'t cares', () => {
    const t = tableFromMinterms(['A', 'B'], [3], [0])
    expect(t.inputs).toEqual(['A', 'B'])
    expect(t.outputs).toEqual(['F'])
    expect(t.rows).toEqual([['x'], [0], [0], [1]].map(r => r as any))
  })
  it('matches ignores x rows in spec', () => {
    expect(matches(tableFromMinterms(['A', 'B'], [3], [0]), tableFromMinterms(['A', 'B'], [0, 3])).ok).toBe(true)
  })
  it('reports first mismatch', () => {
    const r = matches(tableFromMinterms(['A', 'B'], [3]), tableFromMinterms(['A', 'B'], [1, 3]))
    expect(r.ok).toBe(false)
    expect(r.firstMismatch?.row).toBe(1)
    expect(r.firstMismatch?.output).toBe('F')
  })
})
