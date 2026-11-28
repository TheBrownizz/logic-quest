import { describe, it, expect } from 'vitest'
import {
  checkEquations, checkPartition, checkStateTable, checkWave, designFunctions, machineOf, minLiterals, tableOf, usedRows, varsOf,
} from '../../src/ui/lab/seqLogic'
import type { MachineSpec } from '../../src/content/types'
import { fromEquations, stateTable } from '../../src/logic/fsm'
import type { Bit } from '../../src/logic/boolean'

/** Mod-3 counter enabled by X (S0 00 → S1 01 → S2 10 → S0; code 11 unused), Moore output Z = 1 in S2. */
const counter: MachineSpec = { from: 'rows', stateVars: ['A', 'B'], inputs: ['X'], outputs: ['Z'], next: [[0, 1], [1, 2], [2, 0]], out: [[0, 0], [0, 0], [1, 1]], used: [0, 1, 2] }
/** The moed-B Q4 table (A B state, X input, Y output). */
const moedB: MachineSpec = { from: 'rows', stateVars: ['A', 'B'], inputs: ['X'], outputs: ['Y'], next: [[2, 2], [1, 3], [3, 3], [1, 0]], out: [[0, 1], [1, 1], [0, 0], [0, 0]] }
const eqs: MachineSpec = { from: 'equations', stateVars: ['A', 'B'], inputs: ['X'], next: { A: "A'X + B", B: 'A ⊕ X' }, out: { Y: "AB'" } }

describe('machineOf', () => {
  it('builds rows and equations machines; equations match fromEquations', () => {
    expect(tableOf(moedB).rows.map(r => r.next)).toEqual([2, 2, 1, 3, 3, 3, 1, 0])
    const ref = stateTable(fromEquations({
      stateVars: ['A', 'B'], inputs: ['X'],
      next: { A: v => ((v.A ^ 1) & v.X | v.B) as Bit, B: v => (v.A ^ v.X) as Bit },
      out: { Y: v => (v.A & (v.B ^ 1)) as Bit },
    }))
    expect(tableOf(eqs)).toEqual(ref)
  })
  it('throws readable errors for a bad equation, an unknown variable, or a missing equation', () => {
    expect(() => machineOf({ ...eqs, next: { A: 'A +', B: 'X' } } as MachineSpec)).toThrow(/A:/)
    expect(() => machineOf({ ...eqs, next: { A: 'A', B: 'Z' } } as MachineSpec)).toThrow(/B:/)
    expect(() => machineOf({ ...eqs, next: { A: 'A' } } as MachineSpec)).toThrow(/missing/)
  })
})

describe('checkStateTable', () => {
  const t = tableOf(counter)
  const right = usedRows(t).map(r => ({ next: [((r.next! >> 1) & 1) as Bit, (r.next! & 1) as Bit], out: [r.out as Bit] }))
  it('accepts the computed table and lists wrong and missing cells', () => {
    expect(usedRows(t)).toHaveLength(6)
    expect(checkStateTable(t, right, 'both')).toEqual({ ok: true, wrong: [], missing: 0 })
    const bad = right.map(r => ({ next: [...r.next], out: [...r.out] as Array<Bit | null> }))
    bad[3].next[0] = 0
    bad[5].out[0] = null
    const res = checkStateTable(t, bad, 'both')
    expect(res.ok).toBe(false)
    expect(res.wrong).toEqual([{ row: 3, col: 'next', bit: 0 }])
    expect(res.missing).toBe(1)
  })
  it('fill "next" ignores the output column', () => {
    const noOut = right.map(r => ({ next: r.next, out: [null] }))
    expect(checkStateTable(t, noOut, 'next').ok).toBe(true)
  })
})

