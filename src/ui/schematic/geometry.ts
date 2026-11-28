import type { Netlist, SchGateKind, SchPart, SchWire } from './netlist'

/**
 * Pure geometry for a schematic: parts, wires, junction dots and labels as drawing primitives.
 * No DOM, so tests check the geometry directly; <Schematic> only renders the primitives.
 */

export interface Pt { x: number; y: number }
export type Prim =
  | { t: 'path'; d: string; cls: 'body' | 'line' | 'frame' | 'clock' | 'stub' }
  /** `hops`: points on this wire's horizontal runs where another net's vertical run crosses (drawn as a small arc). */
  | { t: 'wire'; net: string; points: Pt[]; hops: Pt[] }
  | { t: 'circle'; cx: number; cy: number; r: number; cls: 'bubble' | 'dot' | 'term' }
  | { t: 'text'; x: number; y: number; text: string; cls: 'label' | 'pin' | 'name'; anchor: 'start' | 'middle' | 'end' }
export interface SchLayout {
  /** The drawing's bounds (use as the SVG viewBox). */
  box: { x: number; y: number; w: number; h: number }
  prims: Prim[]
  /** Every pin by "partId.pin", absolute. */
  pins: Record<string, Pt>
}

/** Grid pitch: one column and one row in drawing units. */
export const CW = 120
export const RH = 60

/* ---------- gate bodies (IEEE distinctive shapes, 48 units tall, centred on 0,0) ---------- */

const AND_BODY = 'M-28,-22 H4 A22,22 0 0 1 4,22 H-28 Z'
const OR_BODY = 'M-30,-22 Q6,-22 28,0 Q6,22 -30,22 Q-18,0 -30,-22 Z'
const TRI_BODY = 'M-24,-18 L18,0 L-24,18 Z'
const GATES: Record<SchGateKind, { body: string; bubble?: number; xor?: boolean; end: number; back: number }> = {
  AND: { body: AND_BODY, end: 26, back: -28 },
  NAND: { body: AND_BODY, bubble: 31, end: 36, back: -28 },
  OR: { body: OR_BODY, end: 28, back: -22 },
  NOR: { body: OR_BODY, bubble: 33, end: 38, back: -22 },
  XOR: { body: OR_BODY, xor: true, end: 28, back: -30 },
  XNOR: { body: OR_BODY, xor: true, bubble: 33, end: 38, back: -30 },
  NOT: { body: TRI_BODY, bubble: 23, end: 28, back: -24 },
  BUF: { body: TRI_BODY, end: 18, back: -24 },
}
const PIN_IN = -44
const PIN_OUT = 44
const LATCH_H = 40
const FF_W = 36
const FF_H = 48

const r1 = (v: number) => Math.round(v * 100) / 100
/** Radius of a wire hop. */
export const HOP = 5

/** The SVG path of a wire: its polyline, with a small arc over each hop on a horizontal run. */
export function wirePath(points: Pt[], hops: Pt[]): string {
  let d = `M${points[0].x},${points[0].y}`
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    if (a.y === b.y) {
      const dir = b.x > a.x ? 1 : -1
      const on = hops.filter(h => h.y === a.y && (h.x - a.x) * dir > 0 && (b.x - h.x) * dir > 0).sort((p, q) => (p.x - q.x) * dir)
      for (const h of on) d += ` H${h.x - dir * HOP} A${HOP} ${HOP} 0 0 ${dir > 0 ? 1 : 0} ${h.x + dir * HOP},${h.y}`
    }
    d += a.y === b.y ? ` H${b.x}` : ` V${b.y}`
  }
  return d
}

/** Every point an absolute path (M, L, Q, H, V, A, Z, as written here) passes through or bends at. */
export function pathPoints(d: string): Pt[] {
  const tokens = d.match(/[MLQHVAZ]|-?\d*\.?\d+/g) ?? []
  const out: Pt[] = []
  let cmd = ''
  let args: number[] = []
  let cur: Pt = { x: 0, y: 0 }
  const flush = () => {
    if (cmd === 'H') { for (const x of args) { cur = { x, y: cur.y }; out.push(cur) } }
    else if (cmd === 'V') { for (const y of args) { cur = { x: cur.x, y }; out.push(cur) } }
    else if (cmd === 'A') { if (args.length >= 7) { cur = { x: args[5], y: args[6] }; out.push(cur) } }
    else if (cmd && cmd !== 'Z') for (let i = 0; i + 1 < args.length; i += 2) { cur = { x: args[i], y: args[i + 1] }; out.push(cur) }
  }
  for (const t of tokens) {
    if (/^[A-Z]$/.test(t)) { flush(); cmd = t; args = [] } else args.push(Number(t))
  }
  flush()
  return out
}

