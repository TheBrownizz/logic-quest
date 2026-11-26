import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import type { Bit } from '../../logic/boolean'
import type { Circuit, GateKind, Node, Wire } from '../../logic/circuit'
import { liveValues, nextNodeId, type Chips } from './labLogic'
import { GateGlyph, PaletteIcon, bitAttr, nodeGeo, pinPos, wiredInputs, wirePath } from './circuitView'

const GATES: readonly string[] = ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR']
const isGate = (s: string): s is GateKind => GATES.includes(s)

type PinRef = { node: string; pin: number; dir: 'in' | 'out' }
type Sel = { type: 'node'; id: string } | { type: 'wire'; index: number } | null
type Pt = { x: number; y: number }

export interface CircuitEditorProps {
  value: Circuit
  onChange?: (c: Circuit) => void
  palette?: (GateKind | string)[]
  chips: Chips
  readOnly?: boolean
  highlightPath?: string[]
  /** Controlled input values (by IN label). Uncontrolled when omitted. */
  inputs?: Record<string, Bit>
  onToggleInput?: (name: string) => void
  errorNodeId?: string
  /** Increment to replay the success animation. */
  celebrate?: number
  /** Small labels above (e.g. delays) and below (e.g. arrival times) nodes. */
  above?: Record<string, string>
  below?: Record<string, string>
}

const inName = (n: Node) => n.label ?? n.id

