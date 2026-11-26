import type { Bit, TruthTable } from './boolean'

export type GateKind = 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR' | 'XOR' | 'XNOR'

export interface Node {
  id: string
  kind: GateKind | 'IN' | 'OUT' | { chip: string }
  label?: string
  x: number
  y: number
  delay?: number
}

export interface Wire {
  from: { node: string; pin: number }
  to: { node: string; pin: number }
}

export interface Circuit {
  nodes: Node[]
  wires: Wire[]
}

/** A saved, reusable component. Inner IN/OUT labels equal `inputs`/`outputs`. */
export interface Chip {
  name: string
  inputs: string[]
  outputs: string[]
  circuit: Circuit
}

export type CircuitError = { kind: 'loop' | 'unconnected' | 'multiDriven'; nodeId: string }

type Chips = Record<string, Chip>

const isChip = (k: Node['kind']): k is { chip: string } => typeof k === 'object'

function getChip(node: Node, chips: Chips): Chip {
  const name = (node.kind as { chip: string }).chip
  const chip = chips[name]
  if (!chip) throw new Error(`Unknown chip: ${name}`)
  return chip
}

interface Analysis {
  /** Reachable nodes, sources first. */
  order: Node[]
  /** Incoming wires per node id, indexed by input pin. */
  inputs: Map<string, Wire[]>
}

function analyze(c: Circuit, chips: Chips): Analysis | { error: CircuitError } {
  const byId = new Map(c.nodes.map(nd => [nd.id, nd]))
  const incoming = new Map<string, Wire[]>()
  for (const wire of c.wires) {
    if (!byId.has(wire.from.node) || !byId.has(wire.to.node)) {
      throw new Error(`Wire references unknown node: ${wire.from.node} -> ${wire.to.node}`)
    }
    const list = incoming.get(wire.to.node) ?? []
    if (list.some(o => o.to.pin === wire.to.pin)) {
      return { error: { kind: 'multiDriven', nodeId: wire.to.node } }
    }
    list.push(wire)
    incoming.set(wire.to.node, list)
  }

  const pinsOf = new Map<string, Wire[]>()
  const required = (nd: Node): number | 'gate' => {
    if (nd.kind === 'IN') return 0
    if (nd.kind === 'OUT') return 1
    if (nd.kind === 'NOT') return 1
    if (isChip(nd.kind)) return getChip(nd, chips).inputs.length
    return 'gate'
  }

  const order: Node[] = []
  const state = new Map<string, 1 | 2>()
  let err: CircuitError | null = null

  const visit = (nd: Node): void => {
    if (err) return
    const st = state.get(nd.id)
    if (st === 2) return
    if (st === 1) {
      err = { kind: 'loop', nodeId: nd.id }
      return
    }
    const wires = incoming.get(nd.id) ?? []
    const need = required(nd)
    const maxPin = wires.reduce((m, x) => Math.max(m, x.to.pin), -1)
    const count = wires.length
    const ok = need === 'gate'
      ? count >= 2 && maxPin === count - 1
      : count === need && maxPin === need - 1 && wires.every(x => x.to.pin >= 0)
    if (!ok) {
      err = { kind: 'unconnected', nodeId: nd.id }
      return
    }
    state.set(nd.id, 1)
    const byPin: Wire[] = []
    for (const x of wires) byPin[x.to.pin] = x
    pinsOf.set(nd.id, byPin)
    for (const x of byPin) {
      visit(byId.get(x.from.node)!)
      if (err) return
    }
    state.set(nd.id, 2)
    order.push(nd)
  }

  for (const nd of c.nodes) if (nd.kind === 'OUT') visit(nd)
  if (err) return { error: err }
  return { order, inputs: pinsOf }
}

function evalGate(kind: GateKind, ins: Bit[]): Bit {
  switch (kind) {
    case 'NOT': return ins[0] ? 0 : 1
    case 'AND': return ins.every(b => b === 1) ? 1 : 0
    case 'NAND': return ins.every(b => b === 1) ? 0 : 1
    case 'OR': return ins.some(b => b === 1) ? 1 : 0
    case 'NOR': return ins.some(b => b === 1) ? 0 : 1
    case 'XOR': return (ins.reduce<number>((a, b) => a + b, 0) % 2) as Bit
    case 'XNOR': return (ins.reduce<number>((a, b) => a + b, 1) % 2) as Bit
  }
}

