import { useState, type FormEvent } from 'react'
import type { LabPuzzle } from '../../content/types'
import type { RoomResult } from '../../game/progress'
import { Prose } from '../Prose'
import { HostHints, RestartButton, canReveal, SolvedVerdict, WRONG_TEXT, revealNote, type PuzzleHost } from './roomParts'
import { checkNumber } from './labLogic'

type NumberPz = Extract<LabPuzzle, { type: 'number' }>

export function NumberPuzzle({ host, puzzle }: { host: PuzzleHost; puzzle: NumberPz }) {
  const { solve, helped, markHelped, onRestart } = host
  const [answer, setAnswer] = useState('')
  const [wrong, setWrong] = useState(0)
  const [lastWrong, setLastWrong] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [done, setDone] = useState<{ result?: RoomResult } | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (done || answer.trim() === '') return
    if (checkNumber(puzzle.check, answer, puzzle.answer)) {
      setDone({ result: solve({ solved: true, optimal: true, noHints: !helped }) })
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
          {done && <SolvedVerdict result={done.result} />}
          {!done && lastWrong && <div className="verdict bad" role="alert" key={wrong}><strong>{WRONG_TEXT}</strong></div>}
          {!done && canReveal(host, wrong) && !revealed && (
            <button type="button" className="btn ghost" onClick={reveal}>הצג תשובה{revealNote(host)}</button>
          )}
          {!done && revealed && (
            <p className="hint" data-testid="revealed">התשובה: <span className="mono">{puzzle.answer}</span></p>
          )}
        </div>
        <HostHints host={host} />
      </div>
    </div>
  )
}
