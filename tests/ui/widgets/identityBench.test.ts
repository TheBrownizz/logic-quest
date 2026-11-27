import { describe, it, expect } from 'vitest'
import type { BoolExpr } from '../../../src/ui/lessons/widgets/types'
import {
  columns, differingRows, equivalent, flip, initial, isGoalMet, opened, pickRow, rowValues, triedDifferences,
  type IdentityBenchConfig,
} from '../../../src/ui/lessons/widgets/identityBenchLogic'

const E = (display: string, fn: BoolExpr['fn']): BoolExpr => ({ display, fn })
// De Morgan, right and wrong
const right: IdentityBenchConfig = {
  vars: ['A', 'B'],
  left: E("(A+B)'", v => (v.A || v.B ? 0 : 1)),
  right: E("A'·B'", v => (!v.A && !v.B ? 1 : 0)),
}
const wrong: IdentityBenchConfig = { vars: ['A', 'B'], left: right.left, right: E("A'+B'", v => (!v.A || !v.B ? 1 : 0)) }

describe('identityBenchLogic', () => {
  it('rowValues, columns and differingRows', () => {
    expect(rowValues(wrong, 0)).toEqual([1, 1])
    expect(rowValues(wrong, 1)).toEqual([0, 1])
    expect(columns(right)).toEqual([[1, 0, 0, 0], [1, 0, 0, 0]])
    expect(columns(wrong)).toEqual([[1, 0, 0, 0], [1, 1, 1, 0]])
    expect(differingRows(wrong)).toEqual([1, 2])
    expect(differingRows(right)).toEqual([])
  })
  it('equivalent is equality on every row', () => {
    expect(equivalent(right)).toBe(true)
    expect(equivalent(wrong)).toBe(false)
  })
  it('initial (pinned) has nothing tried; opened shows row 0 as tried', () => {
    expect(initial(wrong)).toEqual({ inputs: { A: 0, B: 0 }, tried: [] })
    expect(opened(wrong)).toEqual({ inputs: { A: 0, B: 0 }, tried: [0] })
  })
  it('flip and pickRow track tried rows', () => {
    const s = flip(wrong, opened(wrong), 'B')
    expect(s).toEqual({ inputs: { A: 0, B: 1 }, tried: [0, 1] })
    expect(pickRow(wrong, s, 3).tried).toEqual([0, 1, 3])
    expect(pickRow(wrong, s, 3).inputs).toEqual({ A: 1, B: 1 })
  })
  it('all-rows needs every row', () => {
    let s = opened(right)
    expect(isGoalMet(s, { kind: 'all-rows' }, right)).toBe(false)
    for (const r of [1, 2]) s = pickRow(right, s, r)
    expect(isGoalMet(s, { kind: 'all-rows' }, right)).toBe(false)
    expect(isGoalMet(pickRow(right, s, 3), { kind: 'all-rows' }, right)).toBe(true)
  })
  it('find-difference needs a tried row where they differ', () => {
    const s0 = opened(wrong)
    expect(isGoalMet(s0, { kind: 'find-difference' }, wrong)).toBe(false)
    expect(isGoalMet(pickRow(wrong, s0, 3), { kind: 'find-difference' }, wrong)).toBe(false) // row 3: 0 and 0
    const s1 = pickRow(wrong, s0, 1)
    expect(triedDifferences(wrong, s1)).toEqual([1])
    expect(isGoalMet(s1, { kind: 'find-difference' }, wrong)).toBe(true)
    // moving on keeps the find
    expect(isGoalMet(pickRow(wrong, s1, 0), { kind: 'find-difference' }, wrong)).toBe(true)
  })
  it('find-difference can never be met for equivalent expressions', () => {
    let s = opened(right)
    for (let r = 0; r < 4; r++) s = pickRow(right, s, r)
    expect(isGoalMet(s, { kind: 'find-difference' }, right)).toBe(false)
  })
})
