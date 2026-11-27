import type { LabPuzzle, Room, Stage, World } from '../../content/types'
import type { RoomResult } from '../../game/progress'
import { matches, type Bit, type TruthTable } from '../../logic/boolean'
import {
  circuitTruthTable, evalGate, gateCount, simulate, usesOnly,
  type Chip, type Circuit, type CircuitError, type Node,
} from '../../logic/circuit'
import { worlds } from '../worlds'

export type Chips = Record<string, Chip>
export type CircuitPuzzle = Extract<LabPuzzle, { type: 'circuit' }>

export function findRoom(roomId: string): { world: World; stage: Stage; room: Room } | undefined {
  for (const entry of worlds) {
    for (const stage of entry.world?.stages ?? []) {
      const room = stage.rooms.find(r => r.id === roomId)
      if (room && entry.world) return { world: entry.world, stage, room }
    }
  }
  return undefined
}

/* ---------- layout ---------- */

export const COL = 150
export const ROW = 90
const LEFT = 60
const TOP = 70

const isChipKind = (k: Node['kind']): k is { chip: string } => typeof k === 'object'

/** The starting circuit: IN nodes on the left edge, OUT nodes on the right edge. */
export function initialCircuit(spec: TruthTable, width = 960): Circuit {
  const col = (names: string[], kind: 'IN' | 'OUT', x: number): Node[] => {
    const top = TOP + Math.max(0, (4 - names.length) * ROW) / 2
    return names.map((name, i) => ({ id: name, kind, label: name, x, y: top + i * ROW }))
  }
  return { nodes: [...col(spec.inputs, 'IN', LEFT), ...col(spec.outputs, 'OUT', width - LEFT)], wires: [] }
}

/** True when every node sits on the same spot (content circuits are authored without positions). */
export function needsLayout(c: Circuit): boolean {
  return c.nodes.length > 1 && c.nodes.every(n => n.x === c.nodes[0].x && n.y === c.nodes[0].y)
}

/** Columns by longest path from the inputs; OUT nodes share the last column. */
export function autoLayout(c: Circuit): Circuit {
  const preds = new Map<string, string[]>()
  for (const w of c.wires) preds.set(w.to.node, [...(preds.get(w.to.node) ?? []), w.from.node])
  const depth = new Map<string, number>()
  const visiting = new Set<string>()
  const d = (id: string): number => {
    const known = depth.get(id)
    if (known !== undefined) return known
    if (visiting.has(id)) return 0
    visiting.add(id)
    const node = c.nodes.find(n => n.id === id)
    const v = node?.kind === 'IN' ? 0 : Math.max(0, ...(preds.get(id) ?? []).map(p => d(p) + 1))
    visiting.delete(id)
    depth.set(id, v)
    return v
  }
  c.nodes.forEach(n => d(n.id))
  const maxGate = Math.max(1, ...c.nodes.filter(n => n.kind !== 'OUT').map(n => depth.get(n.id)!))
  for (const n of c.nodes) if (n.kind === 'OUT') depth.set(n.id, maxGate + 1)
  else if (n.kind === 'IN') depth.set(n.id, 0)

  const cols = new Map<number, Node[]>()
  for (const n of c.nodes) cols.set(depth.get(n.id)!, [...(cols.get(depth.get(n.id)!) ?? []), n])
  const tallest = Math.max(...[...cols.values()].map(l => l.length))
  const y = new Map<string, number>()
  for (const k of [...cols.keys()].sort((a, b) => a - b)) {
    const list = cols.get(k)!
    // order by the average height of predecessors to keep wires short
    const bary = (n: Node) => {
      const ps = (preds.get(n.id) ?? []).map(p => y.get(p)).filter((v): v is number => v !== undefined)
      return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : 0
    }
    if (k > 0) list.sort((a, b) => bary(a) - bary(b))
    const top = TOP + ((tallest - list.length) * ROW) / 2
    list.forEach((n, i) => y.set(n.id, top + i * ROW))
  }
  return {
    nodes: c.nodes.map(n => ({ ...n, x: LEFT + depth.get(n.id)! * COL, y: y.get(n.id)! })),
    wires: c.wires,
  }
}

