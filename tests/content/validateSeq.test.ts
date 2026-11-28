import { describe, it, expect } from 'vitest'
import { validateRoom, validateWorld } from '../../src/content/validate'
import type { Boss, Card, ExamQuestion, LabPuzzle, MachineSpec, Room, World } from '../../src/content/types'
import type { Bit } from '../../src/logic/boolean'
import { askedRows, puzzleTable } from '../../src/ui/lab/seqLogic'

const room = (puzzle: LabPuzzle, id = 'r'): Room => ({ id, title: 't', intro: 'i', hints: [], puzzle })
const errsOf = (p: LabPuzzle) => { const e: string[] = []; validateRoom(room(p), {}, e); return e }
const rows: MachineSpec = { from: 'rows', stateVars: ['A', 'B'], inputs: ['X'], outputs: ['Y'], next: [[2, 2], [1, 3], [3, 3], [1, 0]], out: [[0, 1], [1, 1], [0, 0], [0, 0]] }
const eqs: MachineSpec = { from: 'equations', stateVars: ['A', 'B'], inputs: ['X'], next: { A: "A'X + B", B: 'A ⊕ X' }, out: { Y: "AB'" } }

describe('validateRoom: sequential kinds', () => {
  it('state-table: a good machine passes; a bad equation, an SR machine or equations shown without equations fail', () => {
    expect(errsOf({ type: 'state-table', machine: eqs, show: 'equations' })).toEqual([])
    expect(errsOf({ type: 'state-table', machine: rows, show: 'diagram' })).toEqual([])
    expect(errsOf({ type: 'state-table', machine: { ...eqs, next: { A: 'A +', B: 'X' } }, show: 'equations' }).join()).toMatch(/machine/)
    expect(errsOf({ type: 'state-table', machine: rows, show: 'equations' }).join()).toMatch(/equations/)
    // Review Focus 1: a machine driven by S and R would list the forbidden S=R=1 input
    const sr: MachineSpec = { from: 'equations', stateVars: ['Q'], inputs: ['S', 'R'], next: { Q: "S + R'Q" }, out: {} }
    expect(errsOf({ type: 'state-table', machine: sr, show: 'equations' }).join()).toMatch(/forbidden/)
  })
  it('Review I3: the moed-A Q4א style (3 state variables, 2 inputs, equations, rows 000 and 110 only) validates and matches the handwritten solution', () => {
    const moedA: MachineSpec = {
      from: 'equations', stateVars: ['y1', 'y2', 'y3'], inputs: ['x1', 'x2'],
      next: { y1: "y1x1x2 + y2y3'", y2: "y1y2y3'x1", y3: "y1'x1x2y3" },
      out: { z: "y1y2x1x2 + y2y3'x1x2" },
    }
    const p: LabPuzzle = { type: 'state-table', machine: moedA, show: 'equations', rows: [0b000, 0b110] }
    expect(errsOf(p)).toEqual([])
    const asked = askedRows(puzzleTable(p), p.rows).map(r => [r.state, r.input, r.next, r.out])
    expect(asked).toEqual([
      [0b000, 0b00, 0b000, 0], [0b000, 0b01, 0b000, 0], [0b000, 0b10, 0b000, 0], [0b000, 0b11, 0b000, 0],
      [0b110, 0b00, 0b100, 0], [0b110, 0b01, 0b100, 0], [0b110, 0b10, 0b110, 0], [0b110, 0b11, 0b110, 1],
    ])
    // asking every row is 32 rows: over the cap
    expect(errsOf({ ...p, rows: undefined } as LabPuzzle).join()).toMatch(/32 rows/)
    expect(errsOf({ ...p, rows: [8] } as LabPuzzle).join()).toMatch(/not used/)
  })
  it('Review I3: with rows, a rows machine only needs the asked states (unasked next states may be undefined)', () => {
    const partial: MachineSpec = { from: 'rows', stateVars: ['A', 'B'], inputs: ['X'], outputs: ['Y'], used: [0], next: [[3, 2]], out: [[0, 1]] }
    expect(errsOf({ type: 'state-table', machine: partial, show: 'none' }).join()).toMatch(/machine/)
    expect(errsOf({ type: 'state-table', machine: partial, show: 'none', rows: [0] })).toEqual([])
  })
  it('M5: inputs s and r (any case) are rejected', () => {
    const sr: MachineSpec = { from: 'rows', stateVars: ['Q'], inputs: ['s', 'R'], outputs: [], next: [[0, 0, 1, 1], [1, 0, 1, 1]], out: [[0, 0, 0, 0], [0, 0, 0, 0]] }
    expect(errsOf({ type: 'state-table', machine: sr, show: 'none' }).join()).toMatch(/forbidden/)
  })
  it('fsm-equations: 2–4 variables', () => {
    expect(errsOf({ type: 'fsm-equations', machine: rows, show: 'table' })).toEqual([])
    const big: MachineSpec = { from: 'equations', stateVars: ['A', 'B', 'C'], inputs: ['X', 'W'], next: { A: 'X', B: 'W', C: 'A' }, out: {} }
    expect(errsOf({ type: 'fsm-equations', machine: big, show: 'table' }).join()).toMatch(/variables/)
  })
  it('waveform: must pass validateWaveConfig (Review Focus 1: no SR forbidden input, no race)', () => {
    const clk: Bit[] = [0, 1, 1, 0, 0, 1, 1, 0]
    expect(errsOf({ type: 'waveform', kind: 'ff-JK', clk, inputs: { J: [1, 1, 1, 1, 1, 1, 1, 1], K: [1, 1, 1, 1, 1, 1, 1, 1] }, q0: 0 })).toEqual([])
    const sr = errsOf({ type: 'waveform', kind: 'latch-SR', clk, inputs: { S: [0, 0, 1, 1, 0, 0, 0, 0], R: [0, 0, 1, 1, 0, 0, 0, 0] }, q0: 0 })
    expect(sr.join()).toMatch(/forbidden/)
    const race = errsOf({ type: 'waveform', kind: 'ff-D', clk, inputs: { D: [0, 1, 1, 1, 1, 1, 1, 1] }, q0: 0 })
    expect(race.join()).toMatch(/changes/)
  })
  it('state-reduce: the machine must be reducible', () => {
    const red: MachineSpec = { from: 'rows', stateVars: ['A', 'B'], inputs: ['X'], outputs: ['Z'], next: [[1, 2], [0, 2], [0, 1]], out: [[0, 1], [0, 1], [1, 0]], used: [0, 1, 2] }
    expect(errsOf({ type: 'state-reduce', machine: red, show: 'table' })).toEqual([])
    expect(errsOf({ type: 'state-reduce', machine: rows, show: 'table' }).join()).toMatch(/nothing to merge/)
  })
  it('identify: 2–6 distinct options, correct in range, a schematic that lays out', () => {
    const schematic = { parts: [{ id: 'L', kind: 'latch' as const, gate: 'NOR' as const, at: [0, 0] as [number, number] }], wires: [] }
    expect(errsOf({ type: 'identify', schematic, question: 'q', options: ['a', 'b'], correct: 1 })).toEqual([])
    expect(errsOf({ type: 'identify', schematic, question: 'q', options: ['a', 'a'], correct: 2 }).length).toBe(2)
    expect(errsOf({ type: 'identify', schematic: { parts: [], wires: [{ from: 'x', to: 'y' }] }, question: 'q', options: ['a', 'b'], correct: 0 }).join()).toMatch(/schematic/)
  })
})

