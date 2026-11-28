import { describe, it, expect } from 'vitest'
import * as latch from '../../../src/ui/lessons/widgets/latchToyLogic'
import * as scope from '../../../src/ui/lessons/widgets/clockScopeLogic'
import * as walker from '../../../src/ui/lessons/widgets/stateWalkerLogic'
import { widgetConfigProblems } from '../../../src/content/lessons/validate'
import { widgetStep } from '../../../src/content/lessons/widgetTypes'
import type { MachineSpec } from '../../../src/content/types'
import type { Bit } from '../../../src/logic/boolean'

describe('LatchToy logic (pinned types)', () => {
  it('SR-NOR: set, hold, reset, forbidden', () => {
    const c: latch.LatchToyConfig = { kind: 'SR-NOR' }
    let s = latch.initial(c)
    expect(s.inputs).toEqual({ S: 0, R: 0 })
    s = latch.setInput(s, c, 'S', 1)
    expect([s.q, s.qn]).toEqual([1, 0])
    s = latch.setInput(s, c, 'S', 0)
    expect(latch.isGoalMet(s, { kind: 'hold', value: 1 }, c)).toBe(true)
    s = latch.setInput(s, c, 'R', 1)
    expect(s.q).toBe(0)
    s = latch.setInput(s, c, 'S', 1)
    expect([s.q, s.qn]).toEqual([0, 0])
    expect(latch.isGoalMet(s, { kind: 'forbidden' }, c)).toBe(true)
  })
  it('SR-NAND inputs are active low; the D latch follows D only while E = 1', () => {
    const n: latch.LatchToyConfig = { kind: 'SR-NAND' }
    expect(latch.setInput(latch.initial(n), n, 'S', 0).q).toBe(1)
    const d: latch.LatchToyConfig = { kind: 'D' }
    let s = latch.setInput(latch.initial(d), d, 'D', 1)
    expect(s.q).toBe(0)
    s = latch.setInput(s, d, 'E', 1)
    expect(s.q).toBe(1)
    s = latch.setInput(latch.setInput(s, d, 'E', 0), d, 'D', 0)
    expect(latch.isGoalMet(s, { kind: 'hold', value: 1 }, d)).toBe(true)
  })
  it('JK with J = K = 1 toggles once per entry into 11 (Review Focus 1)', () => {
    const c: latch.LatchToyConfig = { kind: 'JK' }
    let s = latch.setInput(latch.initial(c), c, 'E', 1)
    s = latch.setInput(s, c, 'J', 1)
    expect(s.q).toBe(1) // J = 1, K = 0 sets
    s = latch.setInput(s, c, 'K', 1)
    expect(s.q).toBe(0) // 11 toggles
    s = latch.setInput(s, c, 'K', 0)
    expect(s.q).toBe(1) // 10 sets again
    s = latch.setInput(s, c, 'K', 1)
    expect(s.q).toBe(0)
    expect(latch.isGoalMet(s, { kind: 'toggle', count: 2 }, c)).toBe(true)
  })
})

const clk: Bit[] = [0, 1, 1, 0, 0, 1, 1, 0]
const sc: scope.ClockScopeConfig = { kind: 'latch-D', clk, inputs: { D: [0, 0, 1, 1, 1, 1, 0, 0] }, q0: 0, showQ: false, compare: 'ff-D' }

describe('ClockScope logic', () => {
  it('level vs edge differ on the same inputs; predict goals check the guess', () => {
    expect(scope.qOf(sc)).toEqual([0, 0, 1, 1, 1, 1, 0, 0])
    expect(scope.qOf(sc, 'ff-D')).toEqual([0, 0, 0, 0, 0, 1, 1, 1])
    let s = scope.initial(sc)
    expect(scope.isGoalMet(s, { kind: 'scan' }, sc)).toBe(false)
    s = scope.moveCursor(s, sc, 99)
    expect(scope.isGoalMet(s, { kind: 'scan' }, sc)).toBe(true)
    s = scope.setGuess(scope.setGuess(s, 2, 1), 6, 0)
    expect(scope.isGoalMet(s, { kind: 'predict-at', cols: [2, 6] }, sc)).toBe(true)
    expect(scope.isGoalMet(s, { kind: 'predict' }, sc)).toBe(false)
  })
  it('the lesson validator rejects a trace that fails validateWaveConfig', () => {
    expect(widgetConfigProblems('ClockScope', sc)).toEqual([])
    const race = { ...sc, inputs: { D: [0, 1, 1, 1, 1, 1, 1, 1] as Bit[] } }
    expect(widgetConfigProblems('ClockScope', race).join()).toMatch(/changes/)
    const sr = { ...sc, kind: 'latch-SR' as const, compare: undefined, inputs: { S: [0, 1, 1, 1, 0, 0, 0, 0] as Bit[], R: [0, 1, 1, 1, 0, 0, 0, 0] as Bit[] } }
    expect(widgetConfigProblems('ClockScope', sr).join()).toMatch(/forbidden/)
  })
})

const detector: MachineSpec = { from: 'rows', stateVars: ['A'], inputs: ['X'], outputs: ['Z'], next: [[0, 1], [0, 1]], out: [[0, 0], [0, 1]] }
const mooreM: MachineSpec = { from: 'rows', stateVars: ['A'], inputs: ['X'], outputs: ['Z'], next: [[0, 1], [0, 1]], out: [[0, 0], [1, 1]] }

describe('StateWalker logic', () => {
  it('Mealy: outputs on arrows; reach and output-sequence goals', () => {
    const c: walker.StateWalkerConfig = { table: detector, kind: 'mealy' }
    let s = walker.initial(c)
    s = walker.step(walker.step(s, c, 1), c, 1)
    expect(s.state).toBe(1)
    expect(s.history.map(h => h.out)).toEqual([0, 1])
    expect(walker.isGoalMet(s, { kind: 'reach', state: 1 }, c)).toBe(true)
    expect(walker.isGoalMet(s, { kind: 'outputs', seq: [0, 1] }, c)).toBe(true)
  })
  it('Moore: the step output is the entered state\'s output; a Mealy machine cannot be a moore walker', () => {
    const c: walker.StateWalkerConfig = { table: mooreM, kind: 'moore' }
    const s = walker.step(walker.initial(c), c, 1)
    expect(s.history[0].out).toBe(1)
    expect(widgetConfigProblems('StateWalker', c)).toEqual([])
    expect(widgetConfigProblems('StateWalker', { table: detector, kind: 'moore' }).join()).toMatch(/Mealy/)
  })
  it('widgetStep pins the types at compile time', () => {
    // @ts-expect-error LatchToy kinds are SR-NOR | SR-NAND | D | JK
    widgetStep({ id: 'a', prompt: 'p', widget: 'LatchToy', config: { kind: 'T' } })
    // @ts-expect-error ClockScope needs q0 and showQ
    widgetStep({ id: 'b', prompt: 'p', widget: 'ClockScope', config: { kind: 'ff-D', clk: [0, 1], inputs: { D: [0, 0] } } })
    // @ts-expect-error StateWalker goal 'reach' needs a state
    widgetStep({ id: 'c', prompt: 'p', widget: 'StateWalker', config: { table: detector, kind: 'mealy' }, goal: { kind: 'reach' } })
    expect(true).toBe(true)
  })
})
