import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { WidgetProps } from './types'
import {
  snapshot, timing, toNumber, values,
  type Bar, type RippleTimelineConfig, type RippleTimelineGoal, type RippleTimelineState,
} from './rippleTimelineLogic'
import './RippleTimeline.css'

/** How long the "play" animation takes at most, in ms (shorter circuits play shorter). */
const PLAY_MS = 4200
const STEP_NS = 5

const sub = (i: number) => String.fromCodePoint(0x2080 + i)

/** A bit that is shown only once its wire has settled ("?" before). */
function Cell({ bit, ready, testId }: { bit: number; ready: boolean; testId?: string }) {
  return (
    <span key={ready ? 'r' : 'p'} className={`rt-cell ${ready ? (bit ? 'one' : 'zero') : 'pending'}`} data-testid={testId} data-ready={ready}>
      {ready ? bit : '?'}
    </span>
  )
}

function barLabel(b: Bar): string {
  return b.kind === 'xor' ? 'XOR' : b.kind === 'v' ? 'V' : `FA${sub(b.stage ?? 0)}`
}

/**
 * RippleTimeline: a ripple-carry adder with a time axis. Drag the slider (or press play) and watch the carry move
 * from stage to stage: a stage cannot finish before the carry of the one before it has arrived.
 */
