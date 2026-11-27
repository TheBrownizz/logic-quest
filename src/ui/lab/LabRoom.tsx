import { useEffect, useMemo, useRef, useState } from 'react'
import type { Room } from '../../content/types'
import type { RoomResult } from '../../game/progress'
import { stars } from '../../game/rules'
import type { Bit, TruthTable } from '../../logic/boolean'
import { circuitTruthTable, simulate, usesOnly, type Circuit } from '../../logic/circuit'
import { hrefs } from '../router'
import { useSave } from '../save'
import { NotFound } from '../StageScreen'
import { Prose } from '../Prose'
import { Stars } from '../Stars'
import { CircuitEditor } from './CircuitEditor'
import { CodePuzzle } from './CodePuzzle'
import { DelayPuzzle } from './DelayPuzzle'
import { KMapPuzzle } from './KMapPuzzle'
import { NumberPuzzle } from './NumberPuzzle'
import { Hints, useHelped, useSolve } from './roomParts'
import {
  alignTable, autoLayout, checkCircuit, errorText, findRoom, hasQueryFlag, initialCircuit,
  needsLayout, refersToChip, usableDraft, type CheckResult, type CircuitPuzzle,
  visibleRows,
} from './labLogic'
import './lab.css'

export function LabRoom({ roomId }: { roomId: string }) {
  const found = findRoom(roomId)
  if (!found) return <NotFound />
  const { world, stage, room } = found
  const pz = room.puzzle
  return (
    <section className="lab">
      <a className="back" href={hrefs.stage(world.id, stage.id)}>→ {stage.title}</a>
      <h1 className="title">{room.title}</h1>
      <Prose as="p" className="intro" text={room.intro} />
      {pz.type === 'circuit' ? <CircuitRoom key={room.id} room={room} puzzle={pz} />
        : pz.type === 'delay' ? <DelayPuzzle key={room.id} room={room} puzzle={pz} />
          : pz.type === 'kmap' ? <KMapPuzzle key={room.id} room={room} puzzle={pz} />
            : pz.type === 'number' ? <NumberPuzzle key={room.id} room={room} puzzle={pz} />
              : <CodePuzzle key={room.id} room={room} puzzle={pz} />}
    </section>
  )
}

/** `result` is the merged, saved result (stars); `attempt` is this attempt alone (checklist). */
type Verdict = { res: CheckResult; table?: TruthTable; result?: RoomResult; attempt?: RoomResult; unlocked?: string }

