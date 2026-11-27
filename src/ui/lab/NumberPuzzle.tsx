import { useState, type FormEvent } from 'react'
import type { LabPuzzle, Room } from '../../content/types'
import type { RoomResult } from '../../game/progress'
import { Prose } from '../Prose'
import { Hints, REVEAL_AFTER, RestartButton, SolvedVerdict, WRONG_TEXT, useHelped, useSolve } from './roomParts'
import { checkNumber } from './labLogic'

type NumberPz = Extract<LabPuzzle, { type: 'number' }>

export function NumberPuzzle({ room, puzzle, onRestart }: { room: Room; puzzle: NumberPz; onRestart: () => void }) {
  const solve = useSolve(room.id)
  const [helped, markHelped] = useHelped(room.id)
  const [answer, setAnswer] = useState('')
  const [wrong, setWrong] = useState(0)
  const [lastWrong, setLastWrong] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [done, setDone] = useState<RoomResult | null>(null)
  const [hintsShown, setHintsShown] = useState(0)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (done || answer.trim() === '') return
    if (checkNumber(puzzle.check, answer, puzzle.answer)) {
      setDone(solve({ solved: true, optimal: true, noHints: !helped }))
      setLastWrong(false)
    } else {
      setWrong(w => w + 1)
      setLastWrong(true)
    }
  }

  const reveal = () => { markHelped(); setRevealed(true) }

  return (
    <div className="lab-body">
      <form className="num-q" onSubmit={submit}>
        <Prose as="label" htmlFor="num" className="num-prompt" text={puzzle.prompt} />
        <div className="num-row">
          <input id="num" data-testid="number-input" className="mono num-input" dir="ltr" autoComplete="off" spellCheck={false}
            value={answer} disabled={!!done} placeholder="…"
            onChange={e => { setAnswer(e.target.value); setLastWrong(false) }} />
          <button type="submit" className="btn primary" disabled={!!done}>בדוק</button>
          <RestartButton onRestart={onRestart} />
        </div>
      </form>
      <div className="lab-panels">
        <div className="panel-col">
          {done && <SolvedVerdict result={done} />}
          {!done && lastWrong && <div className="verdict bad" role="alert" key={wrong}><strong>{WRONG_TEXT}</strong></div>}
          {!done && wrong >= REVEAL_AFTER && !revealed && (
            <button type="button" className="btn ghost" onClick={reveal}>הצג תשובה <span className="muted">· מוותר על כוכב</span></button>
          )}
          {!done && revealed && (
            <p className="hint" data-testid="revealed">התשובה: <span className="mono">{puzzle.answer}</span></p>
          )}
        </div>
        <Hints hints={room.hints} shown={hintsShown} onReveal={() => { setHintsShown(s => s + 1); markHelped() }} />
      </div>
    </div>
  )
}
