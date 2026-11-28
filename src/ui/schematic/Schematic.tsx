import { useMemo } from 'react'
import { layoutSchematic, wirePath } from './geometry'
import type { Netlist } from './netlist'
import './schematic.css'

/**
 * A schematic drawn from a netlist (gates, a cross-coupled latch, flip-flop blocks), in theme colours. It never
 * shrinks below a readable width: a narrow screen scrolls it sideways instead.
 */
export function Schematic({ netlist, label, className }: { netlist: Netlist; label: string; className?: string }) {
  const l = useMemo(() => layoutSchematic(netlist), [netlist])
  const { x, y, w, h } = l.box
  return (
    <div className="schematic-scroll" dir="ltr">
    <svg className={`schematic ${className ?? ''}`} viewBox={`${x} ${y} ${w} ${h}`} role="img" aria-label={label}
      data-testid="schematic" style={{ maxWidth: `${Math.round(w * 1.15)}px`, minWidth: `${Math.round(Math.min(w * 0.8, 480))}px` }}>
      {l.prims.map((p, i) => {
        switch (p.t) {
          case 'path': return <path key={i} className={`sch-${p.cls}`} d={p.d} />
          case 'wire': return <path key={i} className="sch-wire" d={wirePath(p.points, p.hops)} />
          case 'circle': return <circle key={i} className={`sch-${p.cls}`} cx={p.cx} cy={p.cy} r={p.r} />
          case 'text': return <text key={i} className={`sch-${p.cls}`} x={p.x} y={p.y} textAnchor={p.anchor} dominantBaseline="central">{p.text}</text>
        }
      })}
    </svg>
    </div>
  )
}