export function nextNodeId(c: Circuit, prefix: string): string {
  const used = new Set(c.nodes.map(n => n.id))
  for (let i = 1; ; i++) if (!used.has(`${prefix}${i}`)) return `${prefix}${i}`
}

/** A saved draft is usable when it still has exactly the spec's IN and OUT nodes. */
export function usableDraft(draft: Circuit | undefined, spec: TruthTable): draft is Circuit {
  if (!draft || !Array.isArray(draft.nodes) || !Array.isArray(draft.wires)) return false
  const labels = (kind: 'IN' | 'OUT') => draft.nodes.filter(n => n.kind === kind).map(n => n.label ?? n.id).sort().join('|')
  return labels('IN') === [...spec.inputs].sort().join('|') && labels('OUT') === [...spec.outputs].sort().join('|')
}

export function hasQueryFlag(search: string, hash: string, name: string): boolean {
  const q = hash.includes('?') ? hash.slice(hash.indexOf('?')) : ''
  return [search, q].some(s => new URLSearchParams(s).get(name) === '1')
}

/* ---------- checking ---------- */

export type CheckResult =
  | { kind: 'ok'; gates: number; optimal: boolean }
  | { kind: 'mismatch'; actual: TruthTable; row: number; output: string }
  | { kind: 'error'; error: CircuitError }
  | { kind: 'disallowed' }
  | { kind: 'crash' }

/** Reorders `actual`'s columns and rows to follow the spec's input and output order. */
export function alignTable(spec: Pick<TruthTable, 'inputs' | 'outputs'>, actual: TruthTable): TruthTable {
  const n = spec.inputs.length
  const rows = Array.from({ length: 1 << n }, (_, i) => {
    let idx = 0
    actual.inputs.forEach((name, j) => {
      const k = spec.inputs.indexOf(name)
      const bit = k < 0 ? 0 : (i >> (n - 1 - k)) & 1
      idx |= bit << (actual.inputs.length - 1 - j)
    })
    return spec.outputs.map(o => actual.rows[idx]?.[actual.outputs.indexOf(o)] ?? 0)
  })
  return { inputs: [...spec.inputs], outputs: [...spec.outputs], rows }
}

export function checkCircuit(c: Circuit, puzzle: CircuitPuzzle, chips: Chips): CheckResult {
  try {
    if (!usesOnly(c, puzzle.allowed, chips)) return { kind: 'disallowed' }
    const t = circuitTruthTable(c, chips)
    if ('error' in t) return { kind: 'error', error: t.error }
    const actual = alignTable(puzzle.spec, t)
    const m = matches(puzzle.spec, actual)
    if (!m.ok) return { kind: 'mismatch', actual, row: m.firstMismatch!.row, output: m.firstMismatch!.output }
    const gates = gateCount(c, chips)
    return { kind: 'ok', gates, optimal: gates <= puzzle.optimalGates }
  } catch {
    return { kind: 'crash' }
  }
}

/** True when `c` uses chip `name`, directly or inside another chip (saving it as `name` would create a cycle). */
export function refersToChip(c: Circuit, name: string, chips: Chips, seen = new Set<string>()): boolean {
  for (const n of c.nodes) {
    if (!isChipKind(n.kind)) continue
    const k = n.kind.chip
    if (k === name) return true
    if (seen.has(k)) continue
    seen.add(k)
    const inner = chips[k]
    if (inner && refersToChip(inner.circuit, name, chips, seen)) return true
  }
  return false
}

export function mergeResult(prev: RoomResult | undefined, cur: RoomResult): RoomResult {
  return {
    solved: !!prev?.solved || cur.solved,
    optimal: !!prev?.optimal || cur.optimal,
    noHints: !!prev?.noHints || cur.noHints,
  }
}

export const errorText: Record<CircuitError['kind'], string> = {
  loop: 'מעגל עם משוב',
  unconnected: 'כניסה לא מחוברת',
  multiDriven: 'שני חוטים לאותה כניסה',
}

/* ---------- live values ---------- */

export type Live = Record<string, Bit[] | undefined>

/**
 * Output values of every node that can be computed from the current inputs.
 * Unlike `simulate`, parts that are still unconnected (or in a loop) are just left undefined,
 * so wires glow while the circuit is half built.
 */
