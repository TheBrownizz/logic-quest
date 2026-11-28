import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import type { LabPuzzle } from '../../content/types'
import type { RoomResult } from '../../game/progress'
import { stars } from '../../game/rules'
import { checkCover, groupToTerm, kmapLayout, type Group } from '../../logic/kmap'
import { formatSOP } from '../../logic/qm'
import { Stars } from '../Stars'
import { ExamSaveNote, HostHints, RestartButton, useExamGrade, type PuzzleHost } from './roomParts'
import { dragSelection } from './labLogic'

type KMapPz = Extract<LabPuzzle, { type: 'kmap' }>
type Sel = { rows: number[]; cols: number[] }
type KGroup = Sel & { color: number }
type Cell = [number, number]

const COLORS = 6
const NAMES = ['A', 'B', 'C', 'D']

/** Contiguous runs of an index list (a wrapped axis [3,0] is two runs). */
function runs(idx: number[]): Array<[number, number]> {
  const s = [...idx].sort((a, b) => a - b)
  const out: Array<[number, number]> = []
  for (const i of s) {
    const last = out[out.length - 1]
    if (last && last[1] === i - 1) last[1] = i
    else out.push([i, i])
  }
  return out
}

const toGroup = (s: Sel): Group => ({ cells: s.rows.flatMap(r => s.cols.map((c): Cell => [r, c])) })
const sameSel = (a: Sel, b: Sel) => {
  const eq = (x: number[], y: number[]) => x.length === y.length && [...x].sort().join() === [...y].sort().join()
  return eq(a.rows, b.rows) && eq(a.cols, b.cols)
}
const bits = (v: number, w: number) => v.toString(2).padStart(w, '0')

/** Adds a selection as a new group (unless it is already one), coloured with the first colour not in use. */
function addGroup(gs: KGroup[], sel: Sel): KGroup[] {
  if (gs.some(g => sameSel(g, sel))) return gs
  const used = new Set(gs.map(g => g.color))
  let color = 0
  while (used.has(color) && color < COLORS - 1) color++
  if (used.has(color)) color = gs.length % COLORS
  return [...gs, { ...sel, color }]
}

type Verdict = { kind: 'bad'; text: string } | { kind: 'ok'; minimal: boolean; result?: RoomResult }

/**
 * The k-map room. Embedded (fsm-equations) it takes the variable `names` (MSB first) and reports the solved
 * cover's expression through `onSolved`.
 */
