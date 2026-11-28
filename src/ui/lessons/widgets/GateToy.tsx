import { useEffect, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { GateKind } from '../../../logic/circuit'
import type { WidgetProps } from './types'
import { assignmentOf, boxLayout, columnOf, flip, opened, outputOf, pickRow, rowCount, rowOf, type GateToyConfig, type GateToyGoal, type GateToyState } from './gateToyLogic'
import './GateToy.css'

const W0 = 380
const GX = 148 // body left edge
const SW_X = 34 // switch pill left edge
const SW_W = 56
const LAMP_X0 = 338

const pinGap = (n: number) => (n === 2 ? 44 : 34)
const heightOf = (n: number) => (n === 1 ? 112 : n === 2 ? 150 : 190)
const pinYs = (n: number, cy: number) => Array.from({ length: n }, (_, i) => cy + (i - (n - 1) / 2) * pinGap(n))

const INVERTED: GateKind[] = ['NOT', 'NAND', 'NOR', 'XNOR']

/** The outline of a gate in the classic shapes (AND, OR, XOR, NOT and their inverted forms), or a labelled box. */
function body(kind: GateKind | undefined, x: number, cy: number, n: number, label: string, on: boolean) {
  const cls = `gt-body${on ? ' on' : ''}`
  if (!kind) {
    const h = n === 1 ? 30 : n === 2 ? 40 : 56
    const b = boxLayout(label)
    return { w: b.w, out: x + b.w, node: (
      <g>
        <rect className={cls} x={x} y={cy - h} width={b.w} height={2 * h} rx={12} />
        <text className="gt-expr" x={x + b.w / 2} y={cy + 5} textAnchor="middle"
          {...(b.textLength ? { textLength: b.textLength, lengthAdjust: 'spacingAndGlyphs' } : {})}>{label}</text>
      </g>
    ) }
  }
  const w = 72
  const h = n === 1 ? 30 : n === 2 ? 38 : 52
  const y0 = cy - h
  const base = kind === 'AND' || kind === 'NAND'
    ? `M${x},${y0} H${x + w / 2} A${w / 2},${h} 0 0 1 ${x + w / 2},${y0 + 2 * h} H${x} Z`
    : kind === 'NOT'
      ? `M${x},${y0} L${x + w - 10},${cy} L${x},${y0 + 2 * h} Z`
      : `M${x},${y0} Q${x + w * 0.58},${y0} ${x + w},${cy} Q${x + w * 0.58},${y0 + 2 * h} ${x},${y0 + 2 * h} Q${x + w * 0.24},${cy} ${x},${y0} Z`
  const inv = INVERTED.includes(kind)
  const bubbleX = kind === 'NOT' ? x + w - 5 : x + w + 5
  return { w, out: inv ? bubbleX + 5 : x + w, node: (
    <g>
      <path className={cls} d={base} />
      {(kind === 'XOR' || kind === 'XNOR') && <path className={`gt-body-line${on ? ' on' : ''}`} d={`M${x - 9},${y0} Q${x + w * 0.24 - 9},${cy} ${x - 9},${y0 + 2 * h}`} fill="none" />}
      {inv && <circle className={cls} cx={bubbleX} cy={cy} r={5} />}
    </g>
  ) }
}

/** One input switch inside the SVG: keyboard operable (Tab, Space or Enter). */
function Switch({ name, y, on, onToggle }: { name: string; y: number; on: boolean; onToggle: () => void }) {
  const key = (e: KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onToggle() } }
  return (
    <g className={`gt-sw${on ? ' on' : ''}`} role="switch" aria-checked={on} aria-label={`מתג ${name}`} tabIndex={0}
      data-testid={`gate-switch-${name}`} onClick={onToggle} onKeyDown={key}>
      <text className="gt-var" x={14} y={y + 6} textAnchor="middle">{name}</text>
      <rect className="gt-sw-pill" x={SW_X} y={y - 15} width={SW_W} height={30} rx={15} />
      <circle className="gt-sw-knob" cx={on ? SW_X + SW_W - 15 : SW_X + 15} cy={y} r={11} />
      <text className="gt-sw-val" x={on ? SW_X + 16 : SW_X + SW_W - 16} y={y + 5} textAnchor="middle">{on ? 1 : 0}</text>
    </g>
  )
}