describe('fsm-equations (Review Focus 2)', () => {
  const t = tableOf(counter)
  const fns = designFunctions(t, 'D')
  it('D covers come from dInputs and outputInputs, unused codes are don\'t-cares', () => {
    expect(fns.map(f => f.name)).toEqual(['DA', 'DB', 'Z'])
    expect(fns[0]).toMatchObject({ minterms: [3, 4], dontCares: [6, 7] })
    expect(fns[1]).toMatchObject({ minterms: [1, 2], dontCares: [6, 7] })
    expect(fns[2]).toMatchObject({ minterms: [4, 5], dontCares: [6, 7] })
    expect(minLiterals(fns, varsOf(t).length)).toBe(10)
  })
  it('the QM answer is right and optimal', () => {
    const r = checkEquations(fns, varsOf(t), { DA: "AX' + BX", DB: "A'B'X + BX'", Z: 'A' })
    expect(r.ok).toBe(true)
    expect(r.literals).toBe(10)
    expect(r.optimal).toBe(true)
  })
  it('an equivalent answer that uses the don\'t-cares differently is accepted (not optimal)', () => {
    const r = checkEquations(fns, varsOf(t), { DA: "AB'X' + A'BX", DB: "A'B'X + A'BX'", Z: "AB'" })
    expect(r.ok).toBe(true)
    expect(r.optimal).toBe(false)
    expect(r.literals).toBe(14)
  })
  it('a wrong or unreadable equation is reported per function, with the first wrong row', () => {
    const r = checkEquations(fns, varsOf(t), { DA: "AX'", DB: 'B +', Z: '' })
    expect(r.ok).toBe(false)
    expect(r.results.DA).toEqual({ status: 'wrong', row: 3 })
    expect(r.results.DB.status).toBe('parse')
    expect(r.results.Z.status).toBe('empty')
  })
  it('T and JK covers come from the excitation tables', () => {
    const tm = tableOf(moedB)
    const T = designFunctions(tm, 'T')
    expect(T.map(f => f.name)).toEqual(['TA', 'TB', 'Y'])
    // TA = A xor A+: rows A B X: next 10,10,01,11,11,11,01,00
    expect(T[0].minterms).toEqual([0, 1, 2, 3, 6, 7].filter(m => {
      const a = (m >> 2) & 1, nxt = tm.rows[m].next!
      return (a ^ (nxt >> 1)) === 1
    }))
    const JK = designFunctions(tm, 'JK')
    expect(JK.map(f => f.name)).toEqual(['JA', 'KA', 'JB', 'KB', 'Y'])
    // J is a don't-care whenever the flip-flop is already 1
    expect(JK[0].dontCares).toEqual([4, 5, 6, 7])
    expect(JK[1].dontCares).toEqual([0, 1, 2, 3])
  })
})

describe('checkWave', () => {
  it('compares Q with simulateWave and lists wrong or empty columns', () => {
    const p = { type: 'waveform' as const, kind: 'ff-D' as const, clk: [0, 1, 1, 0, 0, 1, 1, 0] as Bit[], inputs: { D: [1, 1, 0, 0, 0, 0, 1, 1] as Bit[] }, q0: 0 as Bit }
    const q: Bit[] = [0, 1, 1, 1, 1, 0, 0, 0]
    expect(checkWave(p, q)).toEqual({ ok: true, wrong: [] })
    expect(checkWave(p, [0, 1, 1, 1, 1, 1, null, 0])).toEqual({ ok: false, wrong: [5, 6] })
  })
})

describe('checkPartition (Review Focus 3)', () => {
  // S0..S4 where S1 ≡ S3 and S2 ≡ S4 (codes 5..7 unused)
  const m: MachineSpec = { from: 'rows', stateVars: ['A', 'B', 'C'], inputs: ['X'], outputs: ['Z'], used: [0, 1, 2, 3, 4],
    next: [[1, 2], [3, 4], [0, 1], [1, 2], [0, 3]], out: [[0, 0], [0, 1], [1, 0], [0, 1], [1, 0]] }
  const t = tableOf(m)
  it('the same partition is accepted whatever the group labels and order', () => {
    expect(checkPartition(t, { 0: 0, 1: 1, 2: 2, 3: 1, 4: 2 }).ok).toBe(true)
    expect(checkPartition(t, { 0: 5, 1: 0, 2: 3, 3: 0, 4: 3 }).ok).toBe(true)
  })
  it('a different partition or an unassigned state is rejected', () => {
    expect(checkPartition(t, { 0: 0, 1: 1, 2: 2, 3: 1, 4: 0 }).ok).toBe(false)
    expect(checkPartition(t, { 0: 0, 1: 1, 2: 2, 3: 1 }).ok).toBe(false)
    expect(checkPartition(t, { 0: 0, 1: 1, 2: 2, 3: 1 }).unassigned).toEqual([4])
    expect(checkPartition(t, { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4 }).expectedGroups).toBe(3)
  })
})
