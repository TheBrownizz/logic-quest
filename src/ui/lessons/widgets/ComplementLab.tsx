import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { WidgetProps } from './types'
import {
  initial, modelOf, nextPhase, phaseIndex, phasesFor, prevPhase, valueOfDigits,
  type ComplementLabConfig, type ComplementLabGoal, type ComplementLabState, type ComplementModel, type ComplementPhase,
} from './complementLabLogic'
import { digitChar, sub } from './shared/scripts'
import './ComplementLab.css'

const str = (d: number[]) => d.map(digitChar).join('')
const REVEAL_MS = 240

type Tone = 'a' | 'b' | 'dim' | 'out'
interface Row {
  id: string
  kind: 'digits' | 'r1' | 'carry' | 'rule'
  digits?: number[]
  tone?: Tone
  /** The gutter (the narrow column on the left): an operator, or the end carry. */
  sign?: string
  caption?: string
  /** An equation shown next to the caption (LTR). */
  eq?: string
  /** Cells appear one by one: most significant first, or least significant first. */
  reveal?: 'ltr' | 'rtl'
  /** carries[i]: position i produced a carry (shown over position i−1, or in the gutter for i = 0). */
  carries?: boolean[]
  /** Carry row: also show a carry in the gutter (B = 0: its r complement r^w brings the end carry). */
  extraEnd?: boolean
  /** The carry out of the top position, drawn in the gutter. */
  endCarry?: { value: 0 | 1; struck?: boolean }
  /** r1 rows: the arithmetic under each digit (e.g. "9−4"). */
  ann?: string[]
}

/** The rows shown in a phase: only the work of that phase, so the lab stays short on a phone. */
function rowsFor(c: ComplementLabConfig, m: ComplementModel, phase: ComplementPhase): Row[] {
  const rTop = digitChar(m.base - 1)
  const w = m.width
  const rText = String(m.base)
  const r1Name = `משלים ל-${m.base - 1}`
  const rName = `משלים ל-${rText}`
  const r1Eq = `${rTop.repeat(w)} − ${str(m.target)} = ${str(m.r1)}`
  const rEq = m.r.endCarry ? undefined : `1${'0'.repeat(w)} − ${str(m.target)} = ${str(m.r.digits)}`
  const sub1 = c.mode === 'subtract'
  const oneRow: Row = { id: 'one', kind: 'digits', digits: m.target.map((_, i) => (i === w - 1 ? 1 : 0)), tone: 'dim', sign: '+' }
  const rule: Row = { id: 'rule', kind: 'rule' }
  const r1Row: Row = {
    id: 'r1', kind: 'r1', digits: m.r1, tone: 'out', caption: r1Name, eq: r1Eq, reveal: 'ltr',
    ann: m.target.map(d => `${rTop}−${digitChar(d)}`),
  }
  const targetRow = (tone: Tone): Row => sub1
    ? { id: 'b', kind: 'digits', digits: m.target, tone, sign: '−', caption: 'B (המחסר)' }
    : { id: 'n', kind: 'digits', digits: m.target, tone, caption: 'המספר' }
  const rRows: Row[] = [
    { id: 'c', kind: 'carry', carries: m.r.carries, reveal: 'rtl' },
    { id: 'r1b', kind: 'digits', digits: m.r1, tone: 'b', caption: r1Name },
    oneRow, rule,
    { id: 'r', kind: 'digits', digits: m.r.digits, tone: 'out', caption: rName, eq: rEq, reveal: 'rtl' },
  ]
  switch (phase) {
    case 'value':
      return sub1
        ? [{ id: 'a', kind: 'digits', digits: m.value, tone: 'a', caption: 'A (המחוסר)' }, targetRow('b')]
        : [targetRow('a')]
    case 'r1': return [targetRow('dim'), r1Row]
    case 'r': return rRows
    case 'sum': {
      const sum = m.sum!
      return [
        { id: 'c', kind: 'carry', carries: sum.carries, reveal: 'rtl', extraEnd: m.r.endCarry },
        { id: 'a', kind: 'digits', digits: m.value, tone: 'a', caption: 'A (המחוסר)' },
        { id: 'rb', kind: 'digits', digits: m.r.digits, tone: 'b', sign: '+', caption: `B במשלים ל-${rText}` },
        rule,
        { id: 'sum', kind: 'digits', digits: sum.digits, tone: 'out', caption: 'הסכום', reveal: 'rtl', endCarry: { value: m.endCarry ? 1 : 0 } },
      ]
    }
    default: {
      const res = m.result!
      const sum = m.sum!
      const rows: Row[] = [
        { id: 'sum', kind: 'digits', digits: sum.digits, tone: 'dim', caption: 'הסכום', endCarry: { value: m.endCarry ? 1 : 0, struck: !!m.endCarry } },
      ]
      if (res.negative) {
        rows.push({
          id: 'neg', kind: 'digits', digits: res.digits, tone: 'out', sign: '−', caption: `גודל התוצאה: המשלים ל-${rText} של הסכום`,
        })
      } else rows.push({ id: 'pos', kind: 'digits', digits: res.digits, tone: 'out', caption: 'התוצאה (בלי הנשא)' })
      return rows
    }
  }
}

