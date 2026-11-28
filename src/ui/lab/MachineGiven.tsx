import type { ReactNode } from 'react'
import type { MachineSpec } from '../../content/types'
import type { StateTable } from '../../logic/fsm'
import { StateDiagram } from '../schematic/StateDiagram'
import { bitsOf } from '../schematic/stateDiagram'
import { stateName, usedRows } from './seqLogic'

/** A machine's equations, one per line, left to right ("A⁺ = A'X + B", "Y = AB'"). */
export function EquationsView({ machine }: { machine: Extract<MachineSpec, { from: 'equations' }> }) {
  return (
    <div className="seq-eqs mono" dir="ltr" data-testid="given-equations">
      {Object.entries(machine.next).map(([v, e]) => <div key={v}>{v}<sup>+</sup> = {e}</div>)}
      {Object.entries(machine.out).map(([v, e]) => <div key={v}>{v} = {e}</div>)}
    </div>
  )
}

/**
 * A state table in the course layout: one row per used state and input (state MSB … input LSB), columns
 * present state, input, next state, output. `cell` replaces the next/output cells (the state-table room).
 */
export function StateTableView({ table, cell, caption, rows: only }: {
  table: StateTable
  caption?: string
  /** Show only these present states (state-table `rows`). */
  rows?: number[]
  cell?: (row: number, col: 'next' | 'out') => ReactNode
}) {
  const rows = usedRows(table).filter(r => !only || only.includes(r.state))
  const sv = table.stateVars.join('')
  return (
    <div className="seq-table-wrap">
      <table className="seq-table" dir="ltr" data-testid="state-table">
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            <th scope="col">PS<small>{sv}</small></th>
            {table.inputs.length > 0 && <th scope="col">{table.inputs.join('')}</th>}
            <th scope="col" className="sep">NS<small>{sv}</small></th>
            {table.outputs.length > 0 && <th scope="col" className="sep">{table.outputs.join('')}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i > 0 && rows[i - 1].state !== r.state ? 'grp' : ''}>
              <td><span className="seq-sname">{stateName(r.state)}</span> {bitsOf(r.state, table.stateBits)}</td>
              {table.inputs.length > 0 && <td>{bitsOf(r.input, table.inputs.length)}</td>}
              <td className="sep">{cell ? cell(i, 'next') : bitsOf(r.next!, table.stateBits)}</td>
              {table.outputs.length > 0 && <td className="sep">{cell ? cell(i, 'out') : bitsOf(r.out!, table.outputs.length)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** The machine as the puzzle shows it. */
export function MachineGiven({ machine, table, show }: { machine: MachineSpec; table: StateTable; show: 'equations' | 'diagram' | 'table' | 'none' }) {
  if (show === 'none') return null
  return (
    <div className="seq-given" data-testid="machine-given">
      {show === 'equations' && machine.from === 'equations' && <EquationsView machine={machine} />}
      {show === 'diagram' && <StateDiagram table={table} label="דיאגרמת מצבים" />}
      {show === 'table' && <StateTableView table={table} />}
    </div>
  )
}
