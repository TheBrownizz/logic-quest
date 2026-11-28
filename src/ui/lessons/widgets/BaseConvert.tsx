import { useEffect, useMemo, useRef, useState } from 'react'
import type { WidgetProps } from './types'
import {
  advance, divisionSteps, groupPlan, initial, stateAt, totalSteps, valueOfConfig,
  type BaseConvertConfig, type BaseConvertGoal, type BaseConvertState,
} from './baseConvertLogic'
import './BaseConvert.css'

const sub = (n: number) => String(n).split('').map(d => '₀₁₂₃₄₅₆₇₈₉'[+d]).join('')
const dch = (d: number) => d.toString(16).toUpperCase()
const STEP_MS = 800

/**
 * BaseConvert. 'divide': every press divides by the target base; the remainder drops into its slot of the result,
 * starting from the right. 'group': every press forms one group of bits (or opens one digit into its bits) and
 * the matching digit appears under it. "Run all" plays the steps in order; with reduced motion it jumps to the end.
 */
export function BaseConvert({ config, goal, onState, completed, reducedMotion }: WidgetProps<BaseConvertConfig, BaseConvertState, BaseConvertGoal>) {
  const total = useMemo(() => totalSteps(config), [config])
  const [state, setState] = useState<BaseConvertState>(() => (completed && goal !== undefined ? stateAt(config, total) : initial(config)))
  const [playing, setPlaying] = useState(false)
  useEffect(() => { onState(state) }, [state]) // eslint-disable-line react-hooks/exhaustive-deps
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const stop = () => { if (timer.current) clearInterval(timer.current); timer.current = null; setPlaying(false) }
  useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])
  useEffect(() => { if (state.finished && playing) stop() }, [state.finished, playing])

  const step = () => setState(s => advance(config, s))
  const reset = () => { stop(); setState(initial(config)) }
  const play = () => {
    if (reducedMotion) { setState(stateAt(config, total)); return }
    setPlaying(true)
    setState(s => (s.finished ? initial(config) : s))
    timer.current = setInterval(() => setState(s => advance(config, s)), STEP_MS)
  }

  const n = valueOfConfig(config)
  const divide = config.mode === 'divide'
  const rows = divide ? divisionSteps(n, config.to) : []
  const plan = divide ? null : groupPlan(config)
  const k = state.step

  return (
    <div className={`bconv${reducedMotion ? ' rm' : ''}`} dir="ltr" data-testid="base-convert" data-mode={config.mode}>
      <div className="bc-head mono" data-testid="bc-head">
        <span>({config.value}){sub(config.from)}</span><span className="bc-arrow">→</span><span>(?){sub(config.to)}</span>
      </div>

      {divide && (
        <ol className="bc-rows" data-testid="bc-rows">
          {rows.map((r, i) => (
            <li key={i} className={`bc-row mono${i < k ? ' shown' : ''}${i === k - 1 ? ' latest' : ''}`} data-testid={`bc-row-${i}`} aria-hidden={i >= k}>
              <span className="bc-n">{r.n}</span><span className="bc-op">÷ {config.to}</span><span className="bc-eq">=</span><span className="bc-q">{r.q}</span>
              <span className="bc-rem" title="שארית">
                <span className="bc-rem-label" dir="rtl">שארית</span> <b>{dch(r.r)}</b>
              </span>
            </li>
          ))}
        </ol>
      )}

      {plan && (
        <div className="bc-groups" data-testid="bc-groups">
          {(plan.kind === 'cut' ? [...plan.steps].map((s, i) => ({ s, i })).reverse() : plan.steps.map((s, i) => ({ s, i }))).map(({ s, i }) => {
            const done = i < k
            return (
              <div key={i} className={`bc-group${done ? ' done' : ''}${i === k - 1 ? ' latest' : ''}${i === k ? ' next' : ''}`} data-testid={`bc-group-${i}`}>
                <div className="bc-top mono">
                  {plan.kind === 'cut'
                    ? [...s.bits].map((b, j) => <span key={j} className={`bc-bit${j < s.padded ? ' pad' : ''}`}>{b}</span>)
                    : <span className="bc-dig">{s.digit}</span>}
                </div>
                <div className="bc-down" aria-hidden>↓</div>
                <div className={`bc-bottom mono${done ? ' on' : ''}`}>
                  {done
                    ? (plan.kind === 'cut' ? <span className="bc-dig">{s.digit}</span> : [...s.bits].map((b, j) => <span key={j} className="bc-bit">{b}</span>))
                    : <span className="bc-ph">?</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="bc-result-row">
        <span className="bc-result-label">תוצאה</span>
        <div className="bc-result mono" data-testid="bc-result" aria-live="polite" aria-label={`תוצאה: ${state.result || 'עדיין ריקה'}`}>
          {divide
            ? Array.from({ length: total }, (_, slot) => {
                const fromRight = total - 1 - slot // slot 0 is the leftmost = found last
                const has = fromRight < k
                const ch = has ? state.result[state.result.length - 1 - fromRight] : ''
                return <span key={slot} className={`bc-slot${has ? ' on' : ''}${has && fromRight === k - 1 ? ' fresh' : ''}`}>{ch}</span>
              })
            : <span className={`bc-slot wide${state.result ? ' on' : ''}${state.finished ? ' fin' : ''}`} key={state.result}>{state.result || '·'}</span>}
          <span className="bc-base">{sub(config.to)}</span>
        </div>
      </div>
      {divide && (
        <div className="bc-hint muted" dir="rtl">
          {state.finished ? 'קוראים את השאריות מהאחרונה לראשונה: זו התוצאה.' : 'כל שארית נוחתת במקום שלה, מימין לשמאל.'}
        </div>
      )}

      <div className="bc-controls">
        <button type="button" className="btn primary" data-testid="bc-step" onClick={step} disabled={state.finished || playing}>
          {divide ? 'בצע חלוקה' : plan?.kind === 'cut' ? 'צור קבוצה' : 'פתח ספרה'}
        </button>
        <button type="button" className="btn" data-testid="bc-play" onClick={play} disabled={playing}>▶ הפעל הכול</button>
        <button type="button" className="btn ghost" data-testid="bc-reset" onClick={reset} disabled={k === 0 && !playing}>↺ מההתחלה</button>
      </div>
    </div>
  )
}
