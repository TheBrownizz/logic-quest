import { describe, it, expect } from 'vitest'
import type { Bit } from '../../../src/logic/boolean'
import {
  cycleData, implementedMinterms, initial, isGoalMet, output, requiredData, selectIndex, selectNames, setSelect, setX, toggleInput, withData,
  type DataSrc, type MuxToyConfig, type MuxToyGoal, type MuxToyState,
} from '../../../src/ui/lessons/widgets/muxToyLogic'

const route: MuxToyConfig = { selectBits: 2, mode: 'route', inputs: [0, 1, 1, 0] }
const ext: MuxToyConfig = { selectBits: 2, mode: 'function', extra: 'C', selectNames: ['A', 'B'] }

describe('MuxToy routing', () => {
  it('select lines are read as a binary number, most significant first', () => {
    expect(selectIndex([1, 0])).toBe(2)
    expect(selectIndex([0, 1])).toBe(1)
    expect(selectIndex([1, 1, 1])).toBe(7)
    expect(selectIndex([0])).toBe(0)
  })
  it('the output is the selected data input', () => {
    let s = initial(route)
    expect(s).toEqual({ select: [0, 0], inputs: [0, 1, 1, 0] })
    expect(output(s)).toBe(0)
    s = setSelect(s, 1, 1)
    expect(output(s)).toBe(1) // D1
    s = setSelect(setSelect(s, 0, 1), 1, 0)
    expect(selectIndex(s.select)).toBe(2)
    expect(output(s)).toBe(1) // D2
    s = toggleInput(s, 2)
    expect(output(s)).toBe(0)
  })
  it('default select names are S(n-1)…S0', () => {
    expect(selectNames({ selectBits: 3, mode: 'route' })).toEqual(['S2', 'S1', 'S0'])
    expect(selectNames({ selectBits: 1, mode: 'route' })).toEqual(['S0'])
    expect(selectNames(ext)).toEqual(['A', 'B'])
  })
  it('route goal: select = input', () => {
    const g = { kind: 'route', input: 2 } as const
    expect(isGoalMet(initial(route), g, route)).toBe(false)
    expect(isGoalMet({ select: [1, 0], inputs: [0, 1, 1, 0] }, g, route)).toBe(true)
    expect(isGoalMet({ select: [0, 1], inputs: [0, 1, 1, 0] }, g, route)).toBe(false)
  })
})

describe('MuxToy implements F', () => {
  const fn: MuxToyConfig = { selectBits: 2, mode: 'function', selectNames: ['A', 'B'] }
  it('D_i = 1 exactly for i in the minterms', () => {
    const xor: MuxToyGoal = { kind: 'implements', minterms: [1, 2] }
    expect(isGoalMet(initial(fn), xor, fn)).toBe(false)
    expect(isGoalMet({ select: [0, 0], inputs: [0, 1, 1, 0] }, xor, fn)).toBe(true)
    expect(isGoalMet({ select: [0, 0], inputs: [0, 1, 1, 1] }, xor, fn)).toBe(false)
    expect(isGoalMet({ select: [0, 0], inputs: [0, 1, 0, 0] }, xor, fn)).toBe(false)
    expect(implementedMinterms({ select: [0, 0], inputs: [1, 0, 0, 1] }, fn)).toEqual([0, 3])
  })
  it('a 3-select ROM goal (odd parity)', () => {
    const rom: MuxToyConfig = { selectBits: 3, mode: 'function', skin: 'rom' }
    const g: MuxToyGoal = { kind: 'implements', minterms: [1, 2, 4, 7] }
    expect(isGoalMet(initial(rom), g, rom)).toBe(false)
    expect(isGoalMet({ select: [0, 0, 0], inputs: [0, 1, 1, 0, 1, 0, 0, 1] }, g, rom)).toBe(true)
    // odd parity: D_i = 1 exactly when i has an odd number of 1 bits
    const parity = Array.from({ length: 8 }, (_, i) => (i.toString(2).split('1').length - 1) % 2) as Bit[]
    expect(parity).toEqual([0, 1, 1, 0, 1, 0, 0, 1])
  })
  it('the wrong goal kind for the config never matches', () => {
    expect(isGoalMet(initial(fn), { kind: 'implements-x', minterms: [0] }, fn)).toBe(false)
    expect(isGoalMet(initial(ext), { kind: 'implements', minterms: [] }, ext)).toBe(false)
  })
})

describe('MuxToy with an extra variable: n select lines implement n+1 variables', () => {
  it('requiredData reads the pairs (F(i,0), F(i,1))', () => {
    // majority of A, B, C = Σm(3,5,6,7): D = [0, C, C, 1]
    expect(requiredData([3, 5, 6, 7], 2)).toEqual([0, 'x', 'x', 1])
    // F = Σm(1,3,4,6): D = [C, C, C', C']
    expect(requiredData([1, 3, 4, 6], 2)).toEqual(['x', 'x', 'nx', 'nx'])
    expect(requiredData([], 1)).toEqual([0, 0])
    expect(requiredData([0, 1, 2, 3], 1)).toEqual([1, 1])
  })
  it('the wiring really implements the function: brute force over all functions of 3 variables', () => {
    for (let mask = 0; mask < 256; mask++) {
      const minterms = Array.from({ length: 8 }, (_, i) => i).filter(i => (mask >> i) & 1)
      const data = requiredData(minterms, 2)
      let s: MuxToyState = withData(initial(ext), data, 0)
      expect(isGoalMet(s, { kind: 'implements-x', minterms }, ext)).toBe(true)
      // evaluate through the actual MUX: select = (A,B), X = C
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) {
        s = setX(setSelect(setSelect(s, 0, a as Bit), 1, b as Bit), c as Bit)
        expect(output(s), `mask ${mask} ${a}${b}${c}`).toBe(minterms.includes(a * 4 + b * 2 + c) ? 1 : 0)
      }
    }
  })
  it('data inputs cycle 0, 1, X, X\' and the state keeps inputs in step', () => {
    let s = initial(ext)
    expect(s).toEqual({ select: [0, 0], inputs: [0, 0, 0, 0], data: [0, 0, 0, 0], x: 0 })
    const seen: DataSrc[] = []
    for (let k = 0; k < 4; k++) { s = cycleData(s, 1); seen.push(s.data![1]) }
    expect(seen).toEqual([1, 'x', 'nx', 0])
    s = cycleData(cycleData(s, 2), 2) // D2 = X
    s = cycleData(cycleData(cycleData(s, 3), 3), 3) // D3 = X'
    expect(s.data).toEqual([0, 0, 'x', 'nx'])
    expect(s.inputs).toEqual([0, 0, 0, 1])
    s = setX(s, 1)
    expect(s.inputs).toEqual([0, 0, 1, 0])
  })
  it('the initial state is not the goal; a sloppy wiring is not the goal', () => {
    const g: MuxToyGoal = { kind: 'implements-x', minterms: [3, 5, 6, 7] }
    expect(isGoalMet(initial(ext), g, ext)).toBe(false)
    expect(isGoalMet(withData(initial(ext), [0, 'x', 'x', 1], 0), g, ext)).toBe(true)
    expect(isGoalMet(withData(initial(ext), [0, 'x', 'nx', 1], 0), g, ext)).toBe(false)
    expect(isGoalMet(withData(initial(ext), [0, 1, 1, 1], 0), g, ext)).toBe(false)
  })
})