export function KMapPuzzle({ host, puzzle, names: varNames, onSolved }: { host: PuzzleHost; puzzle: KMapPz; names?: string[]; onSolved?: (expression: string) => void }) {
  const { nVars, minterms, dontCares } = puzzle
  const L = useMemo(() => kmapLayout(nVars), [nVars])
  const rb = Math.floor(nVars / 2)
  const cb = nVars - rb
  const { solve, helped, onRestart } = host
  const [groups, setGroups] = useState<KGroup[]>([])
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [drag, setDrag] = useState<{ start: Cell; cur: Cell } | null>(null)
  const [pick, setPick] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const dragRef = useRef(drag)
  dragRef.current = drag

  const cellOf = (t: EventTarget | null): Cell | null => {
    const el = (t as HTMLElement | null)?.closest?.('[data-r]') as HTMLElement | null
    return el ? [Number(el.dataset.r), Number(el.dataset.c)] : null
  }

  const preview = drag ? dragSelection(drag.start, drag.cur) : null

  const onDown = (e: PointerEvent) => {
    const c = cellOf(e.target)
    if (pick || !c || e.button !== 0) return
    setDrag({ start: c, cur: c })
  }
  const onMove = (e: PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const c = cellOf(e.target) ?? d.cur
    if (c[0] !== d.cur[0] || c[1] !== d.cur[1]) setDrag({ ...d, cur: c })
  }

  // The release can happen anywhere, so listen on the window while dragging.
  const active = drag !== null
  useEffect(() => {
    if (!active) return
    const up = () => {
      const d = dragRef.current
      setDrag(null)
      if (!d) return
      const sel = dragSelection(d.start, d.cur)
      setGroups(gs => addGroup(gs, sel))
      setVerdict(null)
    }
    const cancel = () => setDrag(null)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    return () => { window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel) }
  }, [active, L])

  const cover = useMemo(() => checkCover(nVars, minterms, dontCares, groups.map(toGroup)), [nVars, minterms, dontCares, groups])
  const names = varNames && varNames.length === nVars ? varNames : NAMES.slice(0, nVars)
  const expression = useMemo(() => {
    const terms = groups.map(g => groupToTerm(nVars, toGroup(g)))
    return terms.every(t => t !== null) ? formatSOP(terms as NonNullable<(typeof terms)[number]>[], names) : cover.expression
  }, [groups, nVars, names, cover.expression])

  const exam = !!host.exam
  useExamGrade(host, cover.valid && cover.covered && !cover.coversZero, cover.isMinimal, groups.length > 0)
  const check = () => {
    let text: string | null = null
    if (!cover.valid) text = 'קבוצה לא חוקית'
    else if (cover.coversZero) text = 'תפסת 0'
    else if (!cover.covered) text = 'לא כיסית את כל ה-1'
    if (text) { setVerdict({ kind: 'bad', text }); return }
    const result = solve({ solved: true, optimal: cover.isMinimal, noHints: !helped })
    setVerdict({ kind: 'ok', minimal: cover.isMinimal, result })
    onSolved?.(expression)
  }

  const key = (r: number, c: number) => `${r},${c}`
  const toggle = (r: number, c: number) => {
    setPicked(p => (p.includes(key(r, c)) ? p.filter(k => k !== key(r, c)) : [...p, key(r, c)]))
    setVerdict(null)
  }
  const leavePick = () => { setPick(false); setPicked([]) }
  const commit = () => {
    const cells = picked.map(k => k.split(',').map(Number) as Cell)
    if (cells.length === 0) return
    if (!groupToTerm(nVars, { cells })) { setVerdict({ kind: 'bad', text: 'קבוצה לא חוקית' }); return }
    const sel: Sel = { rows: [...new Set(cells.map(c => c[0]))], cols: [...new Set(cells.map(c => c[1]))] }
    setGroups(gs => addGroup(gs, sel))
    setPicked([])
    setVerdict(null)
  }
  // Enter/Space on a focused cell in drag mode (no pointer) makes a one-cell group
  const onCellClick = (r: number, c: number, detail: number) => {
    if (pick) toggle(r, c)
    else if (detail === 0) {
      const sel: Sel = { rows: [r], cols: [c] }
      setGroups(gs => addGroup(gs, sel))
      setVerdict(null)
    }
  }

  const remove = (i: number) => { setGroups(gs => gs.filter((_, j) => j !== i)); setVerdict(null) }
  const locked = verdict?.kind === 'ok' && verdict.minimal

  const rects = (s: Sel, k: number, cls: string, testId?: string) => {
    const inset = 4 + (k % 3) * 3
    return runs(s.rows).flatMap(([r0, r1]) => runs(s.cols).map(([c0, c1]) => (
      <div key={`${r0}-${c0}`} className={`kgroup ${cls}`} data-testid={testId}
        style={{
          top: `calc(${r0} * var(--cell) + ${inset}px)`, left: `calc(${c0} * var(--cell) + ${inset}px)`,
          height: `calc(${r1 - r0 + 1} * var(--cell) - ${2 * inset}px)`, width: `calc(${c1 - c0 + 1} * var(--cell) - ${2 * inset}px)`,
        }} />
    )))
  }

  return (
    <div className="lab-body">
      <p className="muted kmap-hint" data-testid="kmap-hint">
        גררו בין שני תאים כדי לסמן מלבן. לקבוצה שעוטפת את קצה המפה (למשל ארבע הפינות), או לבחירה במקלדת, הדליקו <kbd>בחירת תאים</kbd>,
        סמנו את התאים אחד אחד (קליק, או Enter/רווח) ולחצו <kbd>קבע קבוצה</kbd>. לחיצה על קבוצה ברשימה מוחקת אותה.
      </p>
      <div className="kmap-wrap">
        <div className="kmap" dir="ltr" style={{ '--rows': L.rows, '--cols': L.cols } as React.CSSProperties}>
          <div className="kcorner mono">{names.slice(0, rb).join('')} \ {names.slice(rb).join('')}</div>
          <div className="khead cols mono">
            {Array.from({ length: L.cols }, (_, c) => <span key={c}>{bits(L.mintermAt(0, c) & ((1 << cb) - 1), cb)}</span>)}
          </div>
          <div className="khead rows mono">
            {Array.from({ length: L.rows }, (_, r) => <span key={r}>{bits(L.mintermAt(r, 0) >> cb, rb)}</span>)}
          </div>
          <div className={`kcells${locked ? ' locked' : ''}${pick ? ' pick' : ''}`} onPointerDown={locked ? undefined : onDown} onPointerMove={onMove}>
            {Array.from({ length: L.rows }, (_, r) => Array.from({ length: L.cols }, (_, c) => {
              const m = L.mintermAt(r, c)
              const v = minterms.includes(m) ? '1' : dontCares.includes(m) ? 'X' : '0'
              return (
                <button key={`${r}-${c}`} type="button" disabled={locked}
                  className={`kcell v${v}${picked.includes(key(r, c)) ? ' picked' : ''}`} data-r={r} data-c={c} data-testid={`kcell-${r}-${c}`}
                  aria-pressed={pick ? picked.includes(key(r, c)) : undefined} aria-label={`תא ${m}, ערך ${v}`}
                  onClick={e => onCellClick(r, c, e.detail)}>
                  <span className="mono">{v}</span>
                  <small className="mono">{m}</small>
                </button>
              )
            }))}
            {groups.map((g, i) => <div key={i} className={`kg c${g.color}`}>{rects(g, i, '')}</div>)}
            {preview && rects(preview, 0, 'preview')}
          </div>
        </div>

        <div className="kside">
          <div className="kexpr mono" dir="ltr" data-testid="kmap-expr">f = {expression}</div>
          <div className="kchips" aria-label="הקבוצות שלך">
            {groups.length === 0 && <span className="muted">עוד אין קבוצות</span>}
            {groups.map((g, i) => {
              const t = groupToTerm(nVars, toGroup(g))
              return (
                <button key={i} type="button" className={`kchip c${g.color}${t ? '' : ' invalid'}`} data-testid="kmap-group"
                  disabled={locked} onClick={() => remove(i)} aria-label={`מחק קבוצה ${t ? formatSOP([t], names) : 'לא חוקית'}`}>
                  <span className="mono" dir="ltr">{t ? formatSOP([t], names) : 'לא חוקית'}</span>
                  <span aria-hidden>×</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="lab-actions">
        {!exam && <button type="button" className="btn primary" onClick={check} disabled={locked}>בדוק</button>}
        <button type="button" className={`btn ghost${pick ? ' on' : ''}`} aria-pressed={pick} disabled={locked}
          onClick={() => (pick ? leavePick() : setPick(true))}>בחירת תאים</button>
        {pick && <>
          <button type="button" className="btn" onClick={commit} disabled={picked.length === 0}>קבע קבוצה</button>
          <button type="button" className="btn ghost" onClick={() => setPicked([])} disabled={picked.length === 0}>בטל</button>
        </>}
        <button type="button" className="btn ghost" onClick={() => { setGroups([]); setVerdict(null) }} disabled={locked || groups.length === 0}>נקה</button>
        <RestartButton onRestart={onRestart} />
      </div>

      <div className="lab-panels">
        <div className="panel-col">
          {exam && <ExamSaveNote />}
          {verdict?.kind === 'bad' && <div className="verdict bad" role="alert" key={verdict.text}><strong>{verdict.text}</strong></div>}
          {verdict?.kind === 'ok' && (
            <div className="verdict good" role="status">
              <div className="verdict-head">
                <strong className="verdict-title">{verdict.minimal ? 'נכון!' : 'נכון – אבל אפשר עם פחות ליטרלים'}</strong>
                {verdict.result && <Stars n={stars(verdict.result)} testId="result-stars" />}
              </div>
              <p className="mono-num" dir="ltr">f = {expression}</p>
              {!verdict.minimal && <p>נסו לאחד קבוצות לגדולות יותר, גם דרך קצוות המפה{host.stars ? ', כדי לקבל כוכב אופטימום' : ''}.</p>}
            </div>
          )}
        </div>
        <HostHints host={host} />
      </div>
    </div>
  )
}
