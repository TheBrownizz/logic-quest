import { describe, it, expect } from 'vitest'
import {
  simulate, circuitTruthTable, gateCount, usesOnly, arrivalTimes, criticalPath,
  type Circuit, type Node, type Wire, type Chip, type GateKind, type CircuitError,
} from '../../src/logic/circuit'
import type { Bit } from '../../src/logic/boolean'

const n = (id: string, kind: Node['kind'], extra: Partial<Node> = {}): Node => ({ id, kind, x: 0, y: 0, ...extra })
const inp = (id: string, label = id) => n(id, 'IN', { label })
const out = (id: string, label = id) => n(id, 'OUT', { label })
const w = (from: string, to: string, pin = 0, fromPin = 0): Wire => ({ from: { node: from, pin: fromPin }, to: { node: to, pin } })

function halfAdderNand(): Circuit {
  return {
    nodes: [inp('A'), inp('B'), n('n1', 'NAND'), n('n2', 'NAND'), n('n3', 'NAND'), n('n4', 'NAND'), n('n5', 'NAND'), out('S'), out('C')],
    wires: [
      w('A', 'n1', 0), w('B', 'n1', 1),
      w('A', 'n2', 0), w('n1', 'n2', 1),
      w('B', 'n3', 0), w('n1', 'n3', 1),
      w('n2', 'n4', 0), w('n3', 'n4', 1),
      w('n1', 'n5', 0), w('n1', 'n5', 1),
      w('n4', 'S'), w('n5', 'C'),
    ],
  }
}

const halfAdderChip: Chip = {
  name: 'HA', inputs: ['A', 'B'], outputs: ['C', 'S'],
  circuit: {
    nodes: [inp('A'), inp('B'), n('x', 'XOR'), n('a', 'AND'), out('S'), out('C')],
    wires: [w('A', 'x', 0), w('B', 'x', 1), w('A', 'a', 0), w('B', 'a', 1), w('x', 'S'), w('a', 'C')],
  },
}

function faCircuit(): Circuit {
  return {
    nodes: [inp('A'), inp('B'), inp('Cin'), n('h1', { chip: 'HA' }), n('h2', { chip: 'HA' }), n('o', 'OR'), out('S'), out('Cout')],
    wires: [
      w('A', 'h1', 0), w('B', 'h1', 1),
      w('h1', 'h2', 0, 1), w('Cin', 'h2', 1),
      w('h2', 'S', 0, 1),
      w('h1', 'o', 0, 0), w('h2', 'o', 1, 0),
      w('o', 'Cout'),
    ],
  }
}
const faChip: Chip = { name: 'FA', inputs: ['A', 'B', 'Cin'], outputs: ['Cout', 'S'], circuit: faCircuit() }
const chips = { HA: halfAdderChip, FA: faChip }

function adderSub(): Circuit {
  const nodes: Node[] = [inp('M')]
  const wires: Wire[] = []
  for (let i = 0; i < 4; i++) {
    nodes.push(inp(`A${i}`), inp(`B${i}`), n(`X${i}`, 'XOR', { delay: 75 }), n(`F${i}`, { chip: 'FA' }, { delay: 100 }), out(`S${i}`))
    wires.push(w(`B${i}`, `X${i}`, 0), w('M', `X${i}`, 1))
    wires.push(w(`A${i}`, `F${i}`, 0), w(`X${i}`, `F${i}`, 1))
    wires.push(i === 0 ? w('M', 'F0', 2) : w(`F${i - 1}`, `F${i}`, 2, 0))
    wires.push(w(`F${i}`, `S${i}`, 0, 1))
  }
  nodes.push(n('V', 'XOR', { delay: 75 }), out('OV', 'V'))
  wires.push(w('F2', 'V', 0, 0), w('F3', 'V', 1, 0), w('V', 'OV'))
  return { nodes, wires }
}

const bitsOf = (v: number, p: string): Record<string, Bit> => {
  const r: Record<string, Bit> = {}
  for (let i = 0; i < 4; i++) r[`${p}${i}`] = ((v >> i) & 1) as Bit
  return r
}
const run = (a: number, b: number, m: Bit) => {
  const r = simulate(adderSub(), { ...bitsOf(a, 'A'), ...bitsOf(b, 'B'), M: m }, chips)
  if ('error' in r) throw new Error('err')
  let s = 0
  for (let i = 0; i < 4; i++) s |= r.outputs[`S${i}`] << i
  return { s, v: r.outputs.V }
}

