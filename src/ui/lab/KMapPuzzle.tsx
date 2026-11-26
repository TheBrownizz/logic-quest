import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import type { LabPuzzle, Room } from '../../content/types'
import type { RoomResult } from '../../game/progress'
import { stars } from '../../game/rules'
import { checkCover, groupToTerm, kmapLayout, type Group } from '../../logic/kmap'
import { formatSOP } from '../../logic/qm'
import { Stars } from '../Stars'
import { Hints, useHelped, useSolve } from './roomParts'
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

type Verdict = { kind: 'bad'; text: string } | { kind: 'ok'; minimal: boolean; result: RoomResult }

export function KMapPuzzle({ room, puzzle }: { room: Room; puzzle: KMapPz }) {
  const { nVars, minterms, dontCares } = puzzle
  const L = useMemo(() => kmapLayout(nVars), [nVars])
  const rb = Math.floor(nVars / 2)
  const cb = nVars - rb
  const solve = useSolve(room.id)
  const [helped, markHelped] = useHelped(room.id)
  const [hintsShown, setHintsShown] = useState(0)
  const [groups, setGroups] = useState<KGroup[]>([])
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [drag, setDrag] = useState<{ start: Cell; cur: Cell; shift: boolean } | null>(null)
  const dragRef = useRef(drag)
  dragRef.current = drag

  const cellOf = (t: EventTarget | null): Cell | null => {
    const el = (t as HTMLElement | null)?.closest?.('[data-r]') as HTMLElement | null
    return el ? [Number(el.dataset.r), Number(el.dataset.c)] : null
  }

  const preview = drag ? dragSelection(drag.start, drag.cur, L.rows, L.cols, drag.shift) : null

  const onDown = (e: PointerEvent) => {
    const c = cellOf(e.target)
    if (!c || e.button !== 0) return
    setDrag({ start: c, cur: c, shift: e.shiftKey })
  }
  const onMove = (e: PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const c = cellOf(e.target) ?? d.cur
    if (c !== d.cur && (c[0] !== d.cur[0] || c[1] !== d.cur[1]) || e.shiftKey !== d.shift) setDrag({ ...d, cur: c, shift: e.shiftKey })
  }

  // The release can happen anywhere, so listen on the window while dragging.
  const active = drag !== null
  useEffect(() => {
    if (!active) return
    const up = (e: globalThis.PointerEvent) => {
      const d = dragRef.current
      setDrag(null)
      if (!d) return
      const sel = dragSelection(d.start, d.cur, L.rows, L.cols, e.shiftKey)
      setGroups(gs => {
        if (gs.some(g => sameSel(g, sel))) return gs
        const used = new Set(gs.map(g => g.color))
        let color = 0
        while (used.has(color) && color < COLORS - 1) color++
        if (used.has(color)) color = gs.length % COLORS
        return [...gs, { ...sel, color }]
      })
      setVerdict(null)
    }
    const cancel = () => setDrag(null)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    return () => { window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel) }
  }, [active, L])

  const cover = useMemo(() => checkCover(nVars, minterms, dontCares, groups.map(toGroup)), [nVars, minterms, dontCares, groups])
  const names = NAMES.slice(0, nVars)

  const check = () => {
    let text: string | null = null
    if (!cover.valid) text = 'קבוצה לא חוקית'
    else if (cover.coversZero) text = 'תפסת 0'
    else if (!cover.covered) text = 'לא כיסית את כל ה-1'
    if (text) { setVerdict({ kind: 'bad', text }); return }
    const result = solve({ solved: true, optimal: cover.isMinimal, noHints: !helped })
    setVerdict({ kind: 'ok', minimal: cover.isMinimal, result })
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
        גררו בין שני תאים כדי לסמן קבוצה. כדי לעטוף דרך קצה המפה (למשל ארבע הפינות) החזיקו <kbd>Shift</kbd> בזמן הגרירה.
        לחיצה על קבוצה ברשימה מוחקת אותה.
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
          <div className={`kcells${locked ? ' locked' : ''}`} onPointerDown={locked ? undefined : onDown} onPointerMove={onMove}>
            {Array.from({ length: L.rows }, (_, r) => Array.from({ length: L.cols }, (_, c) => {
              const m = L.mintermAt(r, c)
              const v = minterms.includes(m) ? '1' : dontCares.includes(m) ? 'X' : '0'
              return (
                <div key={`${r}-${c}`} className={`kcell v${v}`} data-r={r} data-c={c} data-testid={`kcell-${r}-${c}`}>
                  <span className="mono">{v}</span>
                  <small className="mono">{m}</small>
                </div>
              )
            }))}
            {groups.map((g, i) => <div key={i} className={`kg c${g.color}`}>{rects(g, i, '')}</div>)}
            {preview && rects(preview, 0, 'preview')}
          </div>
        </div>

        <div className="kside">
          <div className="kexpr mono" dir="ltr" data-testid="kmap-expr">f = {cover.expression}</div>
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
        <button type="button" className="btn primary" onClick={check} disabled={locked}>בדוק</button>
        <button type="button" className="btn ghost" onClick={() => { setGroups([]); setVerdict(null) }} disabled={locked || groups.length === 0}>נקה</button>
      </div>

      <div className="lab-panels">
        <div className="panel-col">
          {verdict?.kind === 'bad' && <div className="verdict bad" role="alert" key={verdict.text}><strong>{verdict.text}</strong></div>}
          {verdict?.kind === 'ok' && (
            <div className="verdict good" role="status">
              <div className="verdict-head">
                <strong className="verdict-title">{verdict.minimal ? 'נכון!' : 'נכון – אבל אפשר עם פחות ליטרלים'}</strong>
                <Stars n={stars(verdict.result)} testId="result-stars" />
              </div>
              <p className="mono-num" dir="ltr">f = {cover.expression}</p>
              {!verdict.minimal && <p>נסו לאחד קבוצות לגדולות יותר, גם דרך קצוות המפה, כדי לקבל כוכב אופטימום.</p>}
            </div>
          )}
        </div>
        <Hints hints={room.hints} shown={hintsShown} onReveal={() => { setHintsShown(s => s + 1); markHelped() }} />
      </div>
    </div>
  )
}
