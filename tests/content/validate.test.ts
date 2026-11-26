import { describe, it, expect } from 'vitest'
import { validateWorld } from '../../src/content/validate'
import { switchingWorld } from '../../src/content/switching/world'
import type { World, Room, Card } from '../../src/content/types'
import type { Circuit, Node, Wire } from '../../src/logic/circuit'

const n = (id: string, kind: Node['kind'], label?: string): Node => ({ id, kind, label, x: 0, y: 0 })
const w = (from: string, to: string, pin = 0): Wire => ({ from: { node: from, pin: 0 }, to: { node: to, pin } })
const andC = (kind: 'AND' | 'OR' | 'NAND' = 'AND'): Circuit => ({
  nodes: [n('A', 'IN', 'A'), n('B', 'IN', 'B'), n('g', kind), n('F', 'OUT', 'F')],
  wires: [w('A', 'g', 0), w('B', 'g', 1), w('g', 'F')],
})
const andSpec = { inputs: ['A', 'B'], outputs: ['F'], rows: [[0], [0], [0], [1]] as (0 | 1)[][] }

const room = (id: string, over: Partial<Extract<Room['puzzle'], { type: 'circuit' }>> = {}): Room => ({
  id, title: 't', intro: 'i', hints: [],
  puzzle: { type: 'circuit', spec: andSpec, allowed: ['AND'], optimalGates: 1, reference: andC(), ...over },
})
const claim = (id: string, over: Record<string, unknown> = {}): Card => ({
  id, kind: 'claim', stage: 's1', text: 't', isTrue: true, reasons: ['a', 'b'], correctReason: 0,
  examReason: 'קצר מאוד', knowledge: 'k', source: 'מנו', ...over,
} as Card)
const mcq = (id: string, options: string[] = ['1', '2', '3', '4', '5', '6']): Card => ({
  id, kind: 'mcq', stage: 's1', text: 't', options: options as never, correct: 0, knowledge: 'k', source: 'מנו',
})
const world = (rooms: Room[], cards: Card[] = []): World => ({
  id: 'w', title: 'w', icon: 'x', stages: [{ id: 's1', order: 1, title: 's', rooms, cards }],
})