const NOTE: Record<ComplementPhase, (m: ComplementModel, c: ComplementLabConfig) => ReactNode> = {
  value: (m, c) => c.mode === 'complement'
    ? <>נתון מספר בן <L>{m.width}</L> ספרות בבסיס <L>{m.base}</L>. נמצא את שני המשלימים שלו, על אותו רוחב.</>
    : <>נחשב <L>{'A − B'}</L> בלי לחסר: נחבר ל-A את המשלים של B. שני המספרים בני <L>{m.width}</L> ספרות.</>,
  r1: m => <>כל ספרה <L>d</L> הופכת ל-<L>{`${digitChar(m.base - 1)} − d`}</L>. אין העברות בין ספרות.</>,
  r: m => m.r.endCarry
    ? <>מוסיפים 1 לספרה הימנית. כל הספרות היו <L>{digitChar(m.base - 1)}</L>, לכן הנשא רץ עד הסוף ויוצא החוצה (המספר היה 0).</>
    : <>מוסיפים 1 לספרה הימנית. ספרה שמגיעה ל-<L>{m.base}</L> הופכת ל-0 ומעבירה נשא שמאלה; כשאין נשא, שאר הספרות נשארות.</>,
  sum: m => m.r.endCarry
    ? <>B הוא 0, והמשלים ל-<L>{m.base}</L> שלו הוא 1 ואחריו אפסים. ה-1 הזה הוא הנשא הסופי, ולכן התוצאה היא A עצמו.</>
    : <>מחברים ספרה אחר ספרה, מימין לשמאל, עם נשאים. ליד הספרה העליונה נבדק אם יצא נשא סופי.</>,
  result: m => {
    const r = m.result!
    const a = valueOfDigits(m.value, m.base)
    const b = valueOfDigits(m.other ?? [], m.base)
    return (
      <>
        {r.negative
          ? <>אין נשא סופי, ולכן <L>{'A < B'}</L> והתוצאה שלילית. גודלה הוא המשלים ל-<L>{m.base}</L> של הסכום.</>
          : <>יצא נשא סופי: זורקים אותו, והתוצאה היא ההפרש. (נשא סופי פירושו <L>{'A ≥ B'}</L>.)</>}{' '}
        בדיקה בעשרוני: <L>{`${a} − ${b} = ${String(r.value).replace("-", "−")}`}</L>.
      </>
    )
  },
}

/** An LTR isolate for numbers and formulas inside Hebrew text. */
function L({ children }: { children: ReactNode }) {
  // no-break spaces: a formula split over two lines is reordered line by line and reads wrongly
  const c = typeof children === 'string' ? children.replace(/ /g, '\u00A0') : children
  return <bdi dir="ltr" className="mono">{c}</bdi>
}

const LABELS: Record<ComplementPhase, string> = { value: 'מספר', r1: 'משלים ל-(r−1)', r: 'משלים ל-r', sum: 'סכום', result: 'תוצאה' }
const NEXT_LABEL: Record<ComplementPhase, string> = { value: '', r1: 'הפכו כל ספרה', r: 'הוסיפו 1', sum: 'חברו', result: 'קבלו את התוצאה' }

/**
 * ComplementLab. The view steps through the phases; every phase shows only its own work, and plays it once:
 * the digits flip one by one (the (r−1) complement), then the carry of "+1" ripples from the right, and in a
 * subtraction the column addition runs right to left until the end carry decides the sign. Going back shows
 * a finished phase at once, and reduced motion shows every phase finished.
 */
