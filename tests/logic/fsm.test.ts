import { describe, it, expect } from 'vitest'
import {
  fsmFromRows,
  fromEquations,
  stateTable,
  dInputs,
  outputInputs,
  isMoore,
  reduceStates,
  samePartition,
  canUseSingleFlipFlop,
  type Fsm,
} from '../../src/logic/fsm'
import { minimizeSOP, literalCount } from '../../src/logic/qm'
import type { Bit } from '../../src/logic/boolean'
import type { StateTable } from '../../src/logic/fsm'

/** moed B, Q4a. State AB (A = MSB), input X (LSB). next[s][x], out[s][x]. */
const moedB: Fsm = fsmFromRows({
  stateVars: ['A', 'B'],
  inputs: ['X'],
  outputs: ['Y'],
  next: [
    [0b10, 0b10], // 00
    [0b01, 0b11], // 01
    [0b11, 0b11], // 10
    [0b01, 0b00], // 11
  ],
  out: [
    [0, 1],
    [1, 1],
    [0, 0],
    [0, 0],
  ],
})

/** moed A, Q4a equations. y1 is MSB, x2 is LSB. */
const moedA = fromEquations({
  stateVars: ['y1', 'y2', 'y3'],
  inputs: ['x1', 'x2'],
  next: {
    y1: v => ((v.y1 & v.x1 & v.x2) | (v.y2 & (1 - v.y3))) as Bit,
    y2: v => (v.y1 & v.y2 & (1 - v.y3) & v.x1) as Bit,
    y3: v => ((1 - v.y1) & v.x1 & v.x2 & v.y3) as Bit,
  },
  out: {
    z: v => ((v.y1 & v.y2 & v.x1 & v.x2) | (v.y2 & (1 - v.y3) & v.x1 & v.x2)) as Bit,
  },
})

describe('moed B Q4a (4-state table)', () => {
  const t = stateTable(moedB)
  it('rows are ordered state-MSB..input-LSB and match the exam table', () => {
    expect(t.rows).toHaveLength(8)
    const flat = t.rows.map(r => [r.state, r.input, r.next, r.out])
    expect(flat).toEqual([
      [0, 0, 0b10, 0],
      [0, 1, 0b10, 1],
      [1, 0, 0b01, 1],
      [1, 1, 0b11, 1],
      [2, 0, 0b11, 0],
      [2, 1, 0b11, 0],
      [3, 0, 0b01, 0],
      [3, 1, 0b00, 0],
    ])
  })
  it('is Mealy (output depends on X in state 00)', () => {
    expect(isMoore(t)).toBe(false)
    expect(t.kind).toBe('mealy')
  })
  it('D inputs / output as minterms over (A,B,X)', () => {
    const d = dInputs(t)
    expect(d.map(x => x.var)).toEqual(['A', 'B'])
    expect(d[0]).toEqual({ var: 'A', minterms: [0, 1, 3, 4, 5], dontCares: [] })
    expect(d[1]).toEqual({ var: 'B', minterms: [2, 3, 4, 5, 6], dontCares: [] })
    expect(outputInputs(t)[0]).toEqual({ var: 'Y', minterms: [1, 2, 3], dontCares: [] })
  })
  it('minimised equations reproduce the table', () => {
    for (const f of [...dInputs(t), ...outputInputs(t)]) {
      const terms = minimizeSOP(3, f.minterms, f.dontCares)
      for (let m = 0; m < 8; m++) {
        const v = terms.some(tm => (m & tm.mask) === tm.value)
        expect(v).toBe(f.minterms.includes(m))
      }
    }
    // Hand-derived K-maps: A+ = B' + A'X (3), B+ = AB' + A'B + BX' (6), Y = A'X + A'B (4)
    const lits = [...dInputs(t), ...outputInputs(t)].map(f =>
      literalCount(minimizeSOP(3, f.minterms, f.dontCares)),
    )
    expect(lits).toEqual([3, 6, 4])
  })
  it('is already minimal (4 distinct states) and needs two flip-flops', () => {
    expect(reduceStates(t)).toEqual([[0], [1], [2], [3]])
    expect(canUseSingleFlipFlop(t)).toBe(false)
  })
})

describe('moed A Q4a (equations, 3 flip-flops)', () => {
  it('has 3 flip-flops and is Mealy', () => {
    expect(moedA.stateBits).toBe(3)
    expect(isMoore(stateTable(moedA))).toBe(false)
  })
  const t = stateTable(moedA)
  const at = (s: number, x: number) => t.rows[(s << 2) | x]
  it('state 000: always next 000, z=0 (handwritten solution)', () => {
    for (let x = 0; x < 4; x++) expect([at(0b000, x).next, at(0b000, x).out]).toEqual([0b000, 0])
  })
  it('state 110: handwritten solution (x1x2 = 00,01,10,11)', () => {
    expect(at(0b110, 0b00)).toMatchObject({ next: 0b100, out: 0 })
    expect(at(0b110, 0b01)).toMatchObject({ next: 0b100, out: 0 })
    expect(at(0b110, 0b10)).toMatchObject({ next: 0b110, out: 0 })
    expect(at(0b110, 0b11)).toMatchObject({ next: 0b110, out: 1 })
  })
  it('other states, derived by hand from the equations', () => {
    // 010: y1+=y2y3'=1, y2+=0, y3+=0 ; z=1 only at x=11
    for (let x = 0; x < 4; x++) expect(at(0b010, x).next).toBe(0b100)
    expect(at(0b010, 0b11).out).toBe(1)
    expect(at(0b010, 0b10).out).toBe(0)
    // 011: y3 holds only when x1x2=11, y1+=0
    expect(at(0b011, 0b11)).toMatchObject({ next: 0b001, out: 0 })
    expect(at(0b011, 0b01)).toMatchObject({ next: 0b000, out: 0 })
    // 111: y1+=x1x2, y2+=0 (y3=1), y3+=0 (y1=1)
    expect(at(0b111, 0b11)).toMatchObject({ next: 0b100, out: 1 })
  })
})

