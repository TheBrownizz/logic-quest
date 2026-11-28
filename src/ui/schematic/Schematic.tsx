import { useMemo } from 'react'
import { layoutSchematic } from './geometry'
import type { Netlist } from './netlist'
import './schematic.css'

const pts = (ps: Array<{ x: number; y: number }>) => ps.map(p => `${p.x},${p.y}`).join(' ')

/** A schematic drawn from a netlist (gates, a cross-coupled latch, flip-flop blocks), in theme colours. */
export function Schematic({ netlist, label, className }: { netlist: Netlist; label: string; className?: string }) {
  const l = useMemo(() => layoutSchematic(netlist), [netlist])
  const { x, y, w, h } = l.box
  return (
    <svg className={`schematic ${className ?? ''}`} viewBox={`${x} ${y} ${w} ${h}`} role="img" aria-label={label}
      data-testid="schematic" style={{ maxWidth: `${Math.round(w * 1.15)}px` }}>
      {l.prims.map((p, i) => {
        switch (p.t) {
          case 'path': return <path key={i} className={`sch-${p.cls}`} d={p.d} />
          case 'wire': return <polyline key={i} className="sch-wire" points={pts(p.points)} />
          case 'circle': return <circle key={i} className={`sch-${p.cls}`} cx={p.cx} cy={p.cy} r={p.r} />
          case 'text': return <text key={i} className={`sch-${p.cls}`} x={p.x} y={p.y} textAnchor={p.anchor} dominantBaseline="central">{p.text}</text>
        }
      })}
    </svg>
  )
}
