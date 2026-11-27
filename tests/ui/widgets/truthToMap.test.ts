import { describe, it, expect } from 'vitest'
import {
  allRows, bitsOf, cellOf, finalState, groupInfo, initial, isGoalMet, mapHeaders, maxtermTerm, mintermTerm, neighbours,
  rowsExpression, toggle, valueAt, type TruthToMapConfig, type TruthToMapGoal,
} from '../../../src/ui/lessons/widgets/truthToMapLogic'
import { kmapLayout } from '../../../src/logic/kmap'

const maj: TruthToMapConfig = { nVars: 3, minterms: [3, 5, 6, 7] }
const four: TruthToMapConfig = { nVars: 4, minterms: [0] }

describe('truthToMap logic', () => {
  it('starts empty, or with a filled map when startPlaced (flow view only)', () => {
    expect(initial(maj)).toEqual({ placed: [], picked: [] })
    expect(initial({ ...maj, startPlaced: true }).placed).toEqual(allRows(maj))
    expect(initial({ ...maj, startPlaced: true, view: 'rows' }).placed).toEqual([])
  })

  it('all-placed needs every row, in any order', () => {
    const g = { kind: 'all-placed' } as const
    expect(isGoalMet(initial(maj), g, maj)).toBe(false)
    expect(isGoalMet({ placed: [0, 1, 2, 3, 4, 5, 6], picked: [] }, g, maj)).toBe(false)
    expect(isGoalMet({ placed: [7, 6, 5, 4, 3, 2, 1, 0], picked: [] }, g, maj)).toBe(true)
  })

  it('pick needs exactly the cells: no more, no fewer, order and duplicates ignored', () => {
    const g: TruthToMapGoal = { kind: 'pick', cells: [0, 1, 2, 4, 8] }
    expect(isGoalMet({ placed: [], picked: [] }, g, four)).toBe(false)
    expect(isGoalMet({ placed: [], picked: [0, 1, 2, 4] }, g, four)).toBe(false)
    expect(isGoalMet({ placed: [], picked: [0, 1, 2, 4, 8, 3] }, g, four)).toBe(false)
    expect(isGoalMet({ placed: [], picked: [8, 4, 2, 1, 0] }, g, four)).toBe(true)
    expect(isGoalMet({ placed: [], picked: [8, 4, 2, 1, 0, 0] }, g, four)).toBe(true)
  })

  it('a malformed state never meets a goal', () => {
    expect(isGoalMet(undefined as never, { kind: 'all-placed' }, maj)).toBe(false)
    expect(isGoalMet({} as never, { kind: 'pick', cells: [1] }, maj)).toBe(false)
  })

  it('finalState meets its goal', () => {
    const all: TruthToMapGoal = { kind: 'all-placed' }
    const pick: TruthToMapGoal = { kind: 'pick', cells: [3, 7] }
    expect(isGoalMet(finalState(maj, all), all, maj)).toBe(true)
    for (const c of [maj, { ...maj, view: 'rows' as const }]) expect(isGoalMet(finalState(c, pick), pick, c)).toBe(true)
  })

  it('valueAt reads 1, X and 0', () => {
    const c: TruthToMapConfig = { nVars: 3, minterms: [1], dontCares: [2] }
    expect([0, 1, 2].map(m => valueAt(c, m))).toEqual([0, 1, 'x'])
  })

  it('cellOf inverts the k-map layout (Gray order) for 2, 3 and 4 variables', () => {
    for (const n of [2, 3, 4] as const) {
      const L = kmapLayout(n)
      for (let m = 0; m < 1 << n; m++) { const [r, c] = cellOf(n, m); expect(L.mintermAt(r, c)).toBe(m) }
    }
    expect(cellOf(3, 2)).toEqual([0, 3]) // 010 sits in the last column: column order is 00 01 11 10
  })

  it('headers are in Gray order', () => {
    expect(mapHeaders(2)).toEqual({ rows: ['0', '1'], cols: ['0', '1'], rowVars: 'A', colVars: 'B' })
    expect(mapHeaders(3)).toEqual({ rows: ['0', '1'], cols: ['00', '01', '11', '10'], rowVars: 'A', colVars: 'BC' })
    expect(mapHeaders(4)).toEqual({ rows: ['00', '01', '11', '10'], cols: ['00', '01', '11', '10'], rowVars: 'AB', colVars: 'CD' })
  })

  it('neighbours differ in exactly one variable, and flag the cells across the edge', () => {
    const n0 = neighbours(4, 0)
    expect(n0.map(x => [x.m, x.varName, x.wraps])).toEqual([[1, 'D', false], [2, 'C', true], [4, 'B', false], [8, 'A', true]])
    // every neighbour pair is mutual and differs in one bit
    for (const n of [2, 3, 4] as const) for (let m = 0; m < 1 << n; m++) {
      const ns = neighbours(n, m)
      expect(ns).toHaveLength(n)
      for (const x of ns) {
        expect((m ^ x.m).toString(2).replace(/0/g, '')).toBe('1')
        expect(neighbours(n, x.m).some(y => y.m === m)).toBe(true)
      }
    }
    // an inner cell has no neighbour across an edge; 3-variable maps wrap along the columns only
    expect(neighbours(4, 5).some(x => x.wraps)).toBe(false)
    expect(neighbours(3, 0).filter(x => x.wraps).map(x => x.m)).toEqual([2])
    expect(neighbours(2, 0).some(x => x.wraps)).toBe(false)
  })

  it('minterms use plain letters for 1, maxterms the opposite', () => {
    expect(mintermTerm(3, 3)).toBe("A'BC")
    expect(mintermTerm(3, 5)).toBe("AB'C")
    expect(maxtermTerm(3, 3)).toBe("(A + B' + C')")
    expect(maxtermTerm(3, 0)).toBe('(A + B + C)')
    expect(bitsOf(4, 5)).toBe('0101')
  })

  it('rowsExpression joins the selected rows in row order', () => {
    expect(rowsExpression(3, [], 'sop')).toBe('F = …')
    expect(rowsExpression(3, [6, 3], 'sop')).toBe("F = A'BC + ABC'")
    expect(rowsExpression(3, [4, 0], 'pos')).toBe("F = (A + B + C)(A' + B + C)")
  })

  it('groupInfo accepts rectangles (edges included) and gives their term', () => {
    expect(groupInfo(3, [3, 7])).toEqual({ valid: true, term: 'BC' })
    expect(groupInfo(4, [0, 2, 8, 10])).toEqual({ valid: true, term: "B'D'" })
    expect(groupInfo(4, [5, 7, 13, 15])).toEqual({ valid: true, term: 'BD' })
    expect(groupInfo(4, [0, 1, 2]).valid).toBe(false)
    expect(groupInfo(4, [0, 3]).valid).toBe(false)
    expect(groupInfo(3, [0, 1, 3]).valid).toBe(false)
    expect(groupInfo(3, [0, 1, 2, 3, 4, 5, 6, 7])).toEqual({ valid: true, term: '1' })
  })

  it('toggle adds and removes', () => {
    expect(toggle([1, 2], 3)).toEqual([1, 2, 3])
    expect(toggle([1, 2], 1)).toEqual([2])
  })
})