export function simulate(
  c: Circuit,
  inputs: Record<string, Bit>,
  chips: Chips = {},
): { outputs: Record<string, Bit> } | { error: CircuitError } {
  const a = analyze(c, chips)
  if ('error' in a) return a
  const vals = new Map<string, Bit[]>()
  const outputs: Record<string, Bit> = {}
  for (const nd of a.order) {
    const ins = (a.inputs.get(nd.id) ?? []).map(x => vals.get(x.from.node)![x.from.pin])
    if (nd.kind === 'IN') {
      vals.set(nd.id, [inputs[nd.label ?? nd.id] ?? 0])
    } else if (nd.kind === 'OUT') {
      vals.set(nd.id, [ins[0]])
      outputs[nd.label ?? nd.id] = ins[0]
    } else if (isChip(nd.kind)) {
      const chip = getChip(nd, chips)
      const arg: Record<string, Bit> = {}
      chip.inputs.forEach((name, i) => { arg[name] = ins[i] })
      const r = simulate(chip.circuit, arg, chips)
      if ('error' in r) return { error: { kind: r.error.kind, nodeId: nd.id } }
      vals.set(nd.id, chip.outputs.map(name => r.outputs[name]))
    } else {
      vals.set(nd.id, [evalGate(nd.kind, ins)])
    }
  }
  return { outputs }
}

export function circuitTruthTable(
  c: Circuit,
  chips: Chips = {},
): TruthTable | { error: CircuitError } {
  const names = (kind: 'IN' | 'OUT') =>
    c.nodes.filter(nd => nd.kind === kind).map(nd => nd.label ?? nd.id).sort()
  const ins = names('IN')
  const outs = names('OUT')
  const rows: TruthTable['rows'] = []
  for (let i = 0; i < 1 << ins.length; i++) {
    const arg: Record<string, Bit> = {}
    ins.forEach((name, j) => { arg[name] = ((i >> (ins.length - 1 - j)) & 1) as Bit })
    const r = simulate(c, arg, chips)
    if ('error' in r) return r
    rows.push(outs.map(o => r.outputs[o]))
  }
  return { inputs: ins, outputs: outs, rows }
}

export function gateCount(c: Circuit, chips: Chips = {}): number {
  let total = 0
  for (const nd of c.nodes) {
    if (nd.kind === 'IN' || nd.kind === 'OUT') continue
    total += isChip(nd.kind) ? gateCount(getChip(nd, chips).circuit, chips) : 1
  }
  return total
}

export function usesOnly(c: Circuit, allowed: GateKind[], chips: Chips = {}): boolean {
  for (const nd of c.nodes) {
    if (nd.kind === 'IN' || nd.kind === 'OUT') continue
    if (isChip(nd.kind)) {
      if (!usesOnly(getChip(nd, chips).circuit, allowed, chips)) return false
    } else if (!allowed.includes(nd.kind)) return false
  }
  return true
}

function nodeDelay(nd: Node, chips: Chips): number {
  if (nd.delay !== undefined) return nd.delay
  if (isChip(nd.kind)) {
    const chip = getChip(nd, chips)
    const at = arrivalTimes(chip.circuit, chips)
    let max = 0
    for (const o of chip.circuit.nodes) if (o.kind === 'OUT') max = Math.max(max, at[o.id] ?? 0)
    return max
  }
  return 0
}

function mustAnalyze(c: Circuit, chips: Chips): Analysis {
  const a = analyze(c, chips)
  if ('error' in a) throw new Error(`Invalid circuit: ${a.error.kind} at ${a.error.nodeId}`)
  return a
}

/** Worst-case arrival per node. Throws on an invalid circuit. */
export function arrivalTimes(c: Circuit, chips: Chips = {}): Record<string, number> {
  const a = mustAnalyze(c, chips)
  const at: Record<string, number> = {}
  for (const nd of c.nodes) if (nd.kind === 'IN') at[nd.id] = 0
  for (const nd of a.order) {
    const ws = a.inputs.get(nd.id) ?? []
    at[nd.id] = ws.reduce((m, x) => Math.max(m, at[x.from.node]), 0) + nodeDelay(nd, chips)
  }
  return at
}

/** Node ids from an IN node to `outputNodeId`, following the max-arrival predecessor. */
export function criticalPath(c: Circuit, outputNodeId: string, chips: Chips = {}): string[] {
  const a = mustAnalyze(c, chips)
  const at = arrivalTimes(c, chips)
  const path = [outputNodeId]
  let cur = outputNodeId
  for (;;) {
    const ws = a.inputs.get(cur) ?? []
    if (ws.length === 0) break
    let best = ws[0]
    for (const x of ws) if (at[x.from.node] > at[best.from.node]) best = x
    cur = best.from.node
    path.push(cur)
  }
  return path.reverse()
}