/** Mano-style textbook example: a..g = 0..6; e≡g and d≡f. */
const textbook: Fsm = fsmFromRows({
  stateVars: ['A', 'B', 'C'],
  inputs: ['x'],
  outputs: ['z'],
  used: [0, 1, 2, 3, 4, 5, 6],
  next: [
    [0, 1], // a
    [2, 3], // b
    [0, 3], // c
    [4, 5], // d
    [0, 5], // e
    [6, 5], // f
    [0, 5], // g
  ],
  out: [[0, 0], [0, 0], [0, 0], [0, 0], [1, 1], [0, 0], [1, 1]],
})

describe('reduction on a textbook example', () => {
  const t = stateTable(textbook)
  it('is Moore', () => expect(isMoore(t)).toBe(true))
  it('unused state code 7 is don\'t-care in D inputs', () => {
    const d = dInputs(t)
    expect(d[0].dontCares).toEqual([14, 15])
    expect(outputInputs(t)[0].dontCares).toEqual([14, 15])
  })
  it('merges e~g and d~f', () => {
    expect(reduceStates(t)).toEqual([[0], [1], [2], [3, 5], [4, 6]])
    expect(canUseSingleFlipFlop(t)).toBe(false)
  })
  it('samePartition ignores group order, member order and naming', () => {
    expect(samePartition([[0], [1], [2], [3, 5], [4, 6]], [[6, 4], [5, 3], [2], [1], [0]])).toBe(true)
    expect(samePartition([[0], [1], [2], [3, 5], [4, 6]], [[0], [1], [2], [3], [4, 5, 6]])).toBe(false)
    expect(samePartition([[0, 1], [2]], [[0], [1, 2]])).toBe(false)
  })
})

describe('canUseSingleFlipFlop', () => {
  it('true when the machine reduces to 2 states', () => {
    const f = fsmFromRows({
      stateVars: ['A', 'B'],
      inputs: ['x'],
      outputs: ['y'],
      next: [[0, 3], [0, 3], [0, 3], [0, 3]],
      out: [[0, 0], [1, 1], [0, 0], [1, 1]],
    })
    const t = stateTable(f)
    expect(reduceStates(t)).toEqual([[0, 2], [1, 3]])
    expect(canUseSingleFlipFlop(t)).toBe(true)
  })
  it('true for a plain 1-bit machine', () => {
    const f = fsmFromRows({
      stateVars: ['Q'],
      inputs: ['x'],
      outputs: ['y'],
      next: [[0, 1], [1, 0]],
      out: [[0, 0], [1, 1]],
    })
    expect(canUseSingleFlipFlop(stateTable(f))).toBe(true)
  })
})

describe('input validation', () => {
  it('rejects ragged or out-of-range rows', () => {
    expect(() =>
      fsmFromRows({ stateVars: ['A'], inputs: ['x'], outputs: ['y'], next: [[0, 1]], out: [[0, 0], [0, 0]] }),
    ).toThrow()
    expect(() =>
      fsmFromRows({ stateVars: ['A'], inputs: ['x'], outputs: ['y'], next: [[0, 2], [0, 0]], out: [[0, 0], [0, 0]] }),
    ).toThrow()
  })
})

describe('used-state validation', () => {
  const eq = (used: number[], to: number) =>
    fromEquations({
      stateVars: ['A', 'B'],
      inputs: ['x'],
      next: { A: () => ((to >> 1) & 1) as Bit, B: () => (to & 1) as Bit },
      out: { z: () => 0 },
      used,
    })
  it('fromEquations accepts a closed used set', () => {
    expect(() => eq([0, 1, 2], 1)).not.toThrow()
  })
  it('fromEquations rejects a transition into an unused state', () => {
    expect(() => eq([0, 1, 2], 3)).toThrow(/unused/)
  })
  it('rejects out-of-range used codes (both builders)', () => {
    expect(() => eq([0, 4], 0)).toThrow(/range/)
    expect(() =>
      fsmFromRows({ stateVars: ['A'], inputs: ['x'], outputs: ['y'], next: [[0, 0], [0, 0]], out: [[0, 0], [0, 0]], used: [0, 2] }),
    ).toThrow(/range/)
  })
  it('reduceStates throws when next is not a used state', () => {
    const t: StateTable = {
      stateBits: 1, stateVars: ['A'], inputs: ['x'], outputs: ['y'], kind: 'moore',
      rows: [
        { state: 0, input: 0, next: 1, out: 0 }, { state: 0, input: 1, next: 1, out: 0 },
        { state: 1, input: 0, next: null, out: null }, { state: 1, input: 1, next: null, out: null },
      ],
    }
    expect(() => reduceStates(t)).toThrow(/unused/)
  })
})