describe('validateWorld', () => {
  it('accepts a good world', () => {
    expect(validateWorld(world([room('r1')], [claim('c1'), mcq('m1')]))).toEqual([])
  })
  it('flags a reference that does not match its spec', () => {
    const errs = validateWorld(world([room('r1', { reference: andC('OR'), allowed: ['OR'] })]))
    expect(errs.some(e => e.startsWith('r1') && /spec/i.test(e))).toBe(true)
  })
  it('flags a disallowed gate', () => {
    const errs = validateWorld(world([room('r1', { allowed: ['OR'] })]))
    expect(errs.some(e => e.startsWith('r1') && /allowed/i.test(e))).toBe(true)
  })
  it('flags gate count above optimal', () => {
    const errs = validateWorld(world([room('r1', { optimalGates: 0 })]))
    expect(errs.some(e => e.startsWith('r1') && /gate/i.test(e))).toBe(true)
  })
  it('flags a 16-word examReason', () => {
    const errs = validateWorld(world([], [claim('c1', { examReason: Array(16).fill('מילה').join(' ') })]))
    expect(errs.some(e => e.startsWith('c1') && /examReason/.test(e))).toBe(true)
  })
  it('accepts a 15-word examReason', () => {
    expect(validateWorld(world([], [claim('c1', { examReason: Array(15).fill('מילה').join(' ') })]))).toEqual([])
  })
  it('flags 5 MCQ options and duplicate options', () => {
    expect(validateWorld(world([], [mcq('m1', ['1', '2', '3', '4', '5'])])).some(e => e.startsWith('m1'))).toBe(true)
    expect(validateWorld(world([], [mcq('m2', ['1', '1', '3', '4', '5', '6'])])).some(e => e.startsWith('m2'))).toBe(true)
  })
  it('flags duplicate ids', () => {
    expect(validateWorld(world([room('x')], [claim('x')])).some(e => /duplicate/i.test(e))).toBe(true)
  })
  it('flags empty source and wrong card stage', () => {
    const errs = validateWorld(world([], [claim('c1', { source: ' ' }), claim('c2', { stage: 'other' })]))
    expect(errs.some(e => e.startsWith('c1') && /source/.test(e))).toBe(true)
    expect(errs.some(e => e.startsWith('c2') && /stage/.test(e))).toBe(true)
  })
  it('flags spec input names mismatch', () => {
    const errs = validateWorld(world([room('r1', { spec: { ...andSpec, inputs: ['X', 'Y'] } })]))
    expect(errs.some(e => e.startsWith('r1'))).toBe(true)
  })
  it('checks kmap rooms', () => {
    const k = (minterms: number[], dontCares: number[], nVars: 2 | 3 | 4 = 2): Room =>
      ({ id: 'k', title: 't', intro: 'i', hints: [], puzzle: { type: 'kmap', nVars, minterms, dontCares } })
    expect(validateWorld(world([k([1], [2])]))).toEqual([])
    expect(validateWorld(world([k([], [1])])).length).toBeGreaterThan(0)
    expect(validateWorld(world([k([4], [])])).length).toBeGreaterThan(0)
    expect(validateWorld(world([k([1], [1])])).length).toBeGreaterThan(0)
  })
  it('checks number compute', () => {
    const r = (answer: string, compute?: () => string): Room =>
      ({ id: 'n', title: 't', intro: 'i', hints: [], puzzle: { type: 'number', prompt: 'p', answer, check: 'exact', compute } })
    expect(validateWorld(world([r('ff', () => ' FF ')]))).toEqual([])
    expect(validateWorld(world([r('FF', () => 'FE')])).length).toBeGreaterThan(0)
    expect(validateWorld(world([r('FF')]))).toEqual([])
  })
  it('checks delay and code rooms', () => {
    const d = (askAt: string, answer: number): Room => ({
      id: 'd', title: 't', intro: 'i', hints: [],
      puzzle: { type: 'delay', circuit: { nodes: [n('A', 'IN', 'A'), { ...n('g', 'NOT'), delay: 2 }, n('F', 'OUT', 'F')], wires: [w('A', 'g'), w('g', 'F')] }, askAt, answer },
    })
    expect(validateWorld(world([d('F', 2)]))).toEqual([])
    expect(validateWorld(world([d('F', 3)])).length).toBeGreaterThan(0)
    expect(validateWorld(world([d('zz', 3)])).length).toBeGreaterThan(0)
    const c = (inputs: string[]): Room => ({ id: 'c', title: 't', intro: 'i', hints: [], puzzle: { type: 'code', definition: 'd', encode: b => b, inputs } })
    expect(validateWorld(world([c(['0101'])]))).toEqual([])
    expect(validateWorld(world([c([])])).length).toBeGreaterThan(0)
  })
  describe('chips', () => {
    const haRoom = (id: string): Room => room(id, { unlocksChip: { name: 'HA', inputs: ['A', 'B'], outputs: ['F'] } })
    const useHa: Circuit = {
      nodes: [n('A', 'IN', 'A'), n('B', 'IN', 'B'), n('h', { chip: 'HA' }), n('F', 'OUT', 'F')],
      wires: [w('A', 'h', 0), w('B', 'h', 1), w('h', 'F')],
    }
    it('allows using a chip unlocked by an earlier room', () => {
      expect(validateWorld(world([haRoom('r1'), room('r2', { reference: useHa })]))).toEqual([])
    })
    it('reports (not throws) using a later or unknown chip', () => {
      const errs = validateWorld(world([room('r1', { reference: useHa }), haRoom('r2')]))
      expect(errs.some(e => e.startsWith('r1'))).toBe(true)
    })
    it('accepts passed-in chips', () => {
      const chip = { name: 'HA', inputs: ['A', 'B'], outputs: ['F'], circuit: andC() }
      expect(validateWorld(world([room('r1', { reference: useHa })]), { HA: chip })).toEqual([])
    })
    it('flags duplicate unlocks and key/name mismatch', () => {
      expect(validateWorld(world([haRoom('r1'), haRoom('r2')])).some(e => /duplicate|twice|already/i.test(e))).toBe(true)
      const chip = { name: 'HA', inputs: ['A', 'B'], outputs: ['F'], circuit: andC() }
      expect(validateWorld(world([]), { XX: chip }).length).toBeGreaterThan(0)
    })
  })
})

describe('Switching world', () => {
  it('is valid', () => expect(validateWorld(switchingWorld)).toEqual([]))
  it('has five stages with the agreed ids', () => {
    expect(switchingWorld.stages.map(s => s.id)).toEqual(['sw-1-numbers', 'sw-2-arith', 'sw-3-boolean', 'sw-4-minimize', 'sw-5-blocks'])
    for (const s of switchingWorld.stages) { expect(s.rooms.length).toBeGreaterThanOrEqual(1); expect(s.cards.length).toBeGreaterThanOrEqual(1) }
  })
})
