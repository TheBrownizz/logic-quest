import { describe, it, expect } from 'vitest'
import type { Circuit, Chip } from '../../src/logic/circuit'
import type { LabPuzzle } from '../../src/content/types'
import { stage3 } from '../../src/content/switching/stage3'
import {
  alignTable, autoLayout, checkCircuit, findRoom, hasQueryFlag, initialCircuit, liveValues,
  mergeResult, needsLayout, nextNodeId, refersToChip, usableDraft,
} from '../../src/ui/lab/labLogic'
import { parseHash } from '../../src/ui/router'

const ha = stage3.rooms[0].puzzle as Extract<LabPuzzle, { type: 'circuit' }>

describe('lab logic', () => {
  it('finds rooms across worlds', () => {
    const f = findRoom('sw-3-r1')
    expect(f?.room.title).toBe('מחבר למחצה מ-NAND')
    expect(f?.stage.id).toBe('sw-3-boolean')
    expect(f?.world.id).toBe('switching')
    expect(findRoom('nope')).toBeUndefined()
  })

  it('initial circuit has one IN per input and one OUT per output', () => {
    const c = initialCircuit(ha.spec)
    expect(c.wires).toEqual([])
    expect(c.nodes.map(n => [n.id, n.kind, n.label])).toEqual([
      ['A', 'IN', 'A'], ['B', 'IN', 'B'], ['C', 'OUT', 'C'], ['S', 'OUT', 'S'],
    ])
    const [a, , cOut] = c.nodes
    expect(a.x).toBeLessThan(cOut.x)
  })

  it('auto layout spreads all-zero circuits left to right', () => {
    expect(needsLayout(ha.reference)).toBe(true)
    const c = autoLayout(ha.reference)
    expect(needsLayout(c)).toBe(false)
    const x = (id: string) => c.nodes.find(n => n.id === id)!.x
    expect(x('A')).toBeLessThan(x('n1'))
    expect(x('n1')).toBeLessThan(x('n2'))
    expect(x('n4')).toBeLessThan(x('S'))
    expect(x('C')).toBe(x('S'))
    const pos = new Set(c.nodes.map(n => `${n.x},${n.y}`))
    expect(pos.size).toBe(c.nodes.length)
  })

  it('checks a correct circuit with gate count and optimality', () => {
    const r = checkCircuit(ha.reference, ha, {})
    expect(r).toEqual({ kind: 'ok', gates: 5, optimal: true })
  })

  it('reports circuit errors and mismatches', () => {
    expect(checkCircuit(initialCircuit(ha.spec), ha, {})).toEqual({ kind: 'error', error: { kind: 'unconnected', nodeId: 'C' } })
    const wrong: Circuit = {
      nodes: [...initialCircuit(ha.spec).nodes, { id: 'g1', kind: 'NAND', x: 0, y: 0 }],
      wires: [
        { from: { node: 'A', pin: 0 }, to: { node: 'g1', pin: 0 } },
        { from: { node: 'B', pin: 0 }, to: { node: 'g1', pin: 1 } },
        { from: { node: 'g1', pin: 0 }, to: { node: 'C', pin: 0 } },
        { from: { node: 'g1', pin: 0 }, to: { node: 'S', pin: 0 } },
      ],
    }
    const r = checkCircuit(wrong, ha, {})
    expect(r.kind).toBe('mismatch')
    if (r.kind === 'mismatch') expect(r.row).toBe(0)
  })

  it('rejects disallowed gates and survives programmer errors', () => {
    const and: Circuit = { nodes: [...ha.reference.nodes, { id: 'x', kind: 'AND', x: 0, y: 0 }], wires: ha.reference.wires }
    expect(checkCircuit(and, ha, {}).kind).toBe('disallowed')
    const ghost: Circuit = { nodes: [...ha.reference.nodes, { id: 'x', kind: { chip: 'ZZ' }, x: 0, y: 0 }], wires: ha.reference.wires }
    expect(checkCircuit(ghost, ha, {}).kind).toBe('crash')
  })

  it('aligns a table to the spec order', () => {
    const actual = { inputs: ['A', 'B'], outputs: ['S', 'C'], rows: [[0, 0], [1, 0], [1, 0], [0, 1]] as (0 | 1)[][] }
    const spec = { inputs: ['B', 'A'], outputs: ['C', 'S'], rows: [] }
    expect(alignTable(spec, actual).rows).toEqual([[0, 0], [0, 1], [0, 1], [1, 0]])
  })

  it('merges results keeping the best of each flag', () => {
    expect(mergeResult({ solved: true, optimal: true, noHints: false }, { solved: true, optimal: false, noHints: true }))
      .toEqual({ solved: true, optimal: true, noHints: true })
    expect(mergeResult(undefined, { solved: true, optimal: false, noHints: false }))
      .toEqual({ solved: true, optimal: false, noHints: false })
  })

  it('live values propagate through complete parts only', () => {
    const c: Circuit = {
      nodes: [...ha.reference.nodes, { id: 'lone', kind: 'NAND', x: 0, y: 0 }],
      wires: [...ha.reference.wires, { from: { node: 'A', pin: 0 }, to: { node: 'lone', pin: 0 } }],
    }
    const v = liveValues(c, { A: 1, B: 1 }, {})
    expect(v.n1).toEqual([0])
    expect(v.C).toEqual([1])
    expect(v.S).toEqual([0])
    expect(v.lone).toBeUndefined()
  })

  it('live values work through chips and loops do not hang', () => {
    const chip: Chip = { name: 'HA', inputs: ['A', 'B'], outputs: ['C', 'S'], circuit: ha.reference }
    const c: Circuit = {
      nodes: [...initialCircuit(ha.spec).nodes, { id: 'c1', kind: { chip: 'HA' }, x: 0, y: 0 }, { id: 'l1', kind: 'NOT', x: 0, y: 0 }],
      wires: [
        { from: { node: 'A', pin: 0 }, to: { node: 'c1', pin: 0 } },
        { from: { node: 'B', pin: 0 }, to: { node: 'c1', pin: 1 } },
        { from: { node: 'c1', pin: 1 }, to: { node: 'S', pin: 0 } },
        { from: { node: 'l1', pin: 0 }, to: { node: 'l1', pin: 0 } },
      ],
    }
    const v = liveValues(c, { A: 1, B: 0 }, { HA: chip })
    expect(v.c1).toEqual([0, 1])
    expect(v.S).toEqual([1])
    expect(v.l1).toBeUndefined()
  })

  it('detects circuits that use a chip directly or through another chip', () => {
    const chipNode = (name: string) => ({ id: 'c1', kind: { chip: name }, x: 0, y: 0 })
    const chips: Record<string, Chip> = {
      HA: { name: 'HA', inputs: ['A', 'B'], outputs: ['C', 'S'], circuit: ha.reference },
      FA: { name: 'FA', inputs: [], outputs: [], circuit: { nodes: [chipNode('HA')], wires: [] } },
    }
    expect(refersToChip({ nodes: [chipNode('HA')], wires: [] }, 'HA', chips)).toBe(true)
    expect(refersToChip({ nodes: [chipNode('FA')], wires: [] }, 'HA', chips)).toBe(true)
    expect(refersToChip(ha.reference, 'HA', chips)).toBe(false)
  })

  it('next node id fills the smallest free number', () => {
    const c: Circuit = { nodes: [{ id: 'g1', kind: 'AND', x: 0, y: 0 }, { id: 'g3', kind: 'AND', x: 0, y: 0 }], wires: [] }
    expect(nextNodeId(c, 'g')).toBe('g2')
  })

  it('drafts are used only when their IN/OUT nodes match the spec', () => {
    expect(usableDraft(ha.reference, ha.spec)).toBe(true)
    expect(usableDraft({ nodes: [], wires: [] }, ha.spec)).toBe(false)
    expect(usableDraft(undefined, ha.spec)).toBe(false)
  })

  it('reads query flags from search or hash', () => {
    expect(hasQueryFlag('?autofill=1', '#/room/x', 'autofill')).toBe(true)
    expect(hasQueryFlag('', '#/room/x?autofill=1', 'autofill')).toBe(true)
    expect(hasQueryFlag('', '#/room/x', 'autofill')).toBe(false)
  })

  it('router ignores a query in the hash', () => {
    expect(parseHash('#/room/sw-3-r1?autofill=1')).toEqual({ name: 'room', roomId: 'sw-3-r1' })
  })
})

