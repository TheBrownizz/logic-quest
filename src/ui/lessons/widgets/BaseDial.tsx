import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import type { WidgetProps } from './types'
import {
  digitChar, digitsForValue, initial, isNegative, placeWeights, stepDigit, unsignedValue, valueOf,
  type BaseDialConfig, type BaseDialGoal, type BaseDialState,
} from './baseDialLogic'
import './BaseDial.css'

const sup = (n: number) => String(n).split('').map(d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]).join('')
const sub = (n: number) => String(n).split('').map(d => '₀₁₂₃₄₅₆₇₈₉'[+d]).join('')

/**
 * BaseDial: digits you step up and down (like a combination lock). Above every digit sits its place weight r^i;
 * below it, digit × weight; the products add up to the value. The one orchestrated animation is the build-up:
 * the place weights drop in from the right, then the products slide down into the sum (skipped when motion is reduced).
 */
export function BaseDial({ config, goal, onState, completed, reducedMotion }: WidgetProps<BaseDialConfig, BaseDialState, BaseDialGoal>) {
  const [state, setState] = useState<BaseDialState>(() => {
    const dg = completed && goal ? digitsForValue(goal.value, config) : null
    return dg ? { digits: dg } : initial(config)
  })
  useEffect(() => { onState(state) }, [state]) // eslint-disable-line react-hooks/exhaustive-deps
  const { base, width, signed } = config
  const weights = useMemo(() => placeWeights(config), [config])
  const neg = isNegative(state.digits, config)
  const value = valueOf(state.digits, config)
  const unsigned = unsignedValue(state.digits, base)
  // two's complement reading: the top place weighs −2^(w−1)
  const topNegative = !!signed && base === 2
  const weightAt = (i: number) => (topNegative && i === 0 ? -weights[0] : weights[i])
  const products = state.digits.map((d, i) => d * weightAt(i))
  const hit = goal !== undefined && value === goal.value

  const set = (i: number, d: number) => setState(s => ({ digits: s.digits.map((x, j) => (j === i ? d : x)) }))
  const bump = (i: number, dir: 1 | -1) => setState(s => ({ digits: stepDigit(s.digits, i, dir, base) }))
  const onKey = (i: number) => (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); bump(i, 1) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); bump(i, -1) }
    else if (e.key === 'Home') { e.preventDefault(); set(i, 0) }
    else if (e.key === 'End') { e.preventDefault(); set(i, base - 1) }
    else if (e.key.length === 1) {
      const d = parseInt(e.key, 36)
      if (d >= 0 && d < base) { e.preventDefault(); set(i, d) }
    }
  }

  const written = state.digits.map(digitChar).join('')
  const terms = products.map((p, i) => ({ p, i })).filter(t => t.p !== 0)
  return (
    <div className={`bdial${reducedMotion ? ' rm' : ''}`} dir="ltr" data-testid="base-dial" data-base={base}>
      <div className="bd-head">
        <span className="bd-num mono" data-testid="dial-number">({written}){sub(base)}</span>
        {goal !== undefined && (
          <span className={`bd-goal${hit ? ' hit' : ''}`} data-testid="dial-target">
            {hit ? '✓' : '🎯'} <span className="mono">{goal.value}</span>
          </span>
        )}
      </div>
      <div className="bd-cols" role="group" aria-label={`ספרות בבסיס ${base}`}>
        {state.digits.map((d, i) => {
          const pos = width - 1 - i
          return (
            <div className="bd-col" key={i} style={{ ['--i' as string]: width - 1 - i }}>
              <div className="bd-exp mono" aria-hidden>{base}{sup(pos)}</div>
              <div className={`bd-weight mono${topNegative && i === 0 ? ' neg' : ''}`} data-testid={`dial-weight-${i}`}>{weightAt(i)}</div>
              <button type="button" className="bd-step" tabIndex={-1} aria-hidden data-testid={`dial-up-${i}`} onClick={() => bump(i, 1)}>▲</button>
              <div
                className={`bd-digit mono${d !== 0 ? ' on' : ''}`} role="spinbutton" tabIndex={0}
                aria-label={`ספרה במקום ${base}${sup(pos)}`} aria-valuemin={0} aria-valuemax={base - 1} aria-valuenow={d} aria-valuetext={digitChar(d)}
                data-testid={`dial-digit-${i}`} onKeyDown={onKey(i)}
              >{digitChar(d)}</div>
              <button type="button" className="bd-step" tabIndex={-1} aria-hidden data-testid={`dial-down-${i}`} onClick={() => bump(i, -1)}>▼</button>
              <div key={`${d}`} className={`bd-prod mono${products[i] === 0 ? ' zero' : ''}`} data-testid={`dial-product-${i}`}>
                {products[i]}
              </div>
            </div>
          )
        })}
      </div>
      <div className="bd-sum mono" data-testid="dial-sum">
        {terms.length === 0 ? '0' : terms.map((t, k) => (
          <span key={t.i} className="bd-term">{k > 0 && t.p > 0 ? ' + ' : k > 0 ? ' − ' : t.p < 0 ? '−' : ''}{Math.abs(t.p)}</span>
        ))}
        <span className="bd-eq"> = </span>
        <b className={`bd-value${hit ? ' hit' : ''}`} data-testid="dial-value">{value}</b>
      </div>
      {signed && !topNegative && neg && (
        <div className="bd-note mono muted" data-testid="dial-note">{unsigned} − {base ** width} = {value}</div>
      )}
      {signed && topNegative && (
        <div className="bd-note muted" dir="rtl">בייצוג מסומן הספרה השמאלית נחשבת במינוס: משקלה <span dir="ltr" className="mono">−{weights[0]}</span>.</div>
      )}
    </div>
  )
}
