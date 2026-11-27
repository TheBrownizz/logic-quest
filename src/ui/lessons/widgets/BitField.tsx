import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { ltr } from '../../../content/switching/helpers'
import type { WidgetProps } from './types'
import {
  BIAS, PARTS, canToggle, decode, encodeValue, formatNumber, pointStrip, startBits, toHex, toggleBit, trimMantissa,
  type BitFieldConfig, type BitFieldGoal, type BitFieldPart, type BitFieldState,
} from './bitFieldLogic'
import './BitField.css'

const PART_NAME: Record<BitFieldPart, string> = { sign: 'סימן', exponent: 'מעריך', mantissa: 'מנטיסה' }
const PART_SYMBOL: Record<BitFieldPart, string> = { sign: 'S', exponent: 'E', mantissa: 'M' }
const SLIDE_MS = 1000

/** Plain left-to-right text inside the Hebrew panel. */
const L = ({ children }: { children: string }) => <span className="bf-ltr" dir="ltr">{children}</span>
const sup = (n: number) => String(n).replace('-', '−')

/**
 * IEEE-754 single precision as 32 clickable bits, colour-coded sign / exponent / mantissa, with the value worked
 * out live: (−1)^S · 1.M · 2^(E−127). The animation shows the mechanism: the binary point of 1.M slides e places.
 */