/** Moves an SVG path made of absolute M, L, Q, H, V, A and Z commands by (dx, dy); points stay "x,y" pairs. */
export function shift(d: string, dx: number, dy: number): string {
  const tokens = d.match(/[MLQHVAZ]|-?\d*\.?\d+/g) ?? []
  const out: string[] = []
  let cmd = ''
  let args: number[] = []
  const flush = () => {
    if (!cmd) return
    const a = args
    switch (cmd) {
      case 'H': out.push(`H${r1(a[0] + dx)}`); break
      case 'V': out.push(`V${r1(a[0] + dy)}`); break
      case 'A': out.push(`A${a[0]} ${a[1]} ${a[2]} ${a[3]} ${a[4]} ${r1(a[5] + dx)},${r1(a[6] + dy)}`); break
      case 'Z': out.push('Z'); break
      default: {
        const pts: string[] = []
        for (let i = 0; i + 1 < a.length; i += 2) pts.push(`${r1(a[i] + dx)},${r1(a[i + 1] + dy)}`)
        out.push(cmd + pts.join(' '))
      }
    }
  }
  for (const t of tokens) {
    if (/^[A-Z]$/.test(t)) { flush(); cmd = t; args = [] } else args.push(Number(t))
  }
  flush()
  return out.join(' ')
}

const gateInputs = (p: Extract<SchPart, { kind: SchGateKind }>) => (p.kind === 'NOT' || p.kind === 'BUF' ? 1 : p.inputs ?? 2)
const inYs = (k: number) => (k === 1 ? [0] : k === 2 ? [-10, 10] : [-14, 0, 14])

interface Placed { part: SchPart; c: Pt; top: number; bottom: number; ins: Record<string, Pt>; outs: Record<string, Pt> }

/** Draws one gate at (cx, cy) whose inputs sit at the given offsets; returns its pins (relative names). */
function drawGate(kind: SchGateKind, cx: number, cy: number, ys: number[], prims: Prim[]): { ins: Pt[]; out: Pt } {
  const g = GATES[kind]
  const ins = ys.map(y => ({ x: cx + PIN_IN, y: cy + y }))
  for (const p of ins) prims.push({ t: 'path', d: `M${p.x},${p.y} H${cx + g.back + (kind === 'OR' || kind === 'NOR' ? 4 : 0)}`, cls: 'stub' })
  prims.push({ t: 'path', d: shift(g.body, cx, cy), cls: 'body' })
  if (g.xor) prims.push({ t: 'path', d: shift('M-37,-22 Q-25,0 -37,22', cx, cy), cls: 'line' })
  if (g.bubble !== undefined) prims.push({ t: 'circle', cx: cx + g.bubble, cy, r: 5, cls: 'bubble' })
  const out = { x: cx + PIN_OUT, y: cy }
  prims.push({ t: 'path', d: `M${cx + g.end},${cy} H${out.x}`, cls: 'stub' })
  return { ins, out }
}