import { checkCode, checkNumber, dragSelection } from '../../src/ui/lab/labLogic'

describe('number and code checks', () => {
  it('exact normalises spaces and case', () => {
    expect(checkNumber('exact', ' 1011 0101 ', '10110101')).toBe(true)
    expect(checkNumber('exact', 'ff', 'FF')).toBe(true)
    expect(checkNumber('exact', '1011', '10110101')).toBe(false)
  })
  it('numeric compares values', () => {
    expect(checkNumber('numeric', '0.50', '0.5')).toBe(true)
    expect(checkNumber('numeric', 'abc', '0.5')).toBe(false)
    expect(checkNumber('numeric', '', '0')).toBe(false)
  })
  it('code room checks every input against encode (inline fixture)', () => {
    const encode = (b: string) => b.split('').reverse().join('')
    const inputs = ['0011', '1000']
    expect(checkCode(encode, inputs, ['1100', '0001'])).toEqual([true, true])
    expect(checkCode(encode, inputs, ['1100', '0 0 0 1'])).toEqual([true, true])
    expect(checkCode(encode, inputs, ['1100', '1000'])).toEqual([true, false])
    expect(checkCode(encode, inputs, ['1100'])).toEqual([true, false])
  })
})

describe('k-map drag selection', () => {
  it('plain drag is the rectangle; shift wraps through the edge', () => {
    expect(dragSelection([0, 0], [1, 2], 4, 4, false)).toEqual({ rows: [0, 1], cols: [0, 1, 2] })
    expect(dragSelection([0, 0], [3, 3], 4, 4, true)).toEqual({ rows: [3, 0], cols: [3, 0] })
    expect(dragSelection([2, 1], [2, 1], 4, 4, true)).toEqual({ rows: [2], cols: [1] })
  })
})
