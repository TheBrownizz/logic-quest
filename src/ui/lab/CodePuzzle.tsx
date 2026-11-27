import { useState, type FormEvent } from 'react'
import type { LabPuzzle, Room } from '../../content/types'
import type { RoomResult } from '../../game/progress'
import { Hints, REVEAL_AFTER, RestartButton, SolvedVerdict, WRONG_TEXT, useHelped, useSolve } from './roomParts'
import { checkCode } from './labLogic'
import { ProseLines } from '../Prose'

type CodePz = Extract<LabPuzzle, { type: 'code' }>

export function CodePuzzle({ room, puzzle, onRestart }: { room: Room; puzzle: CodePz; onRestart: () => void }) {
  const solve = useSolve(room.id)
  const [helped, markHelped] = useHelped(room.id)
  const [given, setGiven] = useState<string[]>(() => puzzle.inputs.map(() => ''))
  const [marks, setMarks] = useState<boolean[] | null>(null)
  const [wrong, setWrong] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [done, setDone] = useState<RoomResult | null>(null)
  const [hintsShown, setHintsShown] = useState(0)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (done) return
    const ok = checkCode(puzzle.encode, puzzle.inputs, given)
    setMarks(ok)
    if (ok.every(Boolean)) setDone(solve({ solved: true, optimal: true, noHints: !helped }))
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
                className={`mono num-input ${mark === true ? 'ok' : mark === false ? 'err' : ''}`}
                value={given[i]} disabled={!!done} onChange={e => set(i, e.target.value)} />
              {revealed && !done && <span className="mono code-ans" data-testid={`revealed-${i}`}>{puzzle.encode(inp)}</span>}
            </div>
          )
        })}
        <div className="row">
          <button type="submit" className="btn primary" disabled={!!done}>בדוק</button>
          <RestartButton onRestart={onRestart} />
        </div>
      </form>
      <div className="lab-panels">
        <div className="panel-col">
          {done && <SolvedVerdict result={done} />}
          {!done && marks && <div className="verdict bad" role="alert" key={wrong}><strong>{WRONG_TEXT}</strong></div>}
          {!done && wrong >= REVEAL_AFTER && !revealed && (
            <button type="button" className="btn ghost" onClick={reveal}>הצג תשובה <span className="muted">· מוותר על כוכב</span></button>
          )}
        </div>
        <Hints hints={room.hints} shown={hintsShown} onReveal={() => { setHintsShown(s => s + 1); markHelped() }} />
      </div>
    </div>
  )
}
