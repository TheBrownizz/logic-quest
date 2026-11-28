import { useMemo, useState } from 'react'
import type { LabPuzzle } from '../../content/types'
import type { RoomResult } from '../../game/progress'
import { reduceStates } from '../../logic/fsm'
import { MachineGiven } from './MachineGiven'
import { HostHints, RestartButton, SolvedVerdict, canReveal, revealNote, type PuzzleHost } from './roomParts'
import { checkPartition, stateName, tableOf, usedStates } from './seqLogic'

type Pz = Extract<LabPuzzle, { type: 'state-reduce' }>
const LETTERS = 'אבגדהוזח'

/** Put equivalent states in the same group (each state starts in a group of its own). */
export function StateReducePuzzle({ host, puzzle }: { host: PuzzleHost; puzzle: Pz }) {
  const { solve, helped, markHelped, onRestart } = host
  const table = useMemo(() => tableOf(puzzle.machine), [puzzle.machine])
  const states = useMemo(() => usedStates(table), [table])
  const [groups, setGroups] = useState<Record<number, number>>(() => Object.fromEntries(states.map((s, i) => [s, i])))
  const [res, setRes] = useState<ReturnType<typeof checkPartition> | null>(null)
  const [wrong, setWrong] = useState(0)
  const [done, setDone] = useState<{ result?: RoomResult } | null>(null)
  const move = (s: number, g: number) => { setGroups(gs => ({ ...gs, [s]: g })); setRes(null) }
  const check = () => {
    const r = checkPartition(table, groups)
    setRes(r)
    if (r.ok) setDone({ result: solve({ solved: true, optimal: true, noHints: !helped }) })
    else setWrong(w => w + 1)
  }
  const reveal = () => {
    markHelped()
    const next: Record<number, number> = {}
    reduceStates(table).forEach((g, i) => g.forEach(s => { next[s] = i }))
    setGroups(next)
    setRes(null)
  }
  const used = [...new Set(states.map(s => groups[s]))].sort((a, b) => a - b)

  return (
    <div className="lab-body seq-room">
      <MachineGiven machine={puzzle.machine} table={table} show={puzzle.show} />
      <p className="muted seq-help">בחרו לכל מצב קבוצה. מצבים שקולים יושבים באותה קבוצה; שם הקבוצה וסדר הקבוצות לא משנים.</p>
      <div className="reduce-grid" data-testid="reduce-grid">
        {states.map(s => (
          <div key={s} className="reduce-row" role="radiogroup" aria-label={`הקבוצה של ${stateName(s)}`}>
            <span className="mono reduce-state">{stateName(s)}</span>
            {states.map((_, g) => (
              <button key={g} type="button" role="radio" aria-checked={groups[s] === g} disabled={!!done}
                data-testid={`reduce-${s}-${g}`} aria-label={`קבוצה ${LETTERS[g]}`}
                className={`reduce-g c${g % 6}${groups[s] === g ? ' on' : ''}`} onClick={() => move(s, g)}>{LETTERS[g]}</button>
            ))}
          </div>
        ))}
      </div>
      <p className="reduce-sum" data-testid="reduce-sum">
        {used.map(g => (
          <span key={g} className={`reduce-chip c${g % 6}`}>
            <b>{LETTERS[g]}</b> <span className="mono" dir="ltr">{'{'}{states.filter(s => groups[s] === g).map(stateName).join(', ')}{'}'}</span>
          </span>
        ))}
      </p>
      <div className="lab-actions">
        <button type="button" className="btn primary" onClick={check} disabled={!!done}>בדוק</button>
        <RestartButton onRestart={onRestart} />
      </div>
      <div className="lab-panels">
        <div className="panel-col">
          {done && <SolvedVerdict result={done.result}><p>נשארו <span className="mono">{used.length}</span> מצבים.</p></SolvedVerdict>}
          {!done && res && !res.ok && (
            <div className="verdict bad" role="alert" key={wrong}>
              <strong>{res.unassigned.length ? 'יש מצבים בלי קבוצה' : used.length === res.expectedGroups ? 'מספר הקבוצות נכון, אבל החלוקה לא' : 'החלוקה לא נכונה, נסו שוב'}</strong>
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