function CircuitRoom({ room, puzzle }: { room: Room; puzzle: CircuitPuzzle }) {
  const [save, update] = useSave()
  const solve = useSolve(room.id)
  const chips = save.chips
  const spec = puzzle.spec

  const palette = useMemo(() => {
    const own = Object.keys(chips).filter(name => {
      if (name === puzzle.unlocksChip?.name) return false
      try { return usesOnly(chips[name].circuit, puzzle.allowed, chips, [name]) } catch { return false }
    })
    return [...puzzle.allowed, ...own]
  }, [chips, puzzle])

  const [circuit, setCircuit] = useState<Circuit>(() => {
    const d = save.drafts[room.id]
    if (!usableDraft(d, spec)) return initialCircuit(spec)
    return needsLayout(d) ? autoLayout(d) : d
  })
  const [helped, markHelped] = useHelped(room.id)
  const [hintsShown, setHintsShown] = useState(0)
  const [inputs, setInputs] = useState<Record<string, Bit>>({})
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [sweep, setSweep] = useState<number | null>(null)
  const [celebrate, setCelebrate] = useState(0)
  const pendingRef = useRef<Verdict | null>(null)

  const edit = (c: Circuit) => {
    if (sweep !== null) return
    setCircuit(c)
    setVerdict(null)
    setCelebrate(0)
    update(d => ({ ...d, drafts: { ...d.drafts, [room.id]: c } }))
  }

  const autofilled = useRef(false)
  useEffect(() => {
    if (autofilled.current || !hasQueryFlag(window.location.search, window.location.hash, 'autofill')) return
    autofilled.current = true
    markHelped()
    edit(autoLayout(puzzle.reference))
  }, [])

  /** Shows a verdict that has already been saved. */
  const reveal = (v: Verdict) => {
    if (v.res.kind === 'ok') setCelebrate(c => c + 1)
    setVerdict(v)
  }

  const check = () => {
    if (sweep !== null) return
    const res = checkCircuit(circuit, puzzle, chips)
    let table: TruthTable | undefined
    const v: Verdict = { res }
    if (res.kind === 'ok') {
      try {
        const t = circuitTruthTable(circuit, chips)
        if (!('error' in t)) table = alignTable(spec, t)
      } catch { /* shown as the spec only */ }
      // Save now, so leaving during the sweep can't lose the solve. Never store a chip that
      // contains itself (only possible through an old draft).
      const unlock = puzzle.unlocksChip && !refersToChip(circuit, puzzle.unlocksChip.name, chips) ? puzzle.unlocksChip : undefined
      v.attempt = { solved: true, optimal: res.optimal, noHints: !helped }
      v.result = solve(v.attempt, unlock
        ? d => ({ ...d, chips: { ...d.chips, [unlock.name]: { name: unlock.name, inputs: [...unlock.inputs], outputs: [...unlock.outputs], circuit } } })
        : undefined)
      v.unlocked = unlock?.name
    } else if (res.kind === 'mismatch') table = res.actual
    v.table = table
    setVerdict(null)
    setCelebrate(0)
    if (table && spec.rows.length <= 16) { pendingRef.current = v; setSweep(0) }
    else reveal(v)
  }

  // Run through every input row on the canvas before revealing the verdict.
  const rowCount = spec.rows.length
  useEffect(() => {
    if (sweep === null) return
    const t = setTimeout(() => {
      if (sweep + 1 < rowCount) setSweep(sweep + 1)
      else {
        setSweep(null)
        const v = pendingRef.current
        pendingRef.current = null
        if (v) reveal(v)
      }
    }, 230)
    return () => clearTimeout(t)
    // reveal only calls state setters, so the timer depends on the row alone
  }, [sweep, rowCount])

  const rowInputs = (row: number): Record<string, Bit> =>
    Object.fromEntries(spec.inputs.map((name, j) => [name, ((row >> (spec.inputs.length - 1 - j)) & 1) as Bit]))
  const shownInputs = sweep !== null ? rowInputs(sweep) : inputs

  const status = useMemo(() => {
    try {
      const r = simulate(circuit, Object.fromEntries(spec.inputs.map(n => [n, shownInputs[n] ?? 0])), chips)
      return 'error' in r ? errorText[r.error.kind] : null
    } catch { return 'המעגל לא תקין' }
  }, [circuit, chips, shownInputs, spec.inputs])

  const res = verdict?.res
  const errorNode = res?.kind === 'error' ? res.error.nodeId : undefined
  const tableRow = sweep ?? (res?.kind === 'mismatch' ? res.row : undefined)

  return (
    <div className="lab-body">
      <div className="allowed muted">מותר: <span className="mono">{puzzle.allowed.join(' · ')}</span></div>
      <CircuitEditor
        value={circuit} onChange={edit} palette={palette} chips={chips}
        inputs={shownInputs} onToggleInput={name => setInputs(i => ({ ...i, [name]: i[name] ? 0 : 1 }))}
        errorNodeId={errorNode} celebrate={celebrate}
      />
      <div className="lab-actions">
        <button type="button" className="btn primary" onClick={check} disabled={sweep !== null}>בדוק</button>
        <button type="button" className="btn ghost" onClick={() => edit(initialCircuit(spec))} disabled={sweep !== null}>נקה</button>
        <span className={`live-status ${status ? 'muted' : 'ok'}`}>
          {sweep !== null ? 'בודק…' : status ? `חי · ${status}` : 'חי · המעגל שלם'}
        </span>
      </div>

      <div className="lab-panels">
        <div className="panel-col">
          {verdict && <VerdictView v={verdict} puzzle={puzzle} />}
          {(sweep !== null || res?.kind === 'mismatch' || res?.kind === 'ok') && (
            <TruthPanel spec={spec} actual={(sweep !== null ? pendingRef.current?.table : verdict?.table)} row={tableRow}
              revealed={sweep === null ? spec.rows.length : sweep + 1} mismatch={sweep === null && res?.kind === 'mismatch'} />
          )}
        </div>
        <Hints hints={room.hints} shown={hintsShown} onReveal={() => { setHintsShown(s => s + 1); markHelped() }} />
      </div>
    </div>
  )
}

