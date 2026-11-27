import { useEffect, useState } from 'react'
import type { WidgetProps } from './types'
import { assignmentOf, rowCount } from './gateToyLogic'
import { flip, opened, pickRow, rowValues, triedDifferences, type IdentityBenchConfig, type IdentityBenchGoal, type IdentityBenchState } from './identityBenchLogic'
import './GateToy.css'
import './IdentityBench.css'

const STEP_MS = 560

/**
 * IdentityBench: two expressions side by side under the same switches. Every row you try fills both columns and
 * a verdict (equal or different). "Run all rows" walks the table row by row, so you watch the two columns agree
 * (an identity) or break at some row (not an identity).
 */
export function IdentityBench({ config, onState, reducedMotion }: WidgetProps<IdentityBenchConfig, IdentityBenchState, IdentityBenchGoal>) {
  const [state, setState] = useState(() => opened(config))
  const [last, setLast] = useState<number | null>(null)
  const [runAt, setRunAt] = useState<number | null>(null) // next row the run will show; null: not running
  useEffect(() => { onState(state) }, [state])

  const { vars, left, right } = config
  const N = rowCount(vars.length)
  const rowNow = vars.reduce((acc, v) => acc * 2 + (state.inputs[v] ? 1 : 0), 0)
  const [lv, rv] = rowValues(config, rowNow)
  const diffs = triedDifferences(config, state)
  const all = state.tried.length === N

  useEffect(() => {
    if (runAt === null) return
    if (runAt >= N) { setRunAt(null); return }
    const t = setTimeout(() => {
      setState(s => pickRow(config, s, runAt))
      setLast(runAt)
      setRunAt(runAt + 1)
    }, runAt === 0 ? 150 : STEP_MS)
    return () => clearTimeout(t)
  }, [runAt])

  const toggle = (v: string) => {
    const s = flip(config, state, v)
    setState(s)
    setLast(vars.reduce((a, x) => a * 2 + (s.inputs[x] ? 1 : 0), 0))
  }
  const go = (row: number) => { setState(pickRow(config, state, row)); setLast(row) }
  const runAll = () => {
    if (reducedMotion) {
      // the final state, without the walk
      let s = state
      for (let r = 0; r < N; r++) s = pickRow(config, s, r)
      setState(s)
      return
    }
    setState(opened(config))
    setLast(null)
    setRunAt(0)
  }

  return (
    <div className={`gt ib${reducedMotion ? ' reduced' : ''}`} data-testid="identity-bench">
      <div className="ib-exprs" dir="ltr">
        <div className="ib-expr" data-testid="ib-left"><span className="ib-name">f</span><span className="ib-formula" dir="ltr">{left.display}</span><span className={`ib-val v${lv}`} aria-label={`ערך f: ${lv}`}>{lv}</span></div>
        <div className={`ib-expr${lv !== rv ? ' differ' : ''}`} data-testid="ib-right"><span className="ib-name">g</span><span className="ib-formula" dir="ltr">{right.display}</span><span className={`ib-val v${rv}`} aria-label={`ערך g: ${rv}`}>{rv}</span></div>
      </div>

      <div className="ib-switches" dir="ltr" role="group" aria-label="קלטים">
        {vars.map(v => (
          <button key={v} type="button" role="switch" aria-checked={state.inputs[v] === 1} className={`ib-sw${state.inputs[v] ? ' on' : ''}`}
            data-testid={`ib-switch-${v}`} onClick={() => toggle(v)}>
            <span className="ib-sw-name">{v}</span><span className="ib-sw-val">{state.inputs[v]}</span>
          </button>
        ))}
        <button type="button" className="btn ib-run" data-testid="ib-run" disabled={runAt !== null} onClick={runAll}>הריצו את כל השורות</button>
      </div>

      <table className="gt-table ib-table" dir="ltr" data-testid="ib-table">
        <thead><tr><th scope="col">#</th>{vars.map(v => <th key={v} scope="col">{v}</th>)}<th scope="col" className="gt-th-out">f</th><th scope="col" className="gt-th-out">g</th><th scope="col" aria-label="השוואה"></th></tr></thead>
        <tbody>
          {Array.from({ length: N }, (_, r) => {
            const a = assignmentOf(vars, r)
            const tried = state.tried.includes(r)
            const [l, rt] = rowValues(config, r)
            return (
              <tr key={r} className={`${r === rowNow ? 'cur' : ''}${r === last ? ' fresh' : ''}${tried && l !== rt ? ' differ' : ''}`} data-testid={`ib-row-${r}`} data-tried={tried} data-differ={tried && l !== rt}>
                <th scope="row"><button type="button" className="gt-rowbtn" aria-label={`נסו את שורה ${r}`} disabled={runAt !== null} onClick={() => go(r)}>{r}</button></th>
                {vars.map(v => <td key={v}>{a[v]}</td>)}
                <td className={`gt-out ib-cell ${tried ? `v${l}` : 'unk'}`}>{tried ? l : '?'}</td>
                <td className={`gt-out ib-cell ${tried ? `v${rt}` : 'unk'}`}>{tried ? rt : '?'}</td>
                <td className={`ib-verdict ${tried ? (l === rt ? 'same' : 'diff') : 'unk'}`}>{tried ? (l === rt ? '=' : '≠') : ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <p className={`ib-status${diffs.length ? ' bad' : all ? ' good' : ''}`} role="status" data-testid="ib-status">
        {diffs.length
          ? <>{diffs.length === 1 ? 'נמצאה שורה שבה הם נבדלים' : 'נמצאו שורות שבהן הם נבדלים'} ({diffs.map((r, i) => <span key={r}>{i ? ', ' : ''}<bdi dir="ltr">{r}</bdi></span>)}), ולכן הם לא שקולים.</>
          : all
            ? 'בכל השורות הערכים זהים, ולכן שני הביטויים שקולים.'
            : `נוסו ${state.tried.length} מתוך ${N} שורות. עד כה אין הבדל.`}
      </p>
    </div>
  )
}