export function BitField({ config, goal, onState, completed, reducedMotion }: WidgetProps<BitFieldConfig, BitFieldState, BitFieldGoal>) {
  const start = useMemo(() => startBits(config), [config])
  const [bits, setBits] = useState(() => {
    // coming back to a finished goal step shows the answer instead of the starting word
    const answer = completed && goal ? encodeValue(goal.value) : null
    return answer ?? start
  })
  const [moved, setMoved] = useState(false)
  const reported = useRef(onState)
  reported.current = onState
  useEffect(() => { reported.current({ bits }) }, [bits])

  const d = decode(bits)
  const strip = useMemo(() => pointStrip(bits), [bits])
  const enabled = useMemo(() => Array.from({ length: 32 }, (_, i) => i).filter(i => canToggle(config, i)), [config])
  const [cur, setCur] = useState(enabled[0] ?? 0)
  const stop = enabled.includes(cur) ? cur : enabled[0]
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  const flip = (i: number) => {
    if (!canToggle(config, i)) return
    setBits(b => toggleBit(b, i))
    setMoved(false)
    setCur(i)
  }
  const onKey = (e: KeyboardEvent, i: number) => {
    const at = enabled.indexOf(i)
    let to = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = enabled[Math.min(at + 1, enabled.length - 1)]
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = enabled[Math.max(at - 1, 0)]
    else if (e.key === 'Home') to = enabled[0]
    else if (e.key === 'End') to = enabled[enabled.length - 1]
    if (to < 0) return
    e.preventDefault()
    setCur(to)
    refs.current[to]?.focus()
  }

  const stripShown = strip !== null
  const slid = moved || reducedMotion || (strip !== null && strip.from === strip.to)
  const reset = () => { setBits(start); setMoved(false) }
  const value = formatNumber(d.value)
  const sign = d.sign ? '−1' : '+1'

  const bitCells = (part: BitFieldPart) => {
    const { start: s, length } = PARTS[part]
    return Array.from({ length }, (_, k) => {
      const i = s + k
      const on = bits[i] === '1'
      const free = canToggle(config, i)
      return (
        <button
          key={i} type="button" ref={el => { refs.current[i] = el }}
          className={`bf-bit ${part} ${on ? 'on' : 'off'}`} data-testid={`bit-${i}`} data-part={part}
          aria-pressed={on} aria-disabled={!free || undefined}
          aria-label={`ביט ${31 - i}, ${PART_NAME[part]}, ${on ? 1 : 0}${free ? '' : ', נעול'}`}
          tabIndex={free && i === stop ? 0 : -1}
          onClick={() => flip(i)} onKeyDown={e => onKey(e, i)}
        >
          <span className="bf-val">{bits[i]}</span>
          <span className="bf-pos" aria-hidden>{31 - i}</span>
        </button>
      )
    })
  }
  const part = (p: BitFieldPart) => (
    <div className={`bf-part ${p}`} data-part={p}>
      <div className="bf-label" dir="rtl"><span className="bf-badge">{PART_SYMBOL[p]}</span> {PART_NAME[p]}</div>
      <div className="bf-bits">{bitCells(p)}</div>
    </div>
  )

  return (
    <div className="bitfield" data-testid="bitfield" data-bits={bits} data-kind={d.kind}>
      <div className="bf-word" role="group" aria-label="מילה של 32 ביטים בפורמט IEEE-754">
        {part('sign')}{part('exponent')}{part('mantissa')}
      </div>
      <div className="bf-hex" dir="ltr">0x{toHex(bits)}</div>

      {d.kind === 'normal' ? (
        <div className="bf-calc" role="group" aria-label="חישוב הערך">
          <div className="bf-row sign"><span className="bf-key">סימן</span><L>{`S = ${d.sign}`}</L><span className="bf-pair"><span className="bf-then">←</span><L>{`(−1)^${d.sign} = ${sign}`}</L></span></div>
          <div className="bf-row exponent"><span className="bf-key">מעריך</span><L>{`E = ${bits.slice(1, 9)}₂ = ${d.exponent}`}</L><span className="bf-pair"><span className="bf-then">←</span><L>{`e = ${d.exponent} − ${BIAS} = ${sup(d.e)}`}</L></span></div>
          <div className="bf-row mantissa"><span className="bf-key">מנטיסה</span><L>{`1.${trimMantissa(d.mantissaBits) || '0'}₂`}</L><span className="bf-then">=</span><L>{`${formatNumber(d.significand).text}`}</L><span className="bf-note">הביט החבוי הוא ה-1 שלפני הנקודה</span></div>
          <div className="bf-row value" aria-live="polite" aria-atomic="true">
            <span className="bf-key">ערך</span>
            <L>{`${sign} · ${formatNumber(d.significand).text} · 2^${sup(d.e)}`}</L>
            <span className="bf-pair"><span className="bf-then">=</span><strong className="bf-result" data-testid="bitfield-value" dir="ltr">{`${value.exact ? '' : '≈'}${value.text}`}</strong></span>
          </div>
        </div>
      ) : (
        <div className="bf-calc special" data-testid="bitfield-special" aria-live="polite">
          <strong className="bf-result" data-testid="bitfield-value" dir="ltr">{value.text}</strong>
          <span>
            {d.kind === 'zero' && 'כל שדה המעריך אפס: זה אפס (מקרה מיוחד, אין ביט חבוי).'}
            {d.kind === 'subnormal' && 'שדה המעריך אפס והמנטיסה לא: מספר זעיר שאינו נורמלי, מחוץ לנושא שלנו.'}
            {d.kind === 'infinity' && 'כל שדה המעריך אחדות והמנטיסה אפס: אינסוף.'}
            {d.kind === 'nan' && `כל שדה המעריך אחדות והמנטיסה לא אפס: ${ltr('NaN')}, לא מספר.`}
          </span>
        </div>
      )}

      {stripShown && strip && (
        <div className="bf-slide" data-testid="bitfield-strip" data-moved={slid}>
          <div className="bf-strip-wrap">
            <div className="bf-strip" dir="ltr" style={{ '--n': strip.digits.length, '--p': slid ? strip.to : strip.from, '--slide': reducedMotion ? '0ms' : `${SLIDE_MS}ms` } as CSSProperties}>
              {strip.digits.map((g, i) => {
                const lo = Math.min(strip.from, strip.to), hi = Math.max(strip.from, strip.to)
                const crossed = slid && i >= lo && i < hi
                const order = strip.to > strip.from ? i - lo : hi - 1 - i
                return (
                  <span key={i} className={`bf-d${i === strip.hidden ? ' hidden-one' : ''}${i < strip.hidden || i > strip.hidden + trimMantissa(d.mantissaBits).length ? ' pad' : ''}${crossed ? ' crossed' : ''}`}
                    style={crossed ? { transitionDelay: `${reducedMotion ? 0 : Math.round(((order + 0.5) / (hi - lo)) * SLIDE_MS)}ms` } : undefined}>{g}</span>
                )
              })}
              <span className="bf-point" aria-hidden />
            </div>
          </div>
          <div className="bf-slide-bar">
            <span className="bf-slide-text" data-testid="bitfield-shifted" dir="ltr">{slid ? `${strip.shifted}₂` : `1.${trimMantissa(d.mantissaBits) || '0'}₂`}</span>
            {strip.from !== strip.to && !reducedMotion && (
              <button type="button" className="btn ghost bf-play" data-testid="bitfield-play" onClick={() => setMoved(m => !m)}>
                {moved ? '↺ החזירו את הנקודה' : `▶ הזיזו את הנקודה ${Math.abs(d.e)} ${d.e > 0 ? 'ימינה' : 'שמאלה'}`}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="bf-tools">
        <button type="button" className="btn ghost bf-reset" data-testid="bitfield-reset" onClick={reset} disabled={bits === start}>איפוס</button>
      </div>
    </div>
  )
}