describe('circuit', () => {
  it('NAND half adder', () => {
    const c = halfAdderNand()
    const t = circuitTruthTable(c)
    if ('error' in t) throw new Error('err')
    expect(t.inputs).toEqual(['A', 'B'])
    expect(t.outputs).toEqual(['C', 'S'])
    expect(t.rows).toEqual([[0, 0], [0, 1], [0, 1], [1, 0]])
    expect(usesOnly(c, ['NAND'])).toBe(true)
    expect(usesOnly(c, ['AND'] as GateKind[])).toBe(false)
    expect(gateCount(c)).toBe(5)
  })

  it('cross-coupled NOR latch is a loop', () => {
    const c: Circuit = {
      nodes: [inp('S'), inp('R'), n('g1', 'NOR'), n('g2', 'NOR'), out('Q')],
      wires: [w('R', 'g1', 0), w('g2', 'g1', 1), w('S', 'g2', 0), w('g1', 'g2', 1), w('g1', 'Q')],
    }
    const r = simulate(c, { S: 0, R: 0 })
    expect('error' in r && r.error.kind).toBe('loop')
    expect(circuitTruthTable(c)).toMatchObject({ error: { kind: 'loop' } })
  })

  it('free input pin is unconnected', () => {
    const c: Circuit = {
      nodes: [inp('A'), n('g', 'AND'), out('Q')],
      wires: [w('A', 'g', 0), w('g', 'Q')],
    }
    const r = simulate(c, { A: 1 })
    expect(r).toEqual({ error: { kind: 'unconnected', nodeId: 'g' } satisfies CircuitError })
  })

  it('missing middle pin, unwired OUT, NOT with 2 pins', () => {
    const gap: Circuit = {
      nodes: [inp('A'), inp('B'), n('g', 'OR'), out('Q')],
      wires: [w('A', 'g', 0), w('B', 'g', 2), w('g', 'Q')],
    }
    expect(simulate(gap, { A: 0, B: 0 })).toMatchObject({ error: { kind: 'unconnected' } })
    const bare: Circuit = { nodes: [inp('A'), out('Q')], wires: [] }
    expect(simulate(bare, { A: 0 })).toEqual({ error: { kind: 'unconnected', nodeId: 'Q' } })
    const not2: Circuit = {
      nodes: [inp('A'), inp('B'), n('g', 'NOT'), out('Q')],
      wires: [w('A', 'g', 0), w('B', 'g', 1), w('g', 'Q')],
    }
    expect(simulate(not2, { A: 0, B: 0 })).toMatchObject({ error: { kind: 'unconnected' } })
  })

  it('multiDriven and wide gates and NOT', () => {
    const md: Circuit = {
      nodes: [inp('A'), inp('B'), n('g', 'NOT'), out('Q')],
      wires: [w('A', 'g', 0), w('B', 'g', 0), w('g', 'Q')],
    }
    expect(simulate(md, { A: 0, B: 0 })).toEqual({ error: { kind: 'multiDriven', nodeId: 'g' } })
    const wide: Circuit = {
      nodes: [inp('A'), inp('B'), inp('C'), n('g', 'AND'), n('i', 'NOT'), out('Q'), out('R')],
      wires: [w('A', 'g', 0), w('B', 'g', 1), w('C', 'g', 2), w('g', 'Q'), w('g', 'i'), w('i', 'R')],
    }
    expect(simulate(wide, { A: 1, B: 1, C: 1 })).toEqual({ outputs: { Q: 1, R: 0 } })
    expect(simulate(wide, { A: 1, B: 0, C: 1 })).toEqual({ outputs: { Q: 0, R: 1 } })
    expect(gateCount(wide)).toBe(2)
  })

  it('unknown chip throws', () => {
    const c: Circuit = {
      nodes: [inp('A'), n('c', { chip: 'NOPE' }), out('Q')],
      wires: [w('A', 'c'), w('c', 'Q')],
    }
    expect(() => simulate(c, { A: 0 }, {})).toThrow()
  })

  it('full adder chip works and gateCount sums inner gates', () => {
    const t = circuitTruthTable(faCircuit(), chips)
    if ('error' in t) throw new Error('err')
    expect(t.outputs).toEqual(['Cout', 'S'])
    // inputs A,B,Cin: row index = A*4+B*2+Cin
    for (let i = 0; i < 8; i++) {
      const sum = (i >> 2) + ((i >> 1) & 1) + (i & 1)
      expect(t.rows[i]).toEqual([sum >> 1, sum & 1])
    }
    expect(gateCount(faCircuit(), chips)).toBe(2 + 2 + 1)
    expect(usesOnly(faCircuit(), ['XOR', 'AND', 'OR'], chips)).toBe(true)
    expect(usesOnly(faCircuit(), ['XOR', 'AND'], chips)).toBe(false)
  })

  it('chip without delay uses inner critical path', () => {
    const at = arrivalTimes(faCircuit(), { HA: { ...halfAdderChip, circuit: {
      ...halfAdderChip.circuit,
      nodes: halfAdderChip.circuit.nodes.map(x => x.id === 'x' ? { ...x, delay: 30 } : x.id === 'a' ? { ...x, delay: 10 } : x),
    } }, FA: faChip })
    expect(at['h1']).toBe(30)
    expect(at['h2']).toBe(60)
    expect(at['o']).toBe(60)
    expect(at['Cout']).toBe(60)
    expect(at['A']).toBe(0)
  })

  it('4-bit adder/subtractor arithmetic and delays', () => {
    expect(run(5, 3, 0)).toMatchObject({ s: 8 })
    expect(run(9, 6, 0)).toMatchObject({ s: 15 })
    expect(run(7, 2, 1)).toMatchObject({ s: 5 })
    expect(run(3, 5, 1)).toMatchObject({ s: 14 })
    const at = arrivalTimes(adderSub(), chips)
    expect(at['M']).toBe(0)
    expect(at['V']).toBe(550)
    expect(at['F0']).toBe(175)
    expect(at['F3']).toBe(475)
  })

  it('criticalPath', () => {
    const p = criticalPath(adderSub(), 'OV', chips)
    expect(p).toEqual(['B0', 'X0', 'F0', 'F1', 'F2', 'F3', 'V', 'OV'])
  })

  describe('guards', () => {
    const wrap = (name: string, inner: string): Chip => ({
      name, inputs: ['A'], outputs: ['Q'],
      circuit: { nodes: [inp('A'), n('c', { chip: inner }), out('Q')], wires: [w('A', 'c'), w('c', 'Q')] },
    })
    const top: Circuit = { nodes: [inp('A'), n('c', { chip: 'P' }), out('Q')], wires: [w('A', 'c'), w('c', 'Q')] }

    it('direct chip cycle throws', () => {
      const cs = { P: wrap('P', 'P') }
      expect(() => simulate(top, { A: 0 }, cs)).toThrow(/Chip cycle: P -> P/)
      expect(() => gateCount(top, cs)).toThrow(/Chip cycle/)
      expect(() => usesOnly(top, ['AND'], cs)).toThrow(/Chip cycle/)
      expect(() => arrivalTimes(top, cs)).toThrow(/Chip cycle/)
    })

    it('mutual chip cycle throws', () => {
      const cs = { P: wrap('P', 'R'), R: wrap('R', 'P') }
      expect(() => simulate(top, { A: 0 }, cs)).toThrow(/Chip cycle: P -> R -> P/)
      expect(() => gateCount(top, cs)).toThrow(/Chip cycle/)
      expect(() => usesOnly(top, ['AND'], cs)).toThrow(/Chip cycle/)
      expect(() => arrivalTimes(top, cs)).toThrow(/Chip cycle/)
    })

    it('missing top-level input throws', () => {
      expect(() => simulate(halfAdderNand(), { A: 1 })).toThrow(/B/)
    })

    it('chip input/output names must match inner IN/OUT', () => {
      const badIn: Chip = { ...halfAdderChip, inputs: ['A', 'Z'] }
      const c: Circuit = {
        nodes: [inp('A'), inp('B'), n('h', { chip: 'HA' }), out('S')],
        wires: [w('A', 'h', 0), w('B', 'h', 1), w('h', 'S', 0, 1)],
      }
      expect(() => simulate(c, { A: 1, B: 1 }, { HA: badIn })).toThrow()
      const badOut: Chip = { ...halfAdderChip, outputs: ['C', 'Z'] }
      expect(() => simulate(c, { A: 1, B: 1 }, { HA: badOut })).toThrow()
    })

    it('out-of-range from.pin throws', () => {
      const c: Circuit = {
        nodes: [inp('A'), n('g', 'NOT'), out('Q')],
        wires: [w('A', 'g', 0, 1), w('g', 'Q')],
      }
      expect(() => simulate(c, { A: 0 })).toThrow()
    })

    it('negative or fractional to.pin is unconnected', () => {
      const neg: Circuit = { nodes: [inp('A'), n('g', 'NOT'), out('Q')], wires: [w('A', 'g', -1), w('g', 'Q')] }
      expect(simulate(neg, { A: 0 })).toMatchObject({ error: { kind: 'unconnected' } })
      const frac: Circuit = { nodes: [inp('A'), n('g', 'NOT'), out('Q')], wires: [w('A', 'g', 0.5), w('g', 'Q')] }
      expect(simulate(frac, { A: 0 })).toMatchObject({ error: { kind: 'unconnected' } })
    })

    it('criticalPath on unknown node throws', () => {
      expect(() => criticalPath(halfAdderNand(), 'nope')).toThrow()
    })
  })
})
