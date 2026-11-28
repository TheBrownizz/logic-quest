import { useState } from 'react'
import type { LabPuzzle } from '../../content/types'
import type { RoomResult } from '../../game/progress'
import { Prose } from '../Prose'
import { Schematic } from '../schematic/Schematic'
import { ExamSaveNote, HostHints, RestartButton, SolvedVerdict, WRONG_TEXT, useExamGrade, type PuzzleHost } from './roomParts'

type Pz = Extract<LabPuzzle, { type: 'identify' }>

/** Identify the memory element in a schematic. The optimal star needs the first answer right. In an exam the choice is graded at submit. */
export function IdentifyPuzzle({ host, puzzle }: { host: PuzzleHost; puzzle: Pz }) {
  const { solve, helped, onRestart } = host
  const [pick, setPick] = useState<number | null>(null)
  const [tries, setTries] = useState(0)
  const [lastWrong, setLastWrong] = useState(false)
  const [done, setDone] = useState<{ result?: RoomResult } | null>(null)
  const exam = !!host.exam
  const locked = !!done
  useExamGrade(host, pick === puzzle.correct, true, pick !== null)
  const check = () => {
    if (exam || pick === null || locked) return
    setTries(t => t + 1)
    if (pick === puzzle.correct) setDone({ result: solve({ solved: true, optimal: tries === 0, noHints: !helped }) })
    else setLastWrong(true)
  }
  return (
    <div className="lab-body seq-room">
      <Schematic netlist={puzzle.schematic} label="שרטוט של רכיב זיכרון" />
      <fieldset className="choice" disabled={locked}>
        <Prose as="legend" className="choice-q" text={puzzle.question} />
        {puzzle.options.map((o, i) => (
          <label key={i} className={`choice-opt${pick === i ? ' on' : ''}`} data-testid={`identify-opt-${i}`}>
            <input type="radio" name="identify" checked={pick === i} onChange={() => { setPick(i); setLastWrong(false) }} />
            <span className="mono choice-n">{i + 1}.</span> <Prose text={o} />
          </label>
        ))}
      </fieldset>
      {!exam && (
        <div className="lab-actions">
          <button type="button" className="btn primary" onClick={check} disabled={locked || pick === null}>בדוק</button>
          <RestartButton onRestart={onRestart} />
        </div>
      )}
      <div className="lab-panels">
        <div className="panel-col">
          {exam && <ExamSaveNote />}
          {done && <SolvedVerdict result={done.result}>{tries > 1 && <p className="muted">כוכב האופטימום ניתן על תשובה נכונה בניסיון הראשון.</p>}</SolvedVerdict>}
          {!done && lastWrong && <div className="verdict bad" role="alert" key={tries}><strong>{WRONG_TEXT}</strong></div>}
        </div>
        <HostHints host={host} />
      </div>
    </div>
  )
}