function VerdictView({ v, puzzle }: { v: Verdict; puzzle: CircuitPuzzle }) {
  const r = v.res
  if (r.kind === 'ok') {
    const got = stars(v.result)
    return (
      <div className="verdict good" role="status">
        <div className="verdict-head">
          <strong className="verdict-title">נכון!</strong>
          <Stars n={got} testId="result-stars" />
        </div>
        <p className="mono-num">{r.gates} שערים · אופטימום {puzzle.optimalGates}</p>
        <ul className="checks">
          <li className="ok">✓ המעגל עובד</li>
          <li className={v.attempt?.optimal ? 'ok' : 'muted'}>{v.attempt?.optimal ? '✓' : '○'} מספר שערים אופטימלי</li>
          <li className={v.attempt?.noHints ? 'ok' : 'muted'}>{v.attempt?.noHints ? '✓' : '○'} בלי רמזים</li>
        </ul>
        {v.unlocked && <p className="unlock">רכיב חדש נפתח: {v.unlocked}</p>}
      </div>
    )
  }
  const msg = r.kind === 'error' ? errorText[r.error.kind]
    : r.kind === 'mismatch' ? `לא נכון: היציאה ${r.output} שגויה בשורה ${r.row + 1}`
      : r.kind === 'disallowed' ? 'יש במעגל שער שאינו מותר בחדר הזה'
        : 'משהו במעגל לא תקין. נסו לבנות אותו מחדש.'
  return <div className="verdict bad" role="alert"><strong>{msg}</strong></div>
}

function TruthPanel({ spec, actual, row, revealed, mismatch }: { spec: TruthTable; actual?: TruthTable; row?: number; revealed: number; mismatch: boolean }) {
  const shown = visibleRows(spec.rows.length, row)
  return (
    <div className="tt-wrap">
      <table className="tt mono" dir="ltr">
        <thead>
          <tr>
            {spec.inputs.map(n => <th key={n}>{n}</th>)}
            {spec.outputs.map(o => <th key={o} className="sep">{o}<small> רצוי</small></th>)}
            {spec.outputs.map(o => <th key={`y${o}`} className="sep">{o}<small> שלך</small></th>)}
          </tr>
        </thead>
        <tbody>
          {shown.map(i => {
            const r = spec.rows[i]
            const bad = mismatch && row === i
            const cur = !mismatch && row === i
            return (
              <tr key={i} data-testid={`tt-row-${i}`} data-mismatch={bad ? 'true' : undefined} className={bad ? 'bad' : cur ? 'cur' : ''}>
                {spec.inputs.map((n, j) => <td key={n}>{(i >> (spec.inputs.length - 1 - j)) & 1}</td>)}
                {r.map((v, j) => <td key={j} className="sep">{v}</td>)}
                {spec.outputs.map((_, j) => {
                  const y = i < revealed ? actual?.rows[i]?.[j] : undefined
                  const ok = y === undefined || r[j] === 'x' || y === r[j]
                  return <td key={`y${j}`} className={`sep ${y === undefined ? 'muted' : ok ? 'ok' : 'err'}`}>{y ?? '·'}</td>
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
      {shown.length < spec.rows.length && (
        <p className="muted tt-note" data-testid="tt-note">מוצגות {shown.length} מתוך {spec.rows.length} שורות</p>
      )}
    </div>
  )
}
