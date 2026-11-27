import { useEffect, useMemo, useRef, useState } from 'react'
import { kmapLayout } from '../../../logic/kmap'
import type { WidgetProps } from './types'
import {
  VAR_NAMES, allRows, bitsOf, finalState, groupInfo, initial, mapHeaders, maxtermTerm, mintermTerm, neighbours, rowsExpression, toggle, valueAt,
  type TruthToMapConfig, type TruthToMapGoal, type TruthToMapState,
} from './truthToMapLogic'
import './TruthToMap.css'

const FLY_MS = 700
const STAGGER_MS = 110
const show = (v: 0 | 1 | 'x') => (v === 'x' ? 'X' : String(v))

interface Flight { m: number; fx: number; fy: number; dx: number; dy: number; delay: number }

/**
 * Truth-table rows fly to their cells of the Karnaugh map. The map's Gray order puts cells that differ in exactly one
 * variable side by side (and across the edges). Selecting a cell lights its neighbours; selecting a group shows its term.
 */
export function TruthToMap({ config, goal, onState, completed, reducedMotion }: WidgetProps<TruthToMapConfig, TruthToMapState, TruthToMapGoal>) {
  const n = config.nVars
  const view = config.view ?? 'flow'
  const rowsView = view === 'rows'
  const rows = useMemo(() => allRows(config), [config])
  const L = useMemo(() => kmapLayout(n), [n])
  const heads = useMemo(() => mapHeaders(n), [n])

  // an already-complete goal step shows its final state (also valid while `completed` is still false on a first visit)
  const [st, setSt] = useState<TruthToMapState>(() => (completed && goal ? finalState(config, goal) : initial(config)))
  const [landed, setLanded] = useState<number[]>(() => (completed && goal && !rowsView ? allRows(config) : initial(config).placed))
  const [flights, setFlights] = useState<Flight[]>([])
  const [hover, setHover] = useState<number | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const rowEls = useRef<Record<number, HTMLElement | null>>({})
  const cellEls = useRef<Record<number, HTMLElement | null>>({})
  const timers = useRef<number[]>([])
  const resetBtn = useRef<HTMLButtonElement>(null)
  /** Keeps keyboard focus when the focused control is about to become disabled: moves it to `el` (or the reset button). */
  const refocus = (el?: HTMLElement | null) => { window.setTimeout(() => (el ?? resetBtn.current)?.focus(), 0) }

  useEffect(() => { onState(st) }, [st]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { timers.current.forEach(clearTimeout) }, [])

  /** Moves rows onto the map: each row's chip flies to its cell, then the cell fills in. */
  const place = (ms: number[]) => {
    const fresh = ms.filter(m => !st.placed.includes(m))
    if (fresh.length === 0) return
    setSt(s => ({ ...s, placed: [...s.placed, ...fresh] }))
    const box = root.current?.getBoundingClientRect()
    if (reducedMotion || !box) { setLanded(l => [...l, ...fresh]); return }
    const next: Flight[] = fresh.flatMap((m, i) => {
      const a = rowEls.current[m]?.getBoundingClientRect()
      const b = cellEls.current[m]?.getBoundingClientRect()
      if (!a || !b) return []
      const fx = a.right - box.left - 34
      const fy = a.top + a.height / 2 - box.top
      return [{ m, fx, fy, dx: b.left + b.width / 2 - box.left - fx, dy: b.top + b.height / 2 - box.top - fy, delay: i * STAGGER_MS }]
    })
    const missed = fresh.filter(m => !next.some(f => f.m === m))
    if (missed.length) setLanded(l => [...l, ...missed])
    setFlights(f => [...f, ...next])
    for (const f of next) {
      timers.current.push(window.setTimeout(() => {
        setLanded(l => (l.includes(f.m) ? l : [...l, f.m]))
        setFlights(fs => fs.filter(x => x.m !== f.m))
      }, f.delay + FLY_MS + 30))
    }
  }

  const reset = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setFlights([])
    setLanded(initial(config).placed)
    setSt(initial(config))
  }

  const pickable = (m: number) => (rowsView ? true : landed.includes(m))
  const pick = (m: number) => { if (pickable(m)) setSt(s => ({ ...s, picked: toggle(s.picked, m) })) }

  // the first selected cell is the anchor whose neighbours stay lit while the player picks them
  const focus = st.picked.length > 0 ? st.picked[0] : null
  // in a groups step the neighbour hints only help while choosing the second cell; after that the group speaks for itself
  const showNbrs = !rowsView && focus !== null && (!config.groups || st.picked.length === 1)
  const nbrs = useMemo(() => (showNbrs && focus !== null ? neighbours(n, focus) : []), [showNbrs, focus, n])
  const nbrOf = (m: number) => nbrs.find(x => x.m === m)
  const nextRow = rows.find(m => !st.placed.includes(m))
  const mapFilled = !rowsView && landed.length === rows.length
  const group = config.groups && !rowsView && st.picked.length > 0 ? groupInfo(n, st.picked, config) : null
  const style = config.terms ?? 'sop'
  const badRow = (m: number) => rowsView && st.picked.includes(m) && valueAt(config, m) !== (style === 'pos' ? 0 : 1)

  const info = ((): { expr: string; note: string; bad: boolean} => {
    if (rowsView) {
      const bad = st.picked.some(badRow)
      const note = bad ? (style === 'pos' ? 'מקסטרם נכתב רק משורה שבה הפונקציה שווה 0.' : 'מינטרם נכתב רק משורה שבה הפונקציה שווה 1.') : ''
      return { expr: rowsExpression(n, st.picked, style), note, bad }
    }
    if (focus === null) return { expr: '', note: mapFilled ? 'לחצו על תא במפה כדי לראות את שכניו.' : '', bad: false }
    const wrapNote = nbrs.some(x => x.wraps) ? ' הסימן ↺ מציין שכן מעבר לקצה המפה.' : ''
    if (group?.coversZero) return { expr: '', note: 'הקבוצה תופסת תא 0, ולכן היא לא קבוצה של הפונקציה: קבוצה מכילה רק תאי 1 ו-X.', bad: true }
    if (group && !group.valid) return { expr: '', note: 'זו לא קבוצה חוקית: מספר התאים חייב להיות חזקה של 2, והם יוצרים מלבן (גם דרך קצה המפה).', bad: true }
    if (group) return { expr: group.term, note: `${nbrs.length ? `השכנים מסומנים, והאות על כל שכן היא המשתנה שבו הוא שונה.${wrapNote} ` : ''}קבוצה חוקית של ${st.picked.length} ${st.picked.length === 1 ? 'תא' : 'תאים'}. האיבר שלה:`, bad: false }
    return { expr: '', note: `שכני תא ${focus}: האות על כל שכן היא המשתנה היחיד שבו הוא שונה.${wrapNote}`, bad: false }
  })()

  const cellSize = n === 2 ? 'ttm-2' : ''
  return (
    <div className={`ttm ${rowsView ? 'ttm-rows' : ''} ${reducedMotion ? 'ttm-reduced' : ''}`} ref={root} dir="ltr" data-testid="ttm" data-view={view}>
      <div className="ttm-main">
        {!(config.startPlaced && !rowsView) && <div className="ttm-table" role="group" aria-label="טבלת אמת">
          <div className="ttm-head" aria-hidden="true">
            <span className="ttm-m">m</span>
            {VAR_NAMES.slice(0, n).map(v => <span key={v}>{v}</span>)}
            <span className="ttm-f">F</span>
          </div>
          {rows.map(m => {
            const placed = st.placed.includes(m)
            const sel = st.picked.includes(m)
            const v = valueAt(config, m)
            return (
              <button
                key={m} type="button" ref={el => { rowEls.current[m] = el }}
                className={`ttm-row ${placed && !rowsView ? 'sent' : ''} ${sel ? 'sel' : ''} ${badRow(m) ? 'bad' : ''} v-${show(v)}`}
                data-testid={`ttm-row-${m}`} data-m={m}
                disabled={!rowsView && placed}
                aria-pressed={rowsView ? sel : undefined}
                aria-label={rowsView ? `שורה ${m}, F ${show(v)}` : `שלחו את שורה ${m} למפה`}
                onClick={() => {
                  if (rowsView) { pick(m); return }
                  const after = rows.find(x => x > m && !st.placed.includes(x)) ?? rows.find(x => x !== m && !st.placed.includes(x))
                  place([m])
                  refocus(after === undefined ? null : rowEls.current[after])
                }}
                onMouseEnter={() => setHover(m)} onMouseLeave={() => setHover(h => (h === m ? null : h))}
                onFocus={() => setHover(m)} onBlur={() => setHover(h => (h === m ? null : h))}
              >
                <span className="ttm-m">{m}</span>
                {bitsOf(n, m).split('').map((b, i) => <span key={i} className={`ttm-bit b${b}`}>{b}</span>)}
                <span className={`ttm-f f-${show(v)}`}>{show(v)}</span>
              </button>
            )
          })}
        </div>}

        {!rowsView && (
          <div className="ttm-mapbox">
            <div className={`ttm-map ${cellSize}`} role="group" aria-label="מפת קרנו"
              style={{ gridTemplateColumns: `var(--hdr) repeat(${L.cols}, var(--cell))`, gridTemplateRows: `var(--hdr) repeat(${L.rows}, var(--cell))` }}>
              <div className="ttm-corner" aria-hidden="true"><span className="cv">{heads.colVars}</span><span className="rv">{heads.rowVars}</span></div>
              {heads.cols.map((b, c) => <div key={`c${c}`} className="ttm-hdr" aria-hidden="true" style={{ gridRow: 1, gridColumn: c + 2 }}>{b}</div>)}
              {heads.rows.map((b, r) => <div key={`r${r}`} className="ttm-hdr" aria-hidden="true" style={{ gridRow: r + 2, gridColumn: 1 }}>{b}</div>)}
              {Array.from({ length: L.rows }, (_, r) => Array.from({ length: L.cols }, (_, c) => {
                const m = L.mintermAt(r, c)
                const filled = landed.includes(m)
                const nb = nbrOf(m)
                const v = valueAt(config, m)
                return (
                  <button
                    key={m} type="button" ref={el => { cellEls.current[m] = el }}
                    style={{ gridRow: r + 2, gridColumn: c + 2 }}
                    className={`ttm-cell ${filled ? `filled v-${show(v)}` : ''} ${st.picked.includes(m) ? 'sel' : ''} ${nb ? 'nbr' : ''} ${nb?.wraps ? 'wrap' : ''} ${hover === m && !filled ? 'target' : ''} ${m === focus ? 'focus' : ''}`}
                    data-testid={`ttm-cell-${m}`} data-m={m} data-filled={filled} data-picked={st.picked.includes(m)} data-nbr={nb ? 'true' : undefined}
                    aria-pressed={st.picked.includes(m)}
                    aria-label={filled ? `תא ${m}, ערך ${show(v)}` : `תא ${m}, עדיין ריק`}
                    disabled={!filled}
                    onClick={() => pick(m)}
                  >
                    <span className="ttm-idx">{m}</span>
                    {filled && <span className="ttm-val">{show(v)}</span>}
                    {nb && <span className="ttm-nv">{nb.varName}{nb.wraps ? '↺' : ''}</span>}
                  </button>
                )
              }))}
            </div>
          </div>
        )}
      </div>

      <div className="ttm-bar" dir="rtl">
        {!rowsView && !config.startPlaced && (
          <>
            <button type="button" className="btn" data-testid="ttm-place-next" disabled={nextRow === undefined} onClick={() => { if (nextRow === undefined) return; place([nextRow]); if (st.placed.length + 1 === rows.length) refocus() }}>שלחו את השורה הבאה</button>
            <button type="button" className="btn" data-testid="ttm-place-all" disabled={nextRow === undefined} onClick={() => { place(rows.filter(m => !st.placed.includes(m))); refocus() }}>שלחו הכול</button>
          </>
        )}
        {(st.picked.length > 0 || (!rowsView && !config.startPlaced && st.placed.length > 0)) && (
          <button type="button" className="btn ghost" data-testid="ttm-reset" ref={resetBtn} onClick={reset}>{!rowsView && !config.startPlaced ? 'מההתחלה' : 'נקו בחירה'}</button>
        )}
      </div>

      <div className="ttm-info" dir="rtl" role="status" data-testid="ttm-info">
        {info.note && <p className={`ttm-note ${info.bad ? 'bad' : ''}`}>{info.note}</p>}
        {info.expr && (
          <div className="ttm-expr" dir="ltr" data-testid="ttm-expr">
            {rowsView && st.picked.length > 0
              ? <>F = {[...new Set(st.picked)].sort((a, b) => a - b).map((m, i) => (
                  // each term stays on one line; a long formula breaks only between terms
                  <span key={m}>{style === 'sop' && i > 0 ? ' + ' : ''}<span className="ttm-term">{style === 'pos' ? maxtermTerm(n, m) : mintermTerm(n, m)}</span>{style === 'pos' ? <wbr /> : null}</span>
                ))}</>
              : info.expr}
          </div>
        )}
      </div>

      {flights.map(f => (
        <span key={f.m} className="ttm-fx" aria-hidden="true"
          style={{ left: f.fx, top: f.fy, ['--dx' as string]: `${f.dx}px`, ['--dy' as string]: `${f.dy}px`, ['--delay' as string]: `${f.delay}ms`, ['--dur' as string]: `${FLY_MS}ms` }}>
          <span className={`ttm-fy v-${show(valueAt(config, f.m))}`}>{f.m}:{show(valueAt(config, f.m))}</span>
        </span>
      ))}
    </div>
  )
}
