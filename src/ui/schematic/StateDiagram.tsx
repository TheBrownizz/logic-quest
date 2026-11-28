import { useId, useMemo } from 'react'
import type { StateTable } from '../../logic/fsm'
import { layoutStateDiagram, type DiagramOptions } from './stateDiagram'
import './schematic.css'

/**
 * A state diagram of `table`. `current` highlights a state, `lastEdge` an arrow ("from>to"); both optional
 * (StateWalker uses them).
 */
export function StateDiagram({ table, options, label, current, lastEdge }: {
  table: StateTable; options?: DiagramOptions; label: string; current?: number; lastEdge?: string
}) {
  const d = useMemo(() => layoutStateDiagram(table, options), [table, options])
  const id = useId().replace(/:/g, '')
  const { x, y, w, h } = d.box
  return (
    <svg className="state-diagram" viewBox={`${x} ${y} ${w} ${h}`} role="img" aria-label={label} data-testid="state-diagram"
      style={{ maxWidth: `${Math.round(w * 1.2)}px` }}>
      <defs>
        <marker id={`arr-${id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 Z" className="sd-head" />
        </marker>
        <marker id={`arr-hot-${id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 Z" className="sd-head hot" />
        </marker>
      </defs>
      {d.edges.map(e => {
        const hot = lastEdge === `${e.from}>${e.to}`
        return (
          <g key={`${e.from}>${e.to}`} className={`sd-edge${hot ? ' hot' : ''}`} data-testid={`sd-edge-${e.from}-${e.to}`}>
            <path d={e.d} markerEnd={`url(#${hot ? 'arr-hot-' : 'arr-'}${id})`} />
            <text x={e.lx} y={e.ly} textAnchor="middle" dominantBaseline="central">{e.label}</text>
          </g>
        )
      })}
      {d.nodes.map(n => (
        <g key={n.code} className={`sd-node${current === n.code ? ' cur' : ''}`} data-testid={`sd-node-${n.code}`}>
          <circle cx={n.x} cy={n.y} r={d.r} />
          <text x={n.x} y={n.y - 7} textAnchor="middle" dominantBaseline="central" className="sd-name">{n.name}</text>
          <text x={n.x} y={n.y + 10} textAnchor="middle" dominantBaseline="central" className="sd-sub">{n.sub}</text>
        </g>
      ))}
    </svg>
  )
}