export function ComplementLab({ config, goal, onState, completed, reducedMotion }: WidgetProps<ComplementLabConfig, ComplementLabState, ComplementLabGoal>) {
  const m = useMemo(() => modelOf(config), [config])
  const phases = phasesFor(config)
  // a goal-less step opens at its starting state even when the player marks it complete
  const showFinal = completed && goal !== undefined
  const last = phases[phases.length - 1]
  const [furthest, setFurthest] = useState<ComplementPhase>(() => (showFinal ? last : initial(config).phase))
  const [view, setView] = useState<ComplementPhase>(() => (showFinal ? last : 'value'))
  useEffect(() => { onState({ phase: furthest }) }, [furthest]) // eslint-disable-line react-hooks/exhaustive-deps
  const seen = useRef<Set<ComplementPhase>>(new Set(showFinal ? phases : ['value']))
  const instant = reducedMotion || seen.current.has(view)
  const [reveal, setReveal] = useState(() => (instant ? m.width : 0))
  useLayoutEffect(() => {
    if (instant) { setReveal(m.width); seen.current.add(view); return }
    seen.current.add(view)
    setReveal(0)
    const id = setInterval(() => setReveal(v => { if (v >= m.width) { clearInterval(id); return v } return v + 1 }), REVEAL_MS)
    return () => clearInterval(id)
  }, [view]) // eslint-disable-line react-hooks/exhaustive-deps

  const go = (p: ComplementPhase | null) => {
    if (!p) return
    setView(p)
    if (phaseIndex(p) > phaseIndex(furthest)) setFurthest(p)
  }
  const next = nextPhase(config, view)
  const back = prevPhase(config, view)
  const rows = rowsFor(config, m, view)
  const w = m.width
  const done = reveal >= w
  const problem = config.mode === 'subtract'
    ? `(${str(m.value)})${sub(m.base)} − (${str(m.other!)})${sub(m.base)}`
    : `(${str(m.value)})${sub(m.base)}`

  return (
    <div className={`clab${reducedMotion ? ' rm' : ''}`} dir="rtl" data-testid="complement-lab" data-phase={view}>
      <ol className="cl-steps" aria-label="שלבים">
        {phases.map(p => (
          <li key={p} className={`cl-stepchip${p === view ? ' cur' : ''}${phaseIndex(p) <= phaseIndex(furthest) ? ' seen' : ''}`}>
            <button type="button" disabled={phaseIndex(p) > phaseIndex(furthest)} onClick={() => setView(p)} aria-current={p === view ? 'step' : undefined}>{LABELS[p]}</button>
          </li>
        ))}
      </ol>
      <div className="cl-problem mono" dir="ltr" data-testid="cl-problem">{problem}</div>

      <div className="cl-rows" key={view} dir="ltr" data-testid="cl-rows">
        {rows.map(row => <RowView key={row.id} row={row} width={w} reveal={reveal} />)}
      </div>

      <p className="cl-note" data-testid="cl-note">{NOTE[view](m, config)}</p>

      <div className="cl-controls">
        <button type="button" className="btn ghost" data-testid="cl-back" onClick={() => go(back)} disabled={!back}>← חזרה</button>
        {next
          ? <button type="button" className="btn primary" data-testid="cl-next" onClick={() => go(next)}>{NEXT_LABEL[next]}</button>
          : <span className="cl-done" data-testid="cl-done">{done ? '✓ סיימנו' : ''}</span>}
      </div>
    </div>
  )
}

function RowView({ row, width, reveal }: { row: Row; width: number; reveal: number }) {
  const vis = (i: number) => row.reveal === 'ltr' ? reveal > i : row.reveal === 'rtl' ? reveal > width - 1 - i : true
  const cols = { gridTemplateColumns: `var(--gut) repeat(${width}, minmax(0, 1fr))` }
  if (row.kind === 'rule') return <div className="cl-rule" aria-hidden />
  if (row.kind === 'carry') {
    const cs = row.carries ?? []
    return (
      <div className="cl-row carry" style={cols} aria-label="נשאים" data-testid="cl-carries">
        <span className="cl-gut">{(cs[0] || row.extraEnd) && vis(0) ? <span className="cl-chip" key="e">1</span> : null}</span>
        {Array.from({ length: width }, (_, i) => (
          <span key={i} className="cl-cell">{i + 1 < width && cs[i + 1] && vis(i + 1) ? <span className="cl-chip" key="c">1</span> : null}</span>
        ))}
      </div>
    )
  }
  const digits = row.digits ?? []
  const end = row.endCarry
  const endVisible = end !== undefined && (row.reveal ? reveal >= width : true)
  return (
    <div className="cl-rowwrap" data-testid={`cl-row-${row.id}`}>
      {(row.caption || row.eq) && (
        <div className="cl-caption" dir="rtl">
          {row.caption && <span>{row.caption}</span>}
          {row.eq && <span className="cl-eq mono" dir="ltr">{row.eq}</span>}
        </div>
      )}
      <div className={`cl-row ${row.tone ?? ''}`} style={cols}>
        <span className={`cl-gut${row.sign ? ' sign' : ''}`}>
          {end !== undefined
            ? (endVisible ? <span className={`cl-endc${end.value ? ' one' : ''}${end.struck ? ' struck' : ''}`} key={`e${end.struck}`} data-testid="cl-endcarry" title="נשא סופי">{end.value}</span> : null)
            : row.sign}
        </span>
        {digits.map((d, i) => {
          const v = vis(i)
          return (
            <span key={`${i}${v}`} className={`cl-cell${v ? ' in' : ' wait'}`} data-testid={`cl-${row.id}-${i}`}>
              <span className="cl-d mono">{v ? digitChar(d) : '·'}</span>
              {row.ann && <span className="cl-ann mono">{v ? row.ann[i] : ''}</span>}
            </span>
          )
        })}
      </div>
    </div>
  )
}
