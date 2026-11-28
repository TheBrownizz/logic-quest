import { useMemo, useState, type FormEvent } from 'react'
import type { LabPuzzle, World } from '../../content/types'
import type { RoomResult } from '../../game/progress'
import { stars } from '../../game/rules'
import { arrivalTimes, criticalPath, type Node } from '../../logic/circuit'
import { useSave } from '../save'
import { Stars } from '../Stars'
import { CircuitEditor } from './CircuitEditor'
import { ExamSaveNote, HostHints, RestartButton, useExamGrade, type PuzzleHost } from './roomParts'
import { autoLayout, needsLayout } from './labLogic'
import { referenceChips } from '../../content/chips'

type DelayPz = Extract<LabPuzzle, { type: 'delay' }>

export function DelayPuzzle({ host, puzzle, world }: { host: PuzzleHost; puzzle: DelayPz; world?: World }) {
  const [save] = useSave()
  const { solve, helped, markHelped, onRestart } = host
  // A delay room is a fixed diagram: it must render (and time) the same whether or not the player has built
  // its chips yet, so the world's reference chips take precedence over the player's own.
  const chips = useMemo(() => ({ ...save.chips, ...(world ? referenceChips(world) : {}) }), [save.chips, world])
  const circuit = useMemo(() => (needsLayout(puzzle.circuit) ? autoLayout(puzzle.circuit) : puzzle.circuit), [puzzle.circuit])
  const at = circuit.nodes.find(n => n.id === puzzle.askAt)
  const label = at?.label ?? puzzle.askAt

  const [answer, setAnswer] = useState('')
  const [done, setDone] = useState<{ correct: boolean; result?: RoomResult } | null>(null)
  const [celebrate, setCelebrate] = useState(0)

  /** A gate's own delay; a chip without one gets its inner worst-case arrival. Omitted if unknown. */
  const delays = useMemo(() => {
    const of = (n: Node): number | undefined => {
      if (n.delay !== undefined) return n.delay
      if (typeof n.kind !== 'object') return 0
      const chip = chips[n.kind.chip]
      if (!chip) return undefined
      try {
        const t = arrivalTimes(chip.circuit, chips, [chip.name])
        return Math.max(0, ...chip.circuit.nodes.filter(o => o.kind === 'OUT').map(o => t[o.id] ?? 0))
      } catch { return undefined }
    }
    const tags: Record<string, string> = {}
    for (const n of circuit.nodes) {
      if (n.kind === 'IN' || n.kind === 'OUT') continue
      const d = of(n)
      if (d !== undefined) tags[n.id] = `${d} ns`
    }
    return tags
  }, [circuit, chips])

  const analysis = useMemo(() => {
    if (!done) return null
    try {
      const t = arrivalTimes(circuit, chips)
      return { path: criticalPath(circuit, puzzle.askAt, chips), below: Object.fromEntries(Object.entries(t).map(([id, v]) => [id, `t=${v}`])) }
    } catch { return null }
  }, [done, circuit, puzzle.askAt, chips])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const v = Number(answer)
    if (exam || done || answer.trim() === '' || !Number.isFinite(v)) return
    const correct = v === puzzle.answer
    let result: RoomResult | undefined
    if (correct) {
      result = solve({ solved: true, optimal: true, noHints: !helped })
      setCelebrate(c => c + 1)
    } else markHelped() // the answer is now on screen, so a reload must not earn the no-hints star
    setDone({ correct, result })
  }

  const exam = !!host.exam
  useExamGrade(host, answer.trim() !== '' && Number.isFinite(Number(answer)) && Number(answer) === puzzle.answer, true, answer.trim() !== '')
  const retry = () => { setDone(null); setAnswer(''); markHelped() }

  return (
    <div className="lab-body">
      <CircuitEditor value={circuit} chips={chips} readOnly above={delays} below={analysis?.below}
        highlightPath={analysis?.path} celebrate={celebrate} />
      <form className="delay-q" onSubmit={submit}>
        <label htmlFor="tpd">מה ה-TPD בנקודה {label}?</label>
        <span className="tpd-field" dir="ltr">
          <input id="tpd" type="number" inputMode="decimal" step="any" className="mono" value={answer}
            onChange={e => setAnswer(e.target.value)} disabled={!!done} />
          <span className="mono muted">ns</span>
        </span>
        {!exam && <button type="submit" className="btn primary" disabled={!!done}>בדוק</button>}
        {!exam && <RestartButton onRestart={onRestart} />}
      </form>
      <div className="lab-panels">
        <div className="panel-col">
          {exam && <ExamSaveNote />}
          {done?.correct && (
            <div className="verdict good" role="status">
              <div className="verdict-head">
                <strong className="verdict-title">נכון!</strong>
                {done.result && <Stars n={stars(done.result)} testId="result-stars" />}
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
        <HostHints host={host} />
      </div>
    </div>
  )
}