function place(p: SchPart, prims: Prim[]): Placed {
  const c = { x: p.at[0] * CW, y: p.at[1] * RH }
  const ins: Record<string, Pt> = {}
  const outs: Record<string, Pt> = {}
  switch (p.kind) {
    case 'in':
      outs.out = c
      prims.push({ t: 'circle', cx: c.x, cy: c.y, r: 3, cls: 'term' })
      prims.push({ t: 'text', x: c.x - 9, y: c.y, text: p.label, cls: 'label', anchor: 'end' })
      return { part: p, c, top: c.y - 10, bottom: c.y + 10, ins, outs }
    case 'out':
      ins.in = c
      prims.push({ t: 'circle', cx: c.x, cy: c.y, r: 3, cls: 'term' })
      prims.push({ t: 'text', x: c.x + 9, y: c.y, text: p.label, cls: 'label', anchor: 'start' })
      return { part: p, c, top: c.y - 10, bottom: c.y + 10, ins, outs }
    case 'latch': {
      const L = LATCH_H
      const top = drawGate(p.gate, c.x, c.y - L, [-10, 10], prims)
      const bot = drawGate(p.gate, c.x, c.y + L, [-10, 10], prims)
      const xr = c.x + 58
      const xl = c.x - 58
      // the X: each output feeds the other gate's inner input
      prims.push({ t: 'path', d: `M${xr},${c.y - L} V${c.y - L + 16} L${xl},${c.y + L - 26} V${c.y + L - 10} H${bot.ins[0].x}`, cls: 'line' })
      prims.push({ t: 'path', d: `M${xr},${c.y + L} V${c.y + L - 16} L${xl},${c.y - L + 26} V${c.y - L + 10} H${top.ins[1].x}`, cls: 'line' })
      prims.push({ t: 'circle', cx: xr, cy: c.y - L, r: 3.5, cls: 'dot' })
      prims.push({ t: 'circle', cx: xr, cy: c.y + L, r: 3.5, cls: 'dot' })
      ins.a = { x: c.x - 64, y: top.ins[0].y }
      ins.b = { x: c.x - 64, y: bot.ins[1].y }
      prims.push({ t: 'path', d: `M${ins.a.x},${ins.a.y} H${top.ins[0].x}`, cls: 'stub' })
      prims.push({ t: 'path', d: `M${ins.b.x},${ins.b.y} H${bot.ins[1].x}`, cls: 'stub' })
      outs.Q = { x: c.x + 76, y: c.y - L }
      outs.Qn = { x: c.x + 76, y: c.y + L }
      prims.push({ t: 'path', d: `M${top.out.x},${top.out.y} H${outs.Q.x}`, cls: 'stub' })
      prims.push({ t: 'path', d: `M${bot.out.x},${bot.out.y} H${outs.Qn.x}`, cls: 'stub' })
      return { part: p, c, top: c.y - L - 24, bottom: c.y + L + 24, ins, outs }
    }
    case 'ff': {
      const x0 = c.x - FF_W, x1 = c.x + FF_W, y0 = c.y - FF_H, y1 = c.y + FF_H
      prims.push({ t: 'path', d: `M${x0},${y0} H${x1} V${y1} H${x0} Z`, cls: 'body' })
      const two = p.ff === 'JK' || p.ff === 'SR'
      const names = p.ff === 'JK' ? ['J', 'K'] : p.ff === 'SR' ? ['S', 'R'] : [p.ff]
      const ys = two ? [-28, 28] : [-24]
      const cy = two ? 0 : 24
      names.forEach((n, i) => {
        ins[n] = { x: c.x - 56, y: c.y + ys[i] }
        prims.push({ t: 'path', d: `M${ins[n].x},${ins[n].y} H${x0}`, cls: 'stub' })
        prims.push({ t: 'text', x: x0 + 6, y: c.y + ys[i], text: n, cls: 'pin', anchor: 'start' })
      })
      ins.C = { x: c.x - 56, y: c.y + cy }
      const edge = p.clock === 'rise' || p.clock === 'fall'
      const bubble = p.clock === 'fall' || p.clock === 'low'
      prims.push({ t: 'path', d: `M${ins.C.x},${ins.C.y} H${bubble ? x0 - 10 : x0}`, cls: 'stub' })
      if (bubble) prims.push({ t: 'circle', cx: x0 - 5, cy: c.y + cy, r: 5, cls: 'bubble' })
      if (edge) prims.push({ t: 'path', d: `M${x0},${c.y + cy - 7} L${x0 + 10},${c.y + cy} L${x0},${c.y + cy + 7}`, cls: 'clock' })
      else prims.push({ t: 'text', x: x0 + 6, y: c.y + cy, text: 'C', cls: 'pin', anchor: 'start' })
      outs.Q = { x: c.x + 56, y: c.y - 28 }
      outs.Qn = { x: c.x + 56, y: c.y + 28 }
      prims.push({ t: 'path', d: `M${x1},${outs.Q.y} H${outs.Q.x}`, cls: 'stub' })
      prims.push({ t: 'path', d: `M${x1},${outs.Qn.y} H${outs.Qn.x}`, cls: 'stub' })
      prims.push({ t: 'text', x: x1 - 6, y: outs.Q.y, text: 'Q', cls: 'pin', anchor: 'end' })
      prims.push({ t: 'text', x: x1 - 6, y: outs.Qn.y, text: "Q'", cls: 'pin', anchor: 'end' })
      if (p.name) prims.push({ t: 'text', x: c.x, y: y1 + 14, text: p.name, cls: 'name', anchor: 'middle' })
      return { part: p, c, top: y0, bottom: y1 + (p.name ? 20 : 0), ins, outs }
    }
    default: {
      const g = drawGate(p.kind, c.x, c.y, inYs(gateInputs(p)), prims)
      g.ins.forEach((q, i) => { ins[String(i)] = q })
      outs.out = g.out
      return { part: p, c, top: c.y - 24, bottom: c.y + 24, ins, outs }
    }
  }
}