const claim = (id: string, stage: string): Card => ({ id, kind: 'claim', stage, text: 't', isTrue: false, reasons: ['a', 'b', 'c'], correctReason: 0, examReason: 'קצר', knowledge: 'k', source: 'סילבוס: x' })
const mcq = (id: string, stage: string): Card => ({ id, kind: 'mcq', stage, text: 't', options: ['1', '2', '3', '4', '5', '6'], correct: 0, knowledge: 'k', source: 'סילבוס: x' })
const q = (id: string, over: Partial<ExamQuestion> = {}): ExamQuestion => ({
  id, topic: 1, prompt: 'p', a: { type: 'number', prompt: 'n', answer: '1', check: 'exact' },
  b: claim(`${id}-b`, 'boss') as ExamQuestion['b'], c: mcq(`${id}-c`, 'boss') as ExamQuestion['c'], review: { room: 'r1' }, ...over,
})
const world = (boss: Boss): World => ({ id: 'w', title: 'w', icon: 'x', stages: [{ id: 's1', order: 1, title: 's', rooms: [room({ type: 'number', prompt: 'n', answer: '1', check: 'exact' }, 'r1')], cards: [] }], boss })

describe('validateWorld: boss', () => {
  it('accepts a good bank', () => {
    expect(validateWorld(world({ id: 'boss', title: 'b', bank: [q('q1')] }))).toEqual([])
  })
  it('flags cards with another stage, a review link that does not exist, a bad part-a puzzle and duplicate ids', () => {
    const errs = validateWorld(world({ id: 'boss', title: 'b', bank: [
      q('q1', { b: claim('q1-b', 's1') as ExamQuestion['b'] }),
      q('q2', { review: { room: 'nope' } }),
      q('q3', { a: { type: 'number', prompt: 'n', answer: '2', check: 'exact', compute: () => '3' } }),
      q('q3'),
      q('q4', { review: {} }),
      q('q5', { c: { ...(mcq('q5-c', 'boss') as ExamQuestion['c']), figure: { parts: [], wires: [{ from: 'a', to: 'b' }] } } }),
    ] }))
    expect(errs.some(e => e.startsWith('q5') && /figure/.test(e))).toBe(true)
    expect(errs.some(e => e.startsWith('q1-b') && /stage/.test(e))).toBe(true)
    expect(errs.some(e => e.startsWith('q2') && /nope/.test(e))).toBe(true)
    expect(errs.some(e => e.startsWith('q3') && /compute/.test(e))).toBe(true)
    expect(errs.some(e => e.startsWith('q3') && /duplicate/.test(e))).toBe(true)
    expect(errs.some(e => e.startsWith('q4') && /review/.test(e))).toBe(true)
  })
})
