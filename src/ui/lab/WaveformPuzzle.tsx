import { useState } from 'react'
import type { LabPuzzle } from '../../content/types'
import type { RoomResult } from '../../game/progress'
import type { Bit } from '../../logic/boolean'
import { BitCell } from './BitCell'
import { ExamSaveNote, HostHints, RestartButton, SolvedVerdict, WRONG_TEXT, canReveal, revealNote, useExamGrade, type PuzzleHost } from './roomParts'
import { checkWave, waveAnswer } from './seqLogic'
import { WAVE_COL, WaveLine } from './WavePlot'

type Pz = Extract<LabPuzzle, { type: 'waveform' }>

export const WAVE_KIND_TEXT: Record<Pz['kind'], string> = {
  'latch-D': 'D Latch (רגיש לרמה גבוהה)',
  'latch-SR': 'SR Latch עם Enable (רגיש לרמה גבוהה)',
  'ff-D': 'D Flip-Flop (קצה עולה)',
  'ff-T': 'T Flip-Flop (קצה עולה)',
  'ff-JK': 'JK Flip-Flop (קצה עולה)',
}

/** Draw Q column by column under the clock and the inputs. */
export function WaveformPuzzle({ host, puzzle }: { host: PuzzleHost; puzzle: Pz }) {
  const { solve, helped, markHelped, onRestart } = host
  const n = puzzle.clk.length
  const [q, setQ] = useState<Array<Bit | null>>(() => Array(n).fill(null))
  const [bad, setBad] = useState<number[] | null>(null)
  const [wrong, setWrong] = useState(0)
  const [done, setDone] = useState<{ result?: RoomResult } | null>(null)
  const exam = !!host.exam
  useExamGrade(host, checkWave(puzzle, q).ok, true, q.some(v => v !== null))
  const set = (i: number, v: Bit | null) => { setQ(a => a.map((x, j) => (j === i ? v : x))); setBad(null) }
  const check = () => {
    const r = checkWave(puzzle, q)
    setBad(r.wrong)
    if (r.ok) setDone({ result: solve({ solved: true, optimal: true, noHints: !helped }) })
    else setWrong(w => w + 1)
  }
  const reveal = () => { markHelped(); setQ(waveAnswer(puzzle)); setBad(null) }
  const signals: Array<[string, Bit[]]> = [['CLK', puzzle.clk], ...Object.entries(puzzle.inputs)]

  return (
    <div className="lab-body seq-room">
      <p className="seq-help">
        רכיב: <strong>{WAVE_KIND_TEXT[puzzle.kind]}</strong> · ערך התחלתי <span className="mono" dir="ltr">Q = {puzzle.q0}</span> (לפני העמודה הראשונה).
        <span className="muted"> לחצו על תאי Q או הקלידו 0 ו-1.</span>
      </p>
      <div className="wave-scroll" dir="ltr">
        <div className="wave" dir="ltr" data-testid="waveform" style={{ ['--wcol' as string]: `${WAVE_COL}px` }}>
          {signals.map(([name, bits]) => (
            <div key={name} className="wave-row">
              <span className="wave-name mono">{name}</span>
              <WaveLine bits={bits} edges={name === 'CLK'} cls={name === 'CLK' ? 'clk' : ''} />
            </div>
          ))}
          <div className="wave-row q">
            <span className="wave-name mono">Q</span>
            <div className="wave-q">
              <WaveLine bits={q} cls="q" />
              <div className="wave-cells" data-bitgroup>
                {q.map((v, i) => (
                  <BitCell key={i} value={v} disabled={!!done} testId={`wave-q-${i}`} label={`Q בעמודה ${i + 1}`}
                    state={bad?.includes(i) ? (v === null ? 'miss' : 'err') : undefined} onChange={x => set(i, x)} />
                ))}
              </div>
            </div>
          </div>
          <div className="wave-row idx">
            <span className="wave-name" />
            <div className="wave-cols mono">{q.map((_, i) => <span key={i}>{i + 1}</span>)}</div>
          </div>
        </div>
      </div>
      {!exam && (
        <div className="lab-actions">
          <button type="button" className="btn primary" onClick={check} disabled={!!done}>בדוק</button>
          <RestartButton onRestart={onRestart} />
        </div>
      )}
      <div className="lab-panels">
        <div className="panel-col">
          {exam && <ExamSaveNote />}
          {done && <SolvedVerdict result={done.result} />}
          {!done && bad && bad.length > 0 && (
            <div className="verdict bad" role="alert" key={wrong}>
              <strong>{q.some(v => v === null) ? 'מלאו את כל העמודות' : WRONG_TEXT}</strong>
              <p className="muted">העמודות השגויות מסומנות.</p>
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
