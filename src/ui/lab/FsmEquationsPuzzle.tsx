import { useCallback, useMemo, useState, type FormEvent } from 'react'
import type { LabPuzzle } from '../../content/types'
import type { RoomResult } from '../../game/progress'
import { envOf } from '../../logic/expr'
import { formatSOP, minimizeSOP } from '../../logic/qm'
import { KMapPuzzle } from './KMapPuzzle'
import { MachineGiven } from './MachineGiven'
import { HostHints, RestartButton, SolvedVerdict, canReveal, revealNote, type PuzzleHost } from './roomParts'
import { checkEquations, designFunctions, tableOf, varsOf, type DesignFn, type EquationsCheck } from './seqLogic'

type Pz = Extract<LabPuzzle, { type: 'fsm-equations' }>

/** A host for the helper k-map inside the room: nothing is saved and it gives no stars. */
function scratchHost(onRestart: () => void): PuzzleHost {
  return { hints: [], helped: false, markHelped: () => {}, solve: () => undefined, stars: false, onRestart }
}

/** Write the flip-flop input and output equations of a machine with a given encoding, with a k-map per function. */
export function FsmEquationsPuzzle({ host, puzzle }: { host: PuzzleHost; puzzle: Pz }) {
  const { solve, helped, markHelped, onRestart } = host
  const ff = puzzle.ff ?? 'D'
  const table = useMemo(() => tableOf(puzzle.machine), [puzzle.machine])
  const vars = useMemo(() => varsOf(table), [table])
  const fns = useMemo(() => designFunctions(table, ff), [table, ff])
  const [answers, setAnswers] = useState<Record<string, string>>(() => Object.fromEntries(fns.map(f => [f.name, ''])))
  const [res, setRes] = useState<EquationsCheck | null>(null)
  const [wrong, setWrong] = useState(0)
  const [done, setDone] = useState<{ result?: RoomResult; check: EquationsCheck } | null>(null)
  const [map, setMap] = useState<string | null>(null)
  const [mapKey, setMapKey] = useState(0)

  const set = (name: string, v: string) => { setAnswers(a => ({ ...a, [name]: v })); setRes(null) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (done) return
    const r = checkEquations(fns, vars, answers)
    setRes(r)
    if (r.ok) setDone({ check: r, result: solve({ solved: true, optimal: r.optimal, noHints: !helped }) })
    else setWrong(w => w + 1)
  }
  const reveal = () => {
    markHelped()
    setAnswers(Object.fromEntries(fns.map(f => [f.name, formatSOP(minimizeSOP(vars.length, f.minterms, f.dontCares), vars)])))
    setRes(null)
  }
  const restartMap = useCallback(() => setMapKey(k => k + 1), [])
  const kmapHost = useMemo(() => scratchHost(restartMap), [restartMap])
  const shown: DesignFn | undefined = fns.find(f => f.name === map)
  const rowText = (m: number) => Object.entries(envOf(vars, m)).map(([k, v]) => `${k}=${v}`).join(' ')
  const ffName = ff === 'JK' ? 'JK' : ff

  return (
    <div className="lab-body seq-room">
      <MachineGiven machine={puzzle.machine} table={table} show={puzzle.show} />
      <p className="muted seq-help">
        הקידוד נתון: <span className="mono">{table.stateVars.join(', ')}</span> הם משתני המצב (הראשון MSB), והכניסה היא ה-LSB.
        כתבו לכל כניסת דלגלג {ffName} ולכל יציאה ביטוי SOP, למשל <span className="mono" dir="ltr">A'X + B</span>. מצבים שאינם בשימוש הם Don't Care.
      </p>
      <form className="seq-eq-form" onSubmit={submit}>
        {fns.map(f => {
          const st = res?.results[f.name]
          return (
            <div key={f.name} className="seq-eq-row">
              <label htmlFor={`eq-${f.name}`} className="mono seq-eq-name" dir="ltr">{f.name} =</label>
              <input id={`eq-${f.name}`} data-testid={`eq-${f.name}`} dir="ltr" autoComplete="off" spellCheck={false}
                className={`mono num-input seq-eq-input ${st?.status === 'ok' ? 'ok' : st ? 'err' : ''}`}
                value={answers[f.name]} disabled={!!done} onChange={e => set(f.name, e.target.value)} />
              <button type="button" className={`btn ghost${map === f.name ? ' on' : ''}`} aria-pressed={map === f.name}
                onClick={() => { setMap(m => (m === f.name ? null : f.name)); setMapKey(k => k + 1) }}>מפת קרנו</button>
              {st && st.status !== 'ok' && (
                <span className="seq-eq-msg err" data-testid={`eq-msg-${f.name}`}>
                  {st.status === 'empty' ? 'חסר ביטוי' : st.status === 'parse' ? 'הביטוי לא מובן' : <>שגוי בשורה <span className="mono" dir="ltr">{rowText(st.row)}</span></>}
                </span>
              )}
              {st?.status === 'ok' && <span className="seq-eq-msg ok" aria-label="נכון">✓</span>}
            </div>
          )
        })}
        <div className="row">
          <button type="submit" className="btn primary" disabled={!!done}>בדוק</button>
          <RestartButton onRestart={onRestart} />
        </div>
      </form>
      {shown && !done && (
        <div className="seq-kmap" data-testid="seq-kmap">
          <p className="muted">מפת קרנו של <span className="mono">{shown.name}</span>. כשהכיסוי נכון, הביטוי נכתב בשדה.</p>
          <KMapPuzzle key={`${shown.name}#${mapKey}`} host={kmapHost} names={vars}
            puzzle={{ type: 'kmap', nVars: vars.length as 2 | 3 | 4, minterms: shown.minterms, dontCares: shown.dontCares }}
            onSolved={expr => set(shown.name, expr)} />
        </div>
      )}
      <div className="lab-panels">
        <div className="panel-col">
          {done && (
            <SolvedVerdict result={done.result}>
              <p className="mono-num">{done.check.literals} ליטרלים · מינימום {done.check.minLiterals}</p>
              {!done.check.optimal && <p>אפשר עם פחות ליטרלים: נצלו את ה-Don't Care וקבוצות גדולות יותר{host.stars ? ', כדי לקבל כוכב אופטימום' : ''}.</p>}
            </SolvedVerdict>
          )}
          {!done && res && !res.ok && <div className="verdict bad" role="alert" key={wrong}><strong>יש משוואות שגויות. הן מסומנות למעלה.</strong></div>}
          {!done && canReveal(host, wrong) && (
            <button type="button" className="btn ghost" onClick={reveal}>הצג תשובה{revealNote(host)}</button>
          )}
        </div>
        <HostHints host={host} />
      </div>
    </div>
  )
}