const defaultOut = (p: SchPart) => (p.kind === 'in' || p.kind === 'out' || p.kind === 'latch' || p.kind === 'ff' ? (p.kind === 'in' ? 'out' : null) : 'out')
const defaultIn = (p: SchPart) => (p.kind === 'out' ? 'in' : p.kind === 'latch' || p.kind === 'ff' || p.kind === 'in' ? null : '0')

/** Drops repeated points and middle points of straight runs. */
function simplify(pts: Pt[]): Pt[] {
  const a = pts.filter((p, i) => i === 0 || p.x !== pts[i - 1].x || p.y !== pts[i - 1].y)
  return a.filter((p, i) => {
    if (i === 0 || i === a.length - 1) return true
    const q = a[i - 1], r = a[i + 1]
    return !((q.x === p.x && p.x === r.x) || (q.y === p.y && p.y === r.y))
  })
}

/** Points where a net branches: three or more directions leave the point along the net's segments. */
function junctions(paths: Pt[][]): Pt[] {
  const segs = paths.flatMap(ps => ps.slice(1).map((p, i) => [ps[i], p] as const))
  const cands = new Map<string, Pt>()
  for (const ps of paths) for (const p of ps) cands.set(`${p.x},${p.y}`, p)
  const out: Pt[] = []
  for (const p of cands.values()) {
    const dirs = new Set<string>()
    for (const [a, b] of segs) {
      const onX = a.x === b.x && p.x === a.x && p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y)
      const onY = a.y === b.y && p.y === a.y && p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x)
      if (!onX && !onY) continue
      for (const q of [a, b]) {
        if (q.x === p.x && q.y === p.y) continue
        dirs.add(q.x > p.x ? 'r' : q.x < p.x ? 'l' : q.y > p.y ? 'd' : 'u')
      }
    }
    if (dirs.size >= 3) out.push(p)
  }
  return out
}

