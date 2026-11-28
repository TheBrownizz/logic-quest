import type { StateTable } from '../../logic/fsm'

/**
 * Pure layout of a state diagram from a state table: states as circles, one arrow per (from, to) pair with
 * all its inputs on one label. Moore: the output is written in the state ("S1" over "01/1"), Mealy: on the
 * arrows ("x/y"). No DOM; <StateDiagram> renders it.
 */

export interface DiagNode { code: number; x: number; y: number; name: string; sub: string }
export interface DiagEdge {
  from: number
  to: number
  /** SVG path from the edge of `from` to the edge of `to` (the arrow head goes at the end). */
  d: string
  start: { x: number; y: number }
  end: { x: number; y: number }
  label: string
  lx: number
  ly: number
  self: boolean
}
export interface DiagramLayout { box: { x: number; y: number; w: number; h: number }; r: number; nodes: DiagNode[]; edges: DiagEdge[] }
export interface DiagramOptions {
  /** Where outputs are written; default: 'moore' when the table is Moore, else 'mealy'. A Mealy table cannot be drawn as Moore. */
  kind?: 'moore' | 'mealy'
  /** State names by code; default S<code>. */
  names?: Record<number, string>
}

export const NODE_R = 30
const r2 = (v: number) => Math.round(v * 10) / 10
export const bitsOf = (v: number, w: number) => (w === 0 ? '' : v.toString(2).padStart(w, '0'))

/** Centres for n states: a row for 1–2, a triangle, a square, then a circle (clockwise from the top left). */
function positions(n: number): Array<{ x: number; y: number }> {
  if (n === 1) return [{ x: 0, y: 0 }]
  if (n === 2) return [{ x: -110, y: 0 }, { x: 110, y: 0 }]
  if (n === 4) return [{ x: -110, y: -90 }, { x: 110, y: -90 }, { x: 110, y: 90 }, { x: -110, y: 90 }]
  const R = Math.max(110, n * 30)
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n - (n === 3 ? 0 : Math.PI / n)
    return { x: r2(R * Math.cos(a)), y: r2(R * Math.sin(a)) }
  })
}

export function layoutStateDiagram(t: StateTable, opts: DiagramOptions = {}): DiagramLayout {
  const nIn = 1 << t.inputs.length
  const states = [...new Set(t.rows.filter(r => r.next !== null).map(r => r.state))].sort((a, b) => a - b)
  const moore = (opts.kind ?? (states.every(s => t.rows.slice(s * nIn, s * nIn + nIn).every(r => r.out === t.rows[s * nIn].out)) ? 'moore' : 'mealy')) === 'moore'
  if (moore && states.some(s => t.rows.slice(s * nIn, s * nIn + nIn).some(r => r.out !== t.rows[s * nIn].out))) {
    throw new Error('a Mealy table cannot be drawn as a Moore diagram')
  }
  const pos = positions(states.length)
  const R = NODE_R
  const nodes: DiagNode[] = states.map((s, i) => {
    const code = bitsOf(s, t.stateBits)
    const out = bitsOf(t.rows[s * nIn].out ?? 0, t.outputs.length)
    return { code: s, x: pos[i].x, y: pos[i].y, name: opts.names?.[s] ?? `S${s}`, sub: moore && t.outputs.length ? `${code}/${out}` : code }
  })
  const at = new Map(nodes.map(n => [n.code, n]))
  const groups = new Map<string, { from: number; to: number; items: string[] }>()
  for (const s of states) for (let x = 0; x < nIn; x++) {
    const row = t.rows[s * nIn + x]
    const key = `${s}>${row.next}`
    const g = groups.get(key) ?? { from: s, to: row.next!, items: [] }
    const inp = t.inputs.length ? bitsOf(x, t.inputs.length) : '–'
    g.items.push(moore || !t.outputs.length ? inp : `${inp}/${bitsOf(row.out ?? 0, t.outputs.length)}`)
    groups.set(key, g)
  }
  const cx = nodes.reduce((a, n) => a + n.x, 0) / nodes.length
  const cy = nodes.reduce((a, n) => a + n.y, 0) / nodes.length
  const edges: DiagEdge[] = []
  for (const g of groups.values()) {
    const a = at.get(g.from)!, b = at.get(g.to)!
    const label = g.items.join(', ')
    if (g.from === g.to) {
      let dx = a.x - cx, dy = a.y - cy
      const len = Math.hypot(dx, dy)
      if (len < 1) { dx = 0; dy = -1 } else { dx /= len; dy /= len }
      const ang = Math.atan2(dy, dx)
      const p = (da: number, rr: number) => ({ x: r2(a.x + rr * Math.cos(ang + da)), y: r2(a.y + rr * Math.sin(ang + da)) })
      const s0 = p(-0.45, R), s1 = p(0.45, R)
      const c0 = p(-0.6, R * 2.6), c1 = p(0.6, R * 2.6)
      const l = p(0, R * 2.55)
      edges.push({ from: g.from, to: g.to, d: `M${s0.x},${s0.y} C${c0.x},${c0.y} ${c1.x},${c1.y} ${s1.x},${s1.y}`, start: s0, end: s1, label, lx: r2(l.x + dx * 8), ly: r2(l.y + dy * 8), self: true })
      continue
    }
    const both = groups.has(`${g.to}>${g.from}`)
    const vx = b.x - a.x, vy = b.y - a.y
    const len = Math.hypot(vx, vy)
    const nx = -vy / len, ny = vx / len
    const bend = both ? 28 : 0
    const mx = (a.x + b.x) / 2 + nx * bend, my = (a.y + b.y) / 2 + ny * bend
    const toward = (p: { x: number; y: number }, q: { x: number; y: number }) => {
      const ux = q.x - p.x, uy = q.y - p.y, ul = Math.hypot(ux, uy)
      return { x: r2(p.x + (ux / ul) * R), y: r2(p.y + (uy / ul) * R) }
    }
    const s0 = toward(a, { x: mx, y: my })
    const s1 = toward(b, { x: mx, y: my })
    const ccx = r2(2 * mx - (s0.x + s1.x) / 2), ccy = r2(2 * my - (s0.y + s1.y) / 2)
    const side = both ? 14 : 12
    edges.push({
      from: g.from, to: g.to, d: `M${s0.x},${s0.y} Q${ccx},${ccy} ${s1.x},${s1.y}`, start: s0, end: s1, label,
      lx: r2(mx + nx * side), ly: r2(my + ny * side), self: false,
    })
  }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  const add = (x: number, y: number, w = 0) => { x0 = Math.min(x0, x - w); x1 = Math.max(x1, x + w); y0 = Math.min(y0, y - 10); y1 = Math.max(y1, y + 10) }
  for (const n of nodes) { add(n.x - R, n.y - R); add(n.x + R, n.y + R) }
  for (const e of edges) {
    add(e.lx, e.ly, e.label.length * 4.2)
    for (const m of e.d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)) add(Number(m[1]), Number(m[2]))
  }
  const pad = 14
  return { box: { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad }, r: R, nodes, edges }
}