export function RippleTimeline({ config, onState, completed, reducedMotion }: WidgetProps<RippleTimelineConfig, RippleTimelineState, RippleTimelineGoal>) {
  const tm = useMemo(() => timing(config), [config])
  const vals = useMemo(() => values(config), [config])
  const [t, setT] = useState(() => (completed ? tm.settle : 0))
  const [playing, setPlaying] = useState(false)
  const raf = useRef(0)
  const tRef = useRef(t)
  tRef.current = t
  const report = useRef(onState)
  report.current = onState

  useEffect(() => { report.current({ t }) }, [t])

  const stop = useCallback(() => { cancelAnimationFrame(raf.current); setPlaying(false) }, [])
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const play = useCallback(() => {
    if (reducedMotion) { setT(tm.settle); return }
    const from = tRef.current >= tm.settle ? 0 : tRef.current
    const ms = Math.min(PLAY_MS, Math.max(1500, tm.settle * 8))
    const begin = performance.now()
    const startAt = from
    setPlaying(true)
    const tick = (now: number) => {
      const next = Math.min(tm.settle, Math.round(startAt + ((now - begin) / ms) * tm.settle))
      setT(next)
      if (next >= tm.settle) setPlaying(false)
      else raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }, [reducedMotion, tm.settle])

  const snap = snapshot(config, t)
  const n = tm.n
  const cols = ['cout', ...Array.from({ length: n }, (_, k) => n - 1 - k)] as const
  const pct = (x: number) => `${(x / tm.settle) * 100}%`
  const hasM = config.m !== undefined

  const total = toNumber(vals.sum) + vals.carry[n] * 2 ** n
  const subtract = config.m === 1
  const diff = vals.carry[n] ? toNumber(vals.sum) : toNumber(vals.sum) - 2 ** n
  const a = toNumber(vals.a)
  const b = toNumber(vals.b)
  const result = subtract ? `${a} − ${b} = ${diff}` : `${a} + ${b} = ${total}`

  return (
    <div className="rt" dir="ltr" data-testid="ripple-timeline" data-t={t} data-settled={snap.settled}>
      <div className="rt-grid" style={{ '--cols': n + 1 } as CSSProperties} role="group" aria-label="adder">
        <span className="rt-lab" />
        {cols.map(c => <span key={c} className="rt-head">{c === 'cout' ? 'Cout' : `bit ${c}`}</span>)}

        <span className="rt-lab">A</span>
        {cols.map(c => (c === 'cout' ? <span key={c} /> : <Cell key={c} bit={vals.a[c]} ready />))}

        <span className="rt-lab">B</span>
        {cols.map(c => (c === 'cout' ? <span key={c} /> : <Cell key={c} bit={vals.b[c]} ready />))}

        {hasM && (<>
          <span className="rt-lab" title="B xor M">B⊕M</span>
          {cols.map(c => (c === 'cout' ? <span key={c} /> : <Cell key={c} bit={vals.bx[c]} ready={snap.bReady} testId={`rt-bx-${c}`} />))}
        </>)}

        <span className="rt-lab">carry</span>
        {cols.map(c => (c === 'cout'
          ? <Cell key={c} bit={vals.carry[n]} ready={snap.carryReady[n]} testId="rt-carry-out" />
          : <Cell key={c} bit={vals.carry[c]} ready={snap.carryReady[c]} testId={`rt-carry-${c}`} />))}

        <span className="rt-lab">FA</span>
        {cols.map(c => (c === 'cout'
          ? <span key={c} className="rt-arrow" aria-hidden>◀</span>
          : (
            <span key={c} className={`rt-fa ${snap.stages[c]}`} data-testid={`rt-fa-${c}`} data-status={snap.stages[c]}>
              <b>FA</b><small>{tm.stages[c].end} ns</small>
            </span>
          )))}

        <span className="rt-lab">S</span>
        {cols.map(c => (c === 'cout' ? <span key={c} /> : <Cell key={c} bit={vals.sum[c]} ready={snap.stages[c] === 'done'} testId={`rt-sum-${c}`} />))}
      </div>

      {config.overflow && (
        <p className="rt-v">
          <span className="rt-lab-inline">V = C{sub(n)} ⊕ C{sub(n - 1)}</span>
          <Cell bit={vals.v ?? 0} ready={snap.vReady} testId="rt-v" />
        </p>
      )}

      <div className="rt-axis">
        <div className="rt-tracks" aria-hidden>
          {tm.bars.map(b => {
            const len = b.end - b.start
            const fill = Math.max(0, Math.min(1, (t - b.start) / len))
            const state = t >= b.end ? 'done' : t >= b.start ? 'active' : 'waiting'
            return (
              <div key={b.id} className="rt-row">
                <span className="rt-name">{barLabel(b)}</span>
                <span className="rt-track">
                  <span className={`rt-bar ${state} ${b.kind}`} style={{ left: pct(b.start), width: pct(len) }}>
                    <span className="rt-fill" style={{ width: `${fill * 100}%` }} />
                    <span className="rt-end">{b.end}</span>
                  </span>
                </span>
              </div>
            )
          })}
          <span className="rt-cursor-wrap"><span className="rt-cursor" style={{ left: pct(t) }} /></span>
        </div>
        <div className="rt-row rt-slider-row">
          <span className="rt-name">t</span>
          <input
            type="range" className="rt-slider" min={0} max={tm.settle} step={STEP_NS} value={t}
            data-testid="ripple-slider"
            aria-label="time in nanoseconds"
            aria-valuetext={`${t} ns`}
            onChange={e => { stop(); setT(Number(e.target.value)) }}
          />
        </div>
      </div>

      <div className="rt-foot">
        <button type="button" className="btn ghost rt-play" data-testid="ripple-play" onClick={playing ? stop : play}>
          {playing ? '⏸ עצרו' : t >= tm.settle ? '↻ שוב' : '▶ הפעילו'}
        </button>
        <output className="rt-time mono" data-testid="ripple-time" aria-live="off">t = {t} ns</output>
        <span className={`rt-state ${snap.settled ? 'ok' : ''}`} data-testid="ripple-state">
          {snap.settled ? `✓ הכול יציב. ${tm.settle} ns` : 'עדיין בחישוב'}
        </span>
      </div>
      {snap.settled && <p className="rt-result" data-testid="ripple-result">{'התוצאה: '}<bdi dir="ltr" className="mono">{result}</bdi></p>}
    </div>
  )
}
