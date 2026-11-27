import type { Bit } from '../../logic/boolean'
import { isChipKind, type Circuit, type GateKind, type Node } from '../../logic/circuit'
import type { Chips } from './labLogic'

/* Geometry and drawing for circuit nodes. Coordinates are relative to the node centre (node.x, node.y). */

export interface Pin { x: number; y: number; label?: string }
export interface Geo { w: number; h: number; ins: Pin[]; outs: Pin[] }

const PIN_GAP = 20

/** Highest wired input pin + 1 for a node (gates grow extra pins when wired beyond two). */
export function wiredInputs(c: Circuit): Map<string, number> {
  const m = new Map<string, number>()
  for (const w of c.wires) m.set(w.to.node, Math.max(m.get(w.to.node) ?? 0, w.to.pin + 1))
  return m
}

export function nodeGeo(n: Node, chips: Chips, wired = 0): Geo {
  if (n.kind === 'IN') return { w: 64, h: 44, ins: [], outs: [{ x: 42, y: 0 }] }
  if (n.kind === 'OUT') return { w: 64, h: 44, ins: [{ x: -42, y: 0 }], outs: [] }
  if (isChipKind(n.kind)) {
    const chip = chips[n.kind.chip]
    const ins = chip?.inputs ?? []
    const outs = chip?.outputs ?? []
    const k = Math.max(ins.length, outs.length, 1)
    const h = k * 26 + 26
    const col = (names: string[], x: number) =>
      names.map((label, i) => ({ x, y: (i - (names.length - 1) / 2) * 26 + 6, label }))
    return { w: 104, h, ins: col(ins, -62), outs: col(outs, 62) }
  }
  const k = n.kind === 'NOT' ? 1 : Math.max(2, wired)
  const h = Math.max(48, k * PIN_GAP + 8)
  return {
    w: 76, h,
    ins: Array.from({ length: k }, (_, i) => ({ x: -46, y: (i - (k - 1) / 2) * PIN_GAP })),
    outs: [{ x: 46, y: 0 }],
  }
}

export function pinPos(n: Node, g: Geo, dir: 'in' | 'out', pin: number): { x: number; y: number } {
  const p = (dir === 'in' ? g.ins : g.outs)[pin] ?? { x: dir === 'in' ? -g.w / 2 : g.w / 2, y: 0 }
  return { x: n.x + p.x, y: n.y + p.y }
}

export function wirePath(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const dx = Math.max(36, Math.abs(b.x - a.x) / 2)
  return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`
}

/* ---------- gate symbols (IEEE distinctive shapes), drawn in a 48-tall box ---------- */

const AND_BODY = 'M-28,-22 H4 A22,22 0 0 1 4,22 H-28 Z'
const OR_BODY = 'M-30,-22 Q6,-22 28,0 Q6,22 -30,22 Q-18,0 -30,-22 Z'
const NOT_BODY = 'M-24,-18 L18,0 L-24,18 Z'

const shape: Record<GateKind, { body: string; bubble?: number; xor?: boolean; end: number }> = {
  AND: { body: AND_BODY, end: 26 },
  NAND: { body: AND_BODY, bubble: 31, end: 36 },
  OR: { body: OR_BODY, end: 28 },
  NOR: { body: OR_BODY, bubble: 33, end: 38 },
  XOR: { body: OR_BODY, xor: true, end: 28 },
  XNOR: { body: OR_BODY, xor: true, bubble: 33, end: 38 },
  NOT: { body: NOT_BODY, bubble: 23, end: 28 },
}

export function GateGlyph({ kind, h = 48, ins = [], out }: { kind: GateKind; h?: number; ins?: Pin[]; out?: Bit }) {
  const s = shape[kind]
  return (
    <g className="glyph">
      {ins.map((p, i) => <line key={i} className="stub" x1={p.x} y1={p.y} x2={-20} y2={p.y} />)}
      <line className={`stub${out === 1 ? ' on' : ''}`} x1={s.end} y1={0} x2={46} y2={0} />
      <g transform={h !== 48 ? `scale(1 ${h / 48})` : undefined}>
        <path className="body" d={s.body} vectorEffect="non-scaling-stroke" />
        {s.xor && <path className="body-line" d="M-37,-22 Q-25,0 -37,22" vectorEffect="non-scaling-stroke" />}
      </g>
      {s.bubble !== undefined && <circle className="body" cx={s.bubble} cy={0} r={5} />}
    </g>
  )
}

/** Small palette icon for a gate or chip. */
export function PaletteIcon({ kind }: { kind: GateKind | 'CHIP' }) {
  return (
    <svg className="pal-icon" viewBox="-50 -28 100 56" aria-hidden>
      {kind === 'CHIP'
        ? <rect className="body" x={-30} y={-22} width={60} height={44} rx={6} />
        : <GateGlyph kind={kind} ins={kind === 'NOT' ? [{ x: -46, y: 0 }] : [{ x: -46, y: -10 }, { x: -46, y: 10 }]} />}
    </svg>
  )
}

export const bitAttr = (v: Bit | undefined) => (v === undefined ? '' : String(v))
