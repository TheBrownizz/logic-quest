import { describe, it, expect } from 'vitest'
import { layoutStateDiagram, NODE_R } from '../../src/ui/schematic/stateDiagram'
import { fsmFromRows, stateTable } from '../../src/logic/fsm'

// Moed-B style 4-state Mealy machine (rows: next[s][x], out[s][x])
const mealy = stateTable(fsmFromRows({ stateVars: ['A', 'B'], inputs: ['X'], outputs: ['Y'], next: [[2, 2], [1, 3], [3, 3], [1, 0]], out: [[0, 1], [1, 1], [0, 0], [0, 0]] }))
// a 3-state Moore machine in 2 bits (code 3 unused)
const moore = stateTable(fsmFromRows({ stateVars: ['A', 'B'], inputs: ['X'], outputs: ['Z'], next: [[0, 1], [0, 2], [0, 2]], out: [[0, 0], [0, 0], [1, 1]], used: [0, 1, 2] }))
const dist = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y)

describe('layoutStateDiagram', () => {
  it('one node per used state, one edge per (from, to) pair, endpoints on the circles', () => {
    const d = layoutStateDiagram(mealy)
    expect(d.nodes.map(n => n.name)).toEqual(['S0', 'S1', 'S2', 'S3'])
    const pairs = new Set(mealy.rows.map(r => `${r.state}>${r.next}`))
    expect(d.edges).toHaveLength(pairs.size)
    for (const e of d.edges) {
      const a = d.nodes.find(n => n.code === e.from)!, b = d.nodes.find(n => n.code === e.to)!
      expect(dist(e.start, a)).toBeCloseTo(NODE_R, 0)
      expect(dist(e.end, b)).toBeCloseTo(NODE_R, 0)
    }
  })
  it('Mealy: outputs on the arrows; self loops for states that stay', () => {
    const d = layoutStateDiagram(mealy)
    const e = d.edges.find(x => x.from === 0 && x.to === 2)!
    expect(e.label).toBe('0/0, 1/1')
    expect(d.edges.find(x => x.from === 1 && x.to === 1)!.self).toBe(true)
    expect(d.nodes[0].sub).toBe('00')
  })
  it('Moore: the output sits in the state, arrows carry inputs only; unused codes are not drawn', () => {
    const d = layoutStateDiagram(moore)
    expect(d.nodes.map(n => n.code)).toEqual([0, 1, 2])
    expect(d.nodes[2].sub).toBe('10/1')
    expect(d.edges.find(x => x.from === 0 && x.to === 0)!.label).toBe('0')
    expect(d.edges.every(x => !x.label.includes('/'))).toBe(true)
  })
  it('a Mealy table cannot be drawn as Moore; the box contains every node', () => {
    expect(() => layoutStateDiagram(mealy, { kind: 'moore' })).toThrow(/Mealy/)
    const d = layoutStateDiagram(mealy)
    for (const n of d.nodes) {
      expect(n.x - NODE_R).toBeGreaterThanOrEqual(d.box.x)
      expect(n.y + NODE_R).toBeLessThanOrEqual(d.box.y + d.box.h)
    }
  })
})