export function liveValues(c: Circuit, inputs: Record<string, Bit>, chips: Chips): Live {
  const incoming = new Map<string, Map<number, string>>()
  c.wires.forEach(w => {
    const m = incoming.get(w.to.node) ?? new Map<number, string>()
    m.set(w.to.pin, `${w.from.node}:${w.from.pin}`)
    incoming.set(w.to.node, m)
  })
  const vals: Live = {}
  const state = new Map<string, 'busy' | 'done'>()
  const byId = new Map(c.nodes.map(n => [n.id, n]))

  const need = (n: Node): number | undefined => {
    if (n.kind === 'IN') return 0
    if (n.kind === 'OUT' || n.kind === 'NOT') return 1
    if (isChipKind(n.kind)) return chips[n.kind.chip]?.inputs.length
    const m = incoming.get(n.id)
    return m ? Math.max(2, m.size) : 2
  }

  const visit = (id: string): Bit[] | undefined => {
    const st = state.get(id)
    if (st === 'done') return vals[id]
    if (st === 'busy') return undefined
    state.set(id, 'busy')
    const n = byId.get(id)
    let out: Bit[] | undefined
    if (n) {
      const k = need(n)
      const m = incoming.get(id) ?? new Map<number, string>()
      const ins: Bit[] = []
      let ok = k !== undefined
      for (let p = 0; ok && p < k!; p++) {
        const src = m.get(p)
        if (!src) { ok = false; break }
        const [node, pin] = src.split(':')
        const v = visit(node)?.[Number(pin)]
        if (v === undefined) ok = false
        else ins.push(v)
      }
      if (ok && m.size > k!) ok = false
      if (n.kind === 'IN') out = inputs[n.label ?? n.id] !== undefined ? [inputs[n.label ?? n.id]] : undefined
      else if (!ok) out = undefined
      else if (n.kind === 'OUT') out = [ins[0]]
      else if (isChipKind(n.kind)) {
        const chip = chips[n.kind.chip]
        try {
          const arg: Record<string, Bit> = {}
          chip.inputs.forEach((name, i) => { arg[name] = ins[i] })
          const r = simulate(chip.circuit, arg, chips, [chip.name])
          out = 'error' in r ? undefined : chip.outputs.map(o => r.outputs[o])
        } catch { out = undefined }
      } else out = [evalGate(n.kind, ins)]
    }
    vals[id] = out
    state.set(id, 'done')
    return out
  }
  c.nodes.forEach(n => visit(n.id))
  return vals
}

const normalise = (s: string) => s.replace(/\s+/g, '').toUpperCase()

/** 'exact' ignores spaces and case; 'numeric' compares values (tolerance 1e-9). */
export function checkNumber(mode: 'exact' | 'numeric', given: string, answer: string): boolean {
  if (mode === 'exact') return normalise(given) === normalise(answer)
  // plain decimal notation only: no hex, no trailing junk, no empty string
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(given.trim())) return false
  const a = Number(given.trim())
  const b = Number(answer.trim())
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9
}

/** Per input, whether the typed output bits equal `encode(input)`. */
export function checkCode(encode: (bits: string) => string, inputs: string[], given: string[]): boolean[] {
  return inputs.map((inp, i) => normalise(given[i] ?? '') === normalise(encode(inp)))
}

/** Rows and columns of the rectangle between two cells (a plain, non-wrapping drag). */
export function dragSelection(a: [number, number], b: [number, number]): { rows: number[]; cols: number[] } {
  const axis = (x: number, y: number) => {
    const out: number[] = []
    for (let i = Math.min(x, y); i <= Math.max(x, y); i++) out.push(i)
    return out
  }
  return { rows: axis(a[0], b[0]), cols: axis(a[1], b[1]) }
}

/** Truth tables longer than this show only a window of rows. */
export const TT_MAX_ROWS = 64

/** Row indices the truth panel shows: all of them for short tables, else `focus` (the mismatch or current row) ±3. */
export function visibleRows(total: number, focus?: number): number[] {
  if (total <= TT_MAX_ROWS) return Array.from({ length: total }, (_, i) => i)
  const f = Math.min(Math.max(focus ?? 0, 0), total - 1)
  const out: number[] = []
  for (let i = Math.max(0, f - 3); i <= Math.min(total - 1, f + 3); i++) out.push(i)
  return out
}
