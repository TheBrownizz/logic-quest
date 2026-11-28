import { useState, type FormEvent } from 'react'
import type { LabPuzzle } from '../../content/types'
import type { RoomResult } from '../../game/progress'
import { ExamSaveNote, HostHints, RestartButton, canReveal, SolvedVerdict, WRONG_TEXT, revealNote, useExamGrade, type PuzzleHost } from './roomParts'
import { checkCode } from './labLogic'
import { ProseLines } from '../Prose'

type CodePz = Extract<LabPuzzle, { type: 'code' }>

export function CodePuzzle({ host, puzzle }: { host: PuzzleHost; puzzle: CodePz }) {
  const { solve, helped, markHelped, onRestart } = host
  const [given, setGiven] = useState<string[]>(() => puzzle.inputs.map(() => ''))
  const [marks, setMarks] = useState<boolean[] | null>(null)
  const [wrong, setWrong] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [done, setDone] = useState<{ result?: RoomResult } | null>(null)

  const exam = !!host.exam
  useExamGrade(host, checkCode(puzzle.encode, puzzle.inputs, given).every(Boolean), true, given.some(g => g.trim() !== ''))
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (exam || done) return
    const ok = checkCode(puzzle.encode, puzzle.inputs, given)
    setMarks(ok)
    if (ok.every(Boolean)) setDone({ result: solve({ solved: true, optimal: true, noHints: !helped }) })
    else setWrong(w => w + 1)
  }

  const set = (i: number, v: string) => {
    setGiven(g => g.map((x, j) => (j === i ? v : x)))
    setMarks(null)
  }
  const reveal = () => { markHelped(); setRevealed(true) }

  return (
    <div className="lab-body">
      <ProseLines className="code-def" data-testid="code-def" text={puzzle.definition} />
      <form className="code-q" onSubmit={submit}>
        <p className="muted code-ask">מה הקידוד של כל ערך? הקלידו את ביטי היציאה.</p>
        {puzzle.inputs.map((inp, i) => {
          const mark = marks?.[i]
          return (
            <div key={i} className="code-row">
              <label htmlFor={`code-${i}`} className="mono code-in" dir="ltr">{inp}</label>
              <span className="muted" aria-hidden>←</span>
              <input id={`code-${i}`} data-testid={`code-input-${i}`} dir="ltr" autoComplete="off" spellCheck={false}
                className={`mono num-input ${exam ? '' : mark === true ? 'ok' : mark === false ? 'err' : ''}`}
                value={given[i]} disabled={!!done} onChange={e => set(i, e.target.value)} />
              {revealed && !done && <span className="mono code-ans" data-testid={`revealed-${i}`}>{puzzle.encode(inp)}</span>}
            </div>
          )
        })}
        <div className="row">
          {!exam && <button type="submit" className="btn primary" disabled={!!done}>בדוק</button>}
          {!exam && <RestartButton onRestart={onRestart} />}
        </div>
      </form>
      <div className="lab-panels">
        <div className="panel-col">
          {exam && <ExamSaveNote />}
          {done && <SolvedVerdict result={done.result} />}
          {!done && marks && <div className="verdict bad" role="alert" key={wrong}><strong>{WRONG_TEXT}</strong></div>}
          {!done && canReveal(host, wrong) && !revealed && (
            <button type="button" className="btn ghost" onClick={reveal}>הצג תשובה{revealNote(host)}</button>
          )}
        </div>
        <HostHints host={host} />
      </div>
    </div>
  )
}
