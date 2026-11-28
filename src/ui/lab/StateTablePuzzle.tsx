import { useMemo, useState } from 'react'
import type { LabPuzzle } from '../../content/types'
import type { RoomResult } from '../../game/progress'
import type { Bit } from '../../logic/boolean'
import { BitCell } from './BitCell'
import { MachineGiven, StateTableView } from './MachineGiven'
import { HostHints, RestartButton, SolvedVerdict, WRONG_TEXT, canReveal, revealNote, type PuzzleHost } from './roomParts'
import { checkStateTable, stateName, tableOf, usedRows, type RowCells, type TableCheck } from './seqLogic'

type Pz = Extract<LabPuzzle, { type: 'state-table' }>
const bitAt = (v: number, b: number, w: number) => ((v >> (w - 1 - b)) & 1) as Bit

/** Fill the next-state and/or output columns of a machine's state table. */
export function StateTablePuzzle({ host, puzzle }: { host: PuzzleHost; puzzle: Pz }) {
  const { solve, helped, markHelped, onRestart } = host
  const table = useMemo(() => tableOf(puzzle.machine), [puzzle.machine])
  const rows = usedRows(table)
  const fill = puzzle.fill ?? 'both'
  const [cells, setCells] = useState<RowCells[]>(() => rows.map(() => ({ next: Array(table.stateBits).fill(null), out: Array(table.outputs.length).fill(null) })))
  const [res, setRes] = useState<TableCheck | null>(null)
  const [wrong, setWrong] = useState(0)
  const [done, setDone] = useState<{ result?: RoomResult } | null>(null)

  const set = (row: number, col: 'next' | 'out', b: number, v: Bit | null) => {
    setCells(cs => cs.map((c, i) => (i === row ? { ...c, [col]: c[col].map((x, j) => (j === b ? v : x)) } : c)))
    setRes(null)
  }
  const check = () => {
    const r = checkStateTable(table, cells, fill)
    setRes(r)
    if (r.ok) setDone({ result: solve({ solved: true, optimal: true, noHints: !helped }) })
    else setWrong(w => w + 1)
  }
  const reveal = () => {
    markHelped()
    setCells(rows.map(r => ({
      next: Array.from({ length: table.stateBits }, (_, b) => bitAt(r.next!, b, table.stateBits)),
      out: Array.from({ length: table.outputs.length }, (_, b) => bitAt(r.out!, b, table.outputs.length)),
    })))
    setRes(null)
  }
  const asked = (col: 'next' | 'out') => fill === 'both' || fill === col

  const cell = (row: number, col: 'next' | 'out') => {
    const r = rows[row]
    const w = col === 'next' ? table.stateBits : table.outputs.length
    const v = col === 'next' ? r.next! : r.out!
    if (!asked(col)) return <span className="muted">{Array.from({ length: w }, (_, b) => bitAt(v, b, w)).join('')}</span>
    return (
      <span className="bitcells">
        {Array.from({ length: w }, (_, b) => {
          const bad = res?.wrong.some(x => x.row === row && x.col === col && x.bit === b)
          const val = cells[row][col][b]
          return (
            <BitCell key={b} value={val} disabled={!!done} testId={`st-${row}-${col}-${b}`}
              label={`${stateName(r.state)} ${table.inputs.join('')}=${r.input}, ${col === 'next' ? `${table.stateVars[b]}+` : table.outputs[b]}`}
              state={res && !res.ok ? (bad ? 'err' : val === null ? 'miss' : undefined) : undefined}
              onChange={x => set(row, col, b, x)} />
          )
        })}
      </span>
    )
  }

  return (
    <div className="lab-body seq-room">
      <MachineGiven machine={puzzle.machine} table={table} show={puzzle.show} />
      <p className="muted seq-help">לחצו על תא כדי לכתוב 0 או 1, או הקלידו 0 ו-1 במקלדת (המעבר לתא הבא אוטומטי).</p>
      <div data-bitgroup>
        <StateTableView table={table} cell={cell} />
      </div>
      <div className="lab-actions">
        <button type="button" className="btn primary" onClick={check} disabled={!!done}>בדוק</button>
        <RestartButton onRestart={onRestart} />
      </div>
      <div className="lab-panels">
        <div className="panel-col">
          {done && <SolvedVerdict result={done.result} />}
          {!done && res && !res.ok && (
            <div className="verdict bad" role="alert" key={wrong}>
              <strong>{res.missing > 0 && res.wrong.length === 0 ? `חסרים עוד ${res.missing} תאים` : WRONG_TEXT}</strong>
              {res.wrong.length > 0 && <p className="muted">התאים השגויים מסומנים באדום.</p>}
            </div>
          )}
          {!done && canReveal(host, wrong) && (
            <button type="button" className="btn ghost" onClick={reveal}>הצג תשובה{revealNote(host)}</button>
          )}
        </div>
        <HostHints host={host} />
      </div>
    </div>
  )
}
