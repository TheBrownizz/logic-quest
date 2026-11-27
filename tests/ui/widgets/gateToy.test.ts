import { describe, it, expect } from 'vitest'
import { evalGate, type GateKind } from '../../../src/logic/circuit'
import type { Bit } from '../../../src/logic/boolean'
import type { BoolExpr } from '../../../src/ui/lessons/widgets/types'
import {
  assignmentOf, columnOf, flip, initial, isGoalMet, opened, outputOf, pickRow, rowCount, rowOf, withRow,
  type GateToyConfig,
} from '../../../src/ui/lessons/widgets/gateToyLogic'
import { columnOfDisplay } from './boolExprParser'

const and2: BoolExpr = { display: 'A·B', fn: v => (v.A && v.B ? 1 : 0) }
const cfg: GateToyConfig = { vars: ['A', 'B'], expr: and2, gate: 'AND' }
const cfg3: GateToyConfig = { vars: ['A', 'B', 'C'], expr: { display: "(A+B)·C'", fn: v => ((v.A || v.B) && !v.C ? 1 : 0) } }

describe('gateToyLogic rows', () => {
  it('rowCount is 2^n', () => expect([1, 2, 3].map(rowCount)).toEqual([2, 4, 8]))
  it('vars[0] is the most significant bit and the maps are inverse', () => {
    expect(rowOf(['A', 'B', 'C'], { A: 1, B: 0, C: 0 })).toBe(4)
    expect(rowOf(['A', 'B', 'C'], { A: 0, B: 0, C: 1 })).toBe(1)
    expect(assignmentOf(['A', 'B', 'C'], 6)).toEqual({ A: 1, B: 1, C: 0 })
    for (let r = 0; r < 8; r++) expect(rowOf(['A', 'B', 'C'], assignmentOf(['A', 'B', 'C'], r))).toBe(r)
  })
  it('columnOf lists the output of every row', () => {
    expect(columnOf(cfg.vars, and2)).toEqual([0, 0, 0, 1])
    expect(columnOf(cfg3.vars, cfg3.expr)).toEqual([0, 0, 1, 0, 1, 0, 1, 0])
  })
  it('withRow keeps the list sorted without repeats', () => {
    expect(withRow([0, 3], 1)).toEqual([0, 1, 3])
    const same = [0, 3]
    expect(withRow(same, 3)).toBe(same)
  })
})

describe('gateToyLogic state', () => {
  it('initial (pinned) has nothing tried; opened shows row 0, so it counts as tried', () => {
    expect(initial(cfg)).toEqual({ inputs: { A: 0, B: 0 }, tried: [] })
    expect(opened(cfg)).toEqual({ inputs: { A: 0, B: 0 }, tried: [0] })
    expect(opened(cfg3).inputs).toEqual({ A: 0, B: 0, C: 0 })
  })
  it('flipping a switch moves to a row and marks it tried', () => {
    const s1 = flip(cfg, opened(cfg), 'B')
    expect(s1).toEqual({ inputs: { A: 0, B: 1 }, tried: [0, 1] })
    const s2 = flip(cfg, s1, 'A')
    expect(s2).toEqual({ inputs: { A: 1, B: 1 }, tried: [0, 1, 3] })
    expect(outputOf(cfg, s2)).toBe(1)
    expect(flip(cfg, s2, 'A').tried).toEqual([0, 1, 3]) // back to row 1: nothing new
  })
  it('pickRow sets the switches to the row', () => {
    const s = pickRow(cfg3, opened(cfg3), 5)
    expect(s.inputs).toEqual({ A: 1, B: 0, C: 1 })
    expect(s.tried).toEqual([0, 5])
  })
})

describe('gateToyLogic isGoalMet', () => {
  it('all-rows needs every row, in any order', () => {
    let s = opened(cfg)
    expect(isGoalMet(s, { kind: 'all-rows' }, cfg)).toBe(false)
    for (const r of [3, 1, 2]) s = pickRow(cfg, s, r)
    expect(s.tried).toEqual([0, 1, 2, 3])
    expect(isGoalMet(s, { kind: 'all-rows' }, cfg)).toBe(true)
    expect(isGoalMet(pickRow(cfg, opened(cfg), 3), { kind: 'all-rows' }, cfg)).toBe(false)
  })
  it('all-rows works for one and three variables', () => {
    const not: GateToyConfig = { vars: ['A'], expr: { display: "A'", fn: v => (v.A ? 0 : 1) }, gate: 'NOT' }
    expect(isGoalMet(opened(not), { kind: 'all-rows' }, not)).toBe(false)
    expect(isGoalMet(flip(not, opened(not), 'A'), { kind: 'all-rows' }, not)).toBe(true)
    let s = opened(cfg3)
    for (let r = 0; r < 7; r++) s = pickRow(cfg3, s, r)
    expect(isGoalMet(s, { kind: 'all-rows' }, cfg3)).toBe(false)
    expect(isGoalMet(pickRow(cfg3, s, 7), { kind: 'all-rows' }, cfg3)).toBe(true)
  })
  it('output goals look at the lamp now, not at history', () => {
    const on = pickRow(cfg, opened(cfg), 3)
    expect(isGoalMet(on, { kind: 'output', value: 1 }, cfg)).toBe(true)
    expect(isGoalMet(on, { kind: 'output', value: 0 }, cfg)).toBe(false)
    expect(isGoalMet(opened(cfg), { kind: 'output', value: 1 }, cfg)).toBe(false)
    expect(isGoalMet(pickRow(cfg, on, 1), { kind: 'output', value: 1 }, cfg)).toBe(false) // switched away again
  })
})

describe('gate expressions agree with the circuit model', () => {
  const kinds: GateKind[] = ['AND', 'OR', 'NAND', 'NOR', 'XOR', 'XNOR']
  const display: Record<string, string> = { AND: 'A·B', OR: 'A+B', NAND: "(A·B)'", NOR: "(A+B)'", XOR: 'A⊕B', XNOR: "(A⊕B)'" }
  for (const k of kinds) {
    it(`${k}: the display string and evalGate give the same column`, () => {
      const want = Array.from({ length: 4 }, (_, r) => evalGate(k, [(r >> 1) as Bit, (r & 1) as Bit]))
      expect(columnOfDisplay(display[k], ['A', 'B'])).toEqual(want)
    })
  }
})