/** GateToy: flip the switches, watch the signal travel to the lamp, and fill in the truth table row by row. */
export function GateToy({ config, onState, reducedMotion }: WidgetProps<GateToyConfig, GateToyState, GateToyGoal>) {
  const [state, setState] = useState(() => opened(config))
  const [pulse, setPulse] = useState(0)
  const [last, setLast] = useState(0)
  useEffect(() => { onState(state) }, [state])

  const { vars, expr, gate } = config
  const n = vars.length
  const out = outputOf(config, state)
  const H = heightOf(n)
  const cy = H / 2
  const ys = pinYs(n, cy)
  const g = body(gate, GX, cy, n, expr.display, out === 1)
  const extra = gate ? 0 : boxLayout(expr.display).extra
  const W = W0 + extra
  const LAMP_X = LAMP_X0 + extra
  const outX = g.out
  const col = columnOf(vars, expr)
  const rowNow = rowOf(vars, state.inputs)
  const N = rowCount(n)

  const act = (next: GateToyState, row: number) => { setState(next); setLast(row); setPulse(p => p + 1) }
  const toggle = (v: string) => { const s = flip(config, state, v); act(s, rowOf(vars, s.inputs)) }
  const go = (row: number) => act(pickRow(config, state, row), row)

  return (
    <div className={`gt${reducedMotion ? ' reduced' : ''}`} data-testid="gate-toy" data-out={out}>
      <svg className="gt-svg" viewBox={`0 0 ${W} ${H}`} role="group" aria-label="שער עם מתגים ונורה">
        <g key={pulse} className="gt-flow">
          {vars.map((v, i) => (
            <g key={v}>
              <line className="gt-wire" x1={SW_X + SW_W} y1={ys[i]} x2={GX + 12} y2={ys[i]} />
              {state.inputs[v] === 1 && <line className="gt-wire live" pathLength={1} x1={SW_X + SW_W} y1={ys[i]} x2={GX + 12} y2={ys[i]} style={{ ['--d' as string]: '0s' }} />}
            </g>
          ))}
          <line className="gt-wire" x1={outX} y1={cy} x2={LAMP_X - 22} y2={cy} />
          {out === 1 && <line className="gt-wire live" pathLength={1} x1={outX} y1={cy} x2={LAMP_X - 22} y2={cy} style={{ ['--d' as string]: '.45s' }} />}
          {g.node}
          <g className={`gt-lamp${out === 1 ? ' on' : ''}`} data-testid="gt-lamp" aria-label={`נורה: ${out}`} role="img">
            <circle className="gt-bulb" cx={LAMP_X} cy={cy} r={22} />
            <text className="gt-lamp-val" x={LAMP_X} y={cy + 7} textAnchor="middle">{out}</text>
          </g>
        </g>
        <text className="gt-var" x={LAMP_X} y={cy - 32} textAnchor="middle">F</text>
        {vars.map((v, i) => <Switch key={v} name={v} y={ys[i]} on={state.inputs[v] === 1} onToggle={() => toggle(v)} />)}
      </svg>

      <table className="gt-table" dir="ltr" data-testid="gt-table">
        <caption className="gt-cap">נוסו {state.tried.length} מתוך {N} שורות. אפשר ללחוץ על מספר שורה כדי לקפוץ אליה.</caption>
        <thead><tr><th scope="col">#</th>{vars.map(v => <th key={v} scope="col">{v}</th>)}<th scope="col" className="gt-th-out">F</th></tr></thead>
        <tbody>
          {Array.from({ length: N }, (_, r) => {
            const a = assignmentOf(vars, r)
            const tried = state.tried.includes(r)
            return (
              <tr key={r} className={`${r === rowNow ? 'cur' : ''}${r === rowNow && r === last && pulse > 0 ? ' fresh' : ''}`} data-testid={`gt-row-${r}`} data-tried={tried}>
                <th scope="row"><button type="button" className="gt-rowbtn" aria-label={`נסו את שורה ${r}`} onClick={() => go(r)}>{r}</button></th>
                {vars.map(v => <td key={v}>{a[v]}</td>)}
                <td className={`gt-out ${tried ? `v${col[r]}` : 'unk'}`}>{tried ? col[r] : '?'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