export function CircuitEditor(p: CircuitEditorProps) {
  const { value, chips, readOnly } = p
  const svgRef = useRef<SVGSVGElement>(null)
  const [own, setOwn] = useState<Record<string, Bit>>({})
  const [sel, setSel] = useState<Sel>(null)
  const [pending, setPending] = useState<PinRef | null>(null)
  const [cursor, setCursor] = useState<Pt | null>(null)
  const [drag, setDrag] = useState<{ id: string; off: Pt; at: Pt; start: Pt; moved: boolean } | null>(null)

  const inputs = useMemo(() => {
    const src = p.inputs ?? own
    const r: Record<string, Bit> = {}
    for (const n of value.nodes) if (n.kind === 'IN') r[inName(n)] = src[inName(n)] ?? 0
    return r
  }, [p.inputs, own, value.nodes])
  const live = useMemo(() => liveValues(value, inputs, chips), [value, inputs, chips])
  const wired = useMemo(() => wiredInputs(value), [value])

  const nodes = drag?.moved ? value.nodes.map(n => (n.id === drag.id ? { ...n, x: drag.at.x, y: drag.at.y } : n)) : value.nodes
  const byId = new Map(nodes.map(n => [n.id, n]))
  const geo = new Map(nodes.map(n => [n.id, nodeGeo(n, chips, wired.get(n.id) ?? 0)]))
  const W = Math.max(960, ...value.nodes.map(n => n.x + 110))
  const H = Math.max(readOnly ? 160 : 420, ...value.nodes.map(n => n.y + (geo.get(n.id)?.h ?? 0) / 2 + (readOnly ? 70 : 50)))
  const path = p.highlightPath ?? []
  const onPath = new Set(path)
  const pathEdge = (w: Wire) => path.some((id, i) => i > 0 && path[i - 1] === w.from.node && id === w.to.node)

  const change = (c: Circuit) => { if (!readOnly) p.onChange?.(c) }

  const toggle = (name: string) => {
    if (p.onToggleInput) p.onToggleInput(name)
    else setOwn(o => ({ ...o, [name]: o[name] ? 0 : 1 }))
  }

  const removeSelected = () => {
    if (!sel) return
    if (sel.type === 'wire') change({ ...value, wires: value.wires.filter((_, i) => i !== sel.index) })
    else {
      const n = byId.get(sel.id)
      if (!n || n.kind === 'IN' || n.kind === 'OUT') return
      change({ nodes: value.nodes.filter(x => x.id !== sel.id), wires: value.wires.filter(w => w.from.node !== sel.id && w.to.node !== sel.id) })
    }
    setSel(null)
  }

  useEffect(() => {
    if (readOnly) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      if (e.key === 'Escape') { setPending(null); setSel(null) }
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { e.preventDefault(); removeSelected() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const toSvg = (e: { clientX: number; clientY: number }): Pt => {
    const svg = svgRef.current
    const m = svg?.getScreenCTM()
    if (!svg || !m) return { x: 0, y: 0 }
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return { x: pt.x, y: pt.y }
  }

  /** Next free slot, filling the middle of the canvas column by column (signal flows left to right). */
  const freeSpot = (): Pt => {
    for (let col = 0; col < 6; col++) {
      const x = 240 + col * 150
      if (x > W - 200) break
      for (let y = 70; y <= H - 60; y += 90) {
        if (value.nodes.every(n => Math.abs(n.x - x) > 100 || Math.abs(n.y - y) > 60)) return { x, y }
      }
    }
    return { x: W / 2, y: H / 2 }
  }

  const add = (item: string, at?: Pt) => {
    if (readOnly) return
    const gate = isGate(item)
    const id = nextNodeId(value, gate ? 'g' : 'c')
    const pos = at ?? freeSpot()
    const node: Node = { id, kind: gate ? item : { chip: item }, x: Math.round(pos.x), y: Math.round(pos.y) }
    change({ ...value, nodes: [...value.nodes, node] })
    setSel({ type: 'node', id })
  }

  const connect = (a: PinRef, b: PinRef) => {
    const out = a.dir === 'out' ? a : b
    const inn = a.dir === 'in' ? a : b
    const wires = value.wires.filter(w => !(w.to.node === inn.node && w.to.pin === inn.pin))
    wires.push({ from: { node: out.node, pin: out.pin }, to: { node: inn.node, pin: inn.pin } })
    change({ ...value, wires })
    setPending(null)
  }

  const pinDown = (e: RPointerEvent, ref: PinRef) => {
    e.stopPropagation()
    if (readOnly) return
    setCursor(toSvg(e))
    if (pending && pending.dir !== ref.dir) connect(pending, ref)
    else if (pending && pending.node === ref.node && pending.pin === ref.pin && pending.dir === ref.dir) setPending(null)
    else { setPending(ref); setSel(null) }
  }
  const pinUp = (ref: PinRef) => {
    // drag-to-wire: released over a pin of the other kind
    if (!readOnly && pending && pending.dir !== ref.dir) connect(pending, ref)
  }

  const nodeDown = (e: RPointerEvent, n: Node) => {
    e.stopPropagation()
    if (readOnly) return
    const at = toSvg(e)
    svgRef.current?.setPointerCapture?.(e.pointerId)
    setDrag({ id: n.id, off: { x: n.x - at.x, y: n.y - at.y }, at: { x: n.x, y: n.y }, start: at, moved: false })
  }

  const move = (e: RPointerEvent) => {
    const at = toSvg(e)
    if (pending) setCursor(at)
    if (drag) {
      const moved = drag.moved || Math.hypot(at.x - drag.start.x, at.y - drag.start.y) > 4
      setDrag({ ...drag, moved, at: { x: Math.round(at.x + drag.off.x), y: Math.round(at.y + drag.off.y) } })
    }
  }

  const up = () => {
    if (!drag) return
    const n = byId.get(drag.id)
    if (drag.moved && n) {
      const x = Math.max(40, Math.min(W - 40, drag.at.x))
      const y = Math.max(30, Math.min(H - 30, drag.at.y))
      change({ ...value, nodes: value.nodes.map(m => (m.id === drag.id ? { ...m, x, y } : m)) })
    } else if (n) {
      setSel({ type: 'node', id: n.id })
      if (n.kind === 'IN') toggle(inName(n))
    }
    setDrag(null)
  }

  const pendingPos = pending && byId.get(pending.node)
    ? pinPos(byId.get(pending.node)!, geo.get(pending.node)!, pending.dir, pending.pin) : null

  return (
    <div className={`editor${readOnly ? ' readonly' : ''}`}>
      {!readOnly && p.palette && (
        <div className="palette" role="toolbar" aria-label="רכיבים">
          {p.palette.map(item => (
            <button
              key={item} type="button" className="pal-item" data-testid={`palette-${item}`}
              draggable onDragStart={e => e.dataTransfer.setData('text/x-gate', item)}
              onClick={() => add(item)} title={isGate(item) ? `הוסף ${item}` : `הוסף רכיב ${item}`}
            >
              <PaletteIcon kind={isGate(item) ? item : 'CHIP'} />
              <span className="mono">{item}</span>
            </button>
          ))}
          <span className="pal-help muted">לחצו על פין יציאה ואז על פין כניסה · Delete מוחק</span>
        </div>
      )}
      <div className={`canvas${p.celebrate ? ' celebrate' : ''}`} key={p.celebrate ?? 0} dir="ltr">
        <svg
          ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="circuit" role="img" aria-label="מעגל"
          onPointerMove={move} onPointerUp={up}
          onPointerDown={() => { setSel(null); setPending(null) }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const g = e.dataTransfer.getData('text/x-gate'); if (g) add(g, toSvg(e)) }}
        >
          <defs>
            <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" className="grid-dot" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#grid)" />

          <g className="wires">
            {value.wires.map((w, i) => {
              const a = byId.get(w.from.node)
              const b = byId.get(w.to.node)
              if (!a || !b) return null
              const d = wirePath(pinPos(a, geo.get(a.id)!, 'out', w.from.pin), pinPos(b, geo.get(b.id)!, 'in', w.to.pin))
              const v = live[a.id]?.[w.from.pin]
              const cls = ['wire', v === 1 ? 'on' : v === 0 ? 'off' : 'unknown',
                sel?.type === 'wire' && sel.index === i ? 'selected' : '', pathEdge(w) ? 'critical' : ''].join(' ')
              return (
                <g key={i} className={cls} data-testid="wire" data-value={bitAttr(v)}>
                  <path className="wire-base" d={d} />
                  {v === 1 && <path className="wire-flow" d={d} />}
                  <path className="wire-hit" d={d}
                    onPointerDown={e => { e.stopPropagation(); if (!readOnly) { setSel({ type: 'wire', index: i }); setPending(null) } }} />
                </g>
              )
            })}
            {pending && pendingPos && cursor && (
              <path className="wire rubber" d={pending.dir === 'out' ? wirePath(pendingPos, cursor) : wirePath(cursor, pendingPos)} />
            )}
          </g>

          {nodes.map(n => {
            const g = geo.get(n.id)!
            const out = live[n.id]
            const val = n.kind === 'OUT' ? out?.[0] : n.kind === 'IN' ? inputs[inName(n)] : out?.[0]
            const cls = ['node', typeof n.kind === 'object' ? 'chip' : `k-${n.kind}`,
              sel?.type === 'node' && sel.id === n.id ? 'selected' : '', p.errorNodeId === n.id ? 'error' : '',
              onPath.has(n.id) ? 'critical' : '', drag?.id === n.id && drag.moved ? 'dragging' : ''].join(' ')
            return (
              <g key={n.id} className={cls} transform={`translate(${n.x} ${n.y})`} data-testid={`node-${n.id}`}
                data-value={bitAttr(val)} data-critical={onPath.has(n.id) ? 'true' : undefined}
                onPointerDown={e => nodeDown(e, n)}>
                <NodeBody n={n} g={g} val={val} outs={out} chips={chips} />
                {g.ins.map((pp, i) => (
                  <PinDot key={`i${i}`} id={`pin-${n.id}-in-${i}`} x={pp.x} y={pp.y}
                    active={pending?.node === n.id && pending.dir === 'in' && pending.pin === i}
                    target={!!pending && pending.dir === 'out'} readOnly={readOnly}
                    onDown={e => pinDown(e, { node: n.id, pin: i, dir: 'in' })} onUp={() => pinUp({ node: n.id, pin: i, dir: 'in' })} />
                ))}
                {g.outs.map((pp, i) => (
                  <PinDot key={`o${i}`} id={`pin-${n.id}-out-${i}`} x={pp.x} y={pp.y} on={out?.[i] === 1}
                    active={pending?.node === n.id && pending.dir === 'out' && pending.pin === i}
                    target={!!pending && pending.dir === 'in'} readOnly={readOnly}
                    onDown={e => pinDown(e, { node: n.id, pin: i, dir: 'out' })} onUp={() => pinUp({ node: n.id, pin: i, dir: 'out' })} />
                ))}
                {p.above?.[n.id] && <text className="tag above" y={-g.h / 2 - 10}>{p.above[n.id]}</text>}
                {p.below?.[n.id] && <text className="tag below" y={g.h / 2 + (n.kind === 'IN' || n.kind === 'OUT' ? 18 : 30)} data-testid={`arrival-${n.id}`}>{p.below[n.id]}</text>}
                {p.celebrate && n.kind === 'OUT' ? <circle className="ring" r={22} /> : null}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

function PinDot(props: { id: string; x: number; y: number; on?: boolean; active: boolean; target: boolean; readOnly?: boolean; onDown: (e: RPointerEvent) => void; onUp: () => void }) {
  const cls = ['pin', props.on ? 'on' : '', props.active ? 'active' : '', props.target ? 'target' : ''].join(' ')
  return (
    <g className={cls} data-testid={props.id} onPointerDown={props.onDown} onPointerUp={props.onUp}
      style={props.readOnly ? { pointerEvents: 'none' } : undefined}>
      <circle className="pin-hit" cx={props.x} cy={props.y} r={11} />
      <circle className="pin-dot" cx={props.x} cy={props.y} r={5.5} />
    </g>
  )
}

function NodeBody({ n, g, val, outs, chips }: { n: Node; g: ReturnType<typeof nodeGeo>; val?: Bit; outs?: (Bit | undefined)[]; chips: Chips }) {
  if (n.kind === 'IN') {
    return (
      <g className={`io in ${val === 1 ? 'on' : 'off'}`}>
        <line className={`stub${val === 1 ? ' on' : ''}`} x1={20} y1={0} x2={42} y2={0} />
        <rect className="io-box" x={-32} y={-22} width={54} height={44} rx={10} />
        <text className="io-label" x={-17} y={5}>{n.label ?? n.id}</text>
        <text className="io-bit" x={8} y={6}>{val ?? 0}</text>
      </g>
    )
  }
  if (n.kind === 'OUT') {
    return (
      <g className={`io out ${val === 1 ? 'on' : val === 0 ? 'off' : 'unknown'}`}>
        <line className={`stub${val === 1 ? ' on' : ''}`} x1={-42} y1={0} x2={-20} y2={0} />
        <circle className="lamp" cx={0} cy={0} r={19} />
        <text className="io-bit" x={0} y={6}>{val ?? '?'}</text>
        <text className="io-label" x={32} y={5}>{n.label ?? n.id}</text>
      </g>
    )
  }
  if (typeof n.kind === 'object') {
    const name = n.kind.chip
    return (
      <g className="chip-body">
        {g.ins.map((pp, i) => <line key={`i${i}`} className="stub" x1={pp.x} y1={pp.y} x2={-g.w / 2} y2={pp.y} />)}
        {g.outs.map((pp, i) => <line key={`o${i}`} className={`stub${outs?.[i] === 1 ? ' on' : ''}`} x1={g.w / 2} y1={pp.y} x2={pp.x} y2={pp.y} />)}
        <rect className="body" x={-g.w / 2} y={-g.h / 2} width={g.w} height={g.h} rx={8} />
        <text className="chip-name" y={-g.h / 2 + 16}>{chips[name] ? name : `${name}?`}</text>
        {g.ins.map((pp, i) => <text key={`li${i}`} className="pin-label" x={-g.w / 2 + 7} y={pp.y + 4} textAnchor="start">{pp.label}</text>)}
        {g.outs.map((pp, i) => <text key={`lo${i}`} className="pin-label" x={g.w / 2 - 7} y={pp.y + 4} textAnchor="end">{pp.label}</text>)}
      </g>
    )
  }
  return (
    <>
      <rect className="hitbox" x={-34} y={-g.h / 2} width={70} height={g.h} />
      <GateGlyph kind={n.kind} h={g.h} ins={g.ins} out={val} />
      <text className="gate-name" y={g.h / 2 + 13}>{n.kind}</text>
    </>
  )
}