/** Lays out a netlist. Throws on a duplicate part id, an unknown part or pin. */
export function layoutSchematic(n: Netlist): SchLayout {
  const prims: Prim[] = []
  const placed = new Map<string, Placed>()
  for (const p of n.parts) {
    if (placed.has(p.id)) throw new Error(`duplicate part id "${p.id}"`)
    placed.set(p.id, place(p, prims))
  }
  const pins: Record<string, Pt> = {}
  for (const [id, pl] of placed) {
    for (const [k, v] of Object.entries(pl.ins)) pins[`${id}.${k}`] = v
    for (const [k, v] of Object.entries(pl.outs)) pins[`${id}.${k}`] = v
  }
  const resolve = (ref: string, dir: 'from' | 'to'): { key: string; pt: Pt } => {
    const [id, pin] = ref.split('.', 2)
    const pl = placed.get(id)
    if (!pl) throw new Error(`wire: unknown part "${id}"`)
    const name = pin ?? (dir === 'from' ? defaultOut(pl.part) : defaultIn(pl.part))
    const pt = name === null ? undefined : (dir === 'from' ? pl.outs : pl.ins)[name]
    if (!pt) throw new Error(`wire: no ${dir === 'from' ? 'output' : 'input'} pin "${pin ? ref : `${ref}.?`}"`)
    return { key: `${id}.${name}`, pt }
  }

  const minY = Math.min(0, ...[...placed.values()].map(p => p.top))
  const maxY = Math.max(0, ...[...placed.values()].map(p => p.bottom))
  const resolved = n.wires.map(w => ({ w, a: resolve(w.from, 'from'), b: resolve(w.to, 'to') }))
  // one vertical lane per net among the nets that leave from the same x
  const netXs = new Map<string, Pt>()
  for (const r of resolved) netXs.set(r.a.key, r.a.pt)
  const lane = new Map<string, number>()
  const byX = new Map<number, Array<[string, Pt]>>()
  for (const [k, p] of netXs) byX.set(p.x, [...(byX.get(p.x) ?? []), [k, p]])
  for (const list of byX.values()) list.sort((u, v) => u[1].y - v[1].y).forEach(([k], i) => lane.set(k, i))
  let fbAbove = 0, fbBelow = 0

  const paths = new Map<string, Pt[][]>()
  for (const { w, a, b } of resolved) {
    const S = a.pt, D = b.pt
    const trunk = S.x + 16 + 12 * (lane.get(a.key) ?? 0)
    let pts: Pt[]
    if (D.x - S.x >= 30) {
      const x = w.viaX !== undefined ? w.viaX * CW : Math.min(trunk, D.x - 12)
      pts = S.y === D.y ? [S, D] : [S, { x, y: S.y }, { x, y: D.y }, D]
    } else {
      const up = D.y <= S.y
      const y = (w as SchWire).viaY !== undefined ? (w.viaY as number) * RH : up ? minY - 18 - 10 * fbAbove++ : maxY + 18 + 10 * fbBelow++
      const x2 = D.x - 16
      pts = [S, { x: trunk, y: S.y }, { x: trunk, y }, { x: x2, y }, { x: x2, y: D.y }, D]
    }
    pts = simplify(pts)
    prims.push({ t: 'wire', net: a.key, points: pts, hops: [] })
    paths.set(a.key, [...(paths.get(a.key) ?? []), pts])
  }
  for (const ps of paths.values()) for (const j of junctions(ps)) prims.push({ t: 'circle', cx: j.x, cy: j.y, r: 3.5, cls: 'dot' })
  // crossings of different nets: the horizontal run hops over the vertical one
  const ws = prims.filter((p): p is Extract<Prim, { t: 'wire' }> => p.t === 'wire')
  const segs = (w: Extract<Prim, { t: 'wire' }>) => w.points.slice(1).map((p, i) => [w.points[i], p] as const)
  for (const w of ws) for (const [a, b] of segs(w)) {
    if (a.y !== b.y) continue
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x)
    for (const o of ws) {
      if (o.net === w.net) continue
      for (const [c, d] of segs(o)) {
        if (c.x !== d.x) continue
        const y0 = Math.min(c.y, d.y), y1 = Math.max(c.y, d.y)
        if (c.x > x0 + HOP && c.x < x1 - HOP && a.y > y0 && a.y < y1 && !w.hops.some(h => h.x === c.x && h.y === a.y)) w.hops.push({ x: c.x, y: a.y })
      }
    }
  }

  if (n.frame) {
    const x0 = (n.frame.from[0] - 0.5) * CW, x1 = (n.frame.to[0] + 0.5) * CW
    const y0 = (n.frame.from[1] - 0.5) * RH, y1 = (n.frame.to[1] + 0.5) * RH
    prims.unshift({ t: 'path', d: `M${x0},${y0} H${x1} V${y1} H${x0} Z`, cls: 'frame' })
  }

  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity
  const add = (x: number, y: number) => { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y) }
  for (const p of prims) {
    if (p.t === 'wire') p.points.forEach(q => add(q.x, q.y))
    else if (p.t === 'circle') { add(p.cx - p.r, p.cy - p.r); add(p.cx + p.r, p.cy + p.r) }
    else if (p.t === 'text') {
      const w = p.text.length * 8
      const x0 = p.anchor === 'end' ? p.x - w : p.anchor === 'middle' ? p.x - w / 2 : p.x
      add(x0, p.y - 8); add(x0 + w, p.y + 8)
    } else for (const q of pathPoints(p.d)) add(q.x, q.y)
  }
  if (!Number.isFinite(bx0)) { bx0 = 0; by0 = 0; bx1 = 0; by1 = 0 }
  const pad = 12
  return { box: { x: bx0 - pad, y: by0 - pad, w: bx1 - bx0 + 2 * pad, h: by1 - by0 + 2 * pad }, prims, pins }
}
