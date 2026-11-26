import { useMemo, useState, type FormEvent } from 'react'
import type { LabPuzzle, Room } from '../../content/types'
import type { RoomResult } from '../../game/progress'
import { stars } from '../../game/rules'
import { arrivalTimes, criticalPath } from '../../logic/circuit'
import { useSave } from '../save'
import { Stars } from '../Stars'
import { CircuitEditor } from './CircuitEditor'
import { Hints, useSolve } from './roomParts'
import { autoLayout, needsLayout } from './labLogic'

type DelayPz = Extract<LabPuzzle, { type: 'delay' }>

export function DelayPuzzle({ room, puzzle }: { room: Room; puzzle: DelayPz }) {
  const [save] = useSave()
  const solve = useSolve(room.id)
  const circuit = useMemo(() => (needsLayout(puzzle.circuit) ? autoLayout(puzzle.circuit) : puzzle.circuit), [puzzle.circuit])
  const at = circuit.nodes.find(n => n.id === puzzle.askAt)
  const label = at?.label ?? puzzle.askAt

  const [answer, setAnswer] = useState('')
  const [done, setDone] = useState<{ correct: boolean; result?: RoomResult } | null>(null)
  const [helped, setHelped] = useState(false)
  const [hintsShown, setHintsShown] = useState(0)
  const [celebrate, setCelebrate] = useState(0)

  const delays = useMemo(() => Object.fromEntries(circuit.nodes
    .filter(n => n.kind !== 'IN' && n.kind !== 'OUT')
    .map(n => [n.id, `${n.delay ?? 0} ns`])), [circuit])

  const analysis = useMemo(() => {
    if (!done) return null
    try {
      const t = arrivalTimes(circuit, save.chips)
      return { path: criticalPath(circuit, puzzle.askAt, save.chips), below: Object.fromEntries(Object.entries(t).map(([id, v]) => [id, `t=${v}`])) }
    } catch { return null }
  }, [done, circuit, puzzle.askAt, save.chips])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const v = Number(answer)
    if (done || answer.trim() === '' || !Number.isFinite(v)) return
    const correct = v === puzzle.answer
    let result: RoomResult | undefined
    if (correct) {
      result = solve({ solved: true, optimal: true, noHints: !helped })
      setCelebrate(c => c + 1)
    }
    setDone({ correct, result })
  }

  const retry = () => { setDone(null); setAnswer(''); setHelped(true) }

  return (
    <div className="lab-body">
      <CircuitEditor value={circuit} chips={save.chips} readOnly above={delays} below={analysis?.below}
        highlightPath={analysis?.path} celebrate={celebrate} />
      <form className="delay-q" onSubmit={submit}>
        <label htmlFor="tpd">מה ה-TPD בנקודה {label}?</label>
        <span className="tpd-field" dir="ltr">
          <input id="tpd" type="number" inputMode="decimal" step="any" className="mono" value={answer}
            onChange={e => setAnswer(e.target.value)} disabled={!!done} />
          <span className="mono muted">ns</span>
        </span>
        <button type="submit" className="btn primary" disabled={!!done}>בדוק</button>
      </form>
      <div className="lab-panels">
        <div className="panel-col">
          {done?.correct && (
            <div className="verdict good" role="status">
              <div className="verdict-head">
                <strong className="verdict-title">נכון!</strong>
                <Stars n={stars(done.result)} testId="result-stars" />
              </div>
              <p>המסלול הקריטי מסומן בכתום; ליד כל רכיב זמן ההגעה שלו.</p>
            </div>
          )}
          {done && !done.correct && (
            <div className="verdict bad" role="alert">
              <strong>לא נכון. ה-TPD בנקודה {label} הוא <span className="mono">{puzzle.answer} ns</span>.</strong>
              <p>עקבו אחרי המסלול המסומן וזמני ההגעה.</p>
              <button type="button" className="btn ghost" onClick={retry}>נסו שוב</button>
            </div>
          )}
        </div>
        <Hints hints={room.hints} shown={hintsShown} onReveal={() => { setHintsShown(s => s + 1); setHelped(true) }} />
      </div>
    </div>
  )
}
