import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { WidgetProps } from './types'
import {
  cycleData, dataCount, goalState, evalSrc, implementedMinterms, initial, output, requiredData, selectIndex, selectNames, setSelect, setX, toggleInput,
  type DataSrc, type MuxToyConfig, type MuxToyGoal, type MuxToyState,
} from './muxToyLogic'
import './MuxToy.css'

const bits = (i: number, n: number) => i.toString(2).padStart(n, '0')

/**
 * MuxToy: a multiplexer. The select lines pick one data input and its value flows to the output; the others are
 * blocked. In function mode the data inputs are the function's truth table, so setting them implements F.
 */
export function MuxToy({ config, goal, onState, reducedMotion, completed }: WidgetProps<MuxToyConfig, MuxToyState, MuxToyGoal>) {
  const [s, setS] = useState<MuxToyState>(() => (completed && goal ? goalState(config, goal) : initial(config)))
  const report = useRef(onState)
  report.current = onState
  useEffect(() => { report.current(s) }, [s])

  const n = dataCount(config)
  const names = selectNames(config)
  const ext = config.extra
  const rom = config.skin === 'rom'
  const idx = selectIndex(s.select)
  const y = output(s)
  const target: DataSrc[] | undefined = useMemo(() => {
    if (!goal) return undefined
    if (goal.kind === 'implements') return Array.from({ length: n }, (_, i) => (goal.minterms.includes(i) ? 1 : 0))
    if (goal.kind === 'implements-x') return requiredData(goal.minterms, config.selectBits)
    return undefined
  }, [goal, n, config.selectBits])

  const dLabel = (i: number) => (rom ? `${i}` : `D${i}`)
  const srcText = (d: DataSrc) => (d === 'x' ? ext ?? 'X' : d === 'nx' ? `${ext ?? 'X'}'` : String(d))
  const matches = (i: number) => {
    if (!target) return undefined
    if (ext !== undefined) {
      const have = s.data?.[i] ?? 0, want = target[i]
      return evalSrc(have, 0) === evalSrc(want, 0) && evalSrc(have, 1) === evalSrc(want, 1)
    }
    return s.inputs[i] === target[i]
  }
  const fn = implementedMinterms(s, config)
  const showTable = config.mode === 'function' || target !== undefined
  const sweepKey = `${idx}-${y}`

  return (
    <div className={`mux ${rom ? 'rom' : ''} ${reducedMotion ? 'rm' : ''}`} dir="ltr" data-testid="mux-toy" data-select={idx} data-output={y}>
      <div className="mux-board" style={{ '--rows': n } as CSSProperties}>
        {Array.from({ length: n }, (_, i) => {
          const v = s.inputs[i]
          const chosen = i === idx
          const src = s.data?.[i]
          return (
            <div key={i} className={`mux-in ${chosen ? 'chosen' : ''}`} style={{ gridRow: i + 1 }}>
              <span className="mux-dname">{dLabel(i)}</span>
              <button
                type="button" className={`mux-bit v${v} ${src === 'x' || src === 'nx' ? 'var' : ''}`} data-testid={`mux-d-${i}`}
                aria-label={ext !== undefined ? `${dLabel(i)} = ${src === undefined ? v : srcText(src)}` : `${dLabel(i)} = ${v}`}
                onClick={() => setS(p => (ext !== undefined ? cycleData(p, i) : toggleInput(p, i)))}
              >{ext !== undefined && src !== undefined ? srcText(src) : v}</button>
              <span key={chosen ? sweepKey : 'idle'} className={`mux-wire v${v} ${chosen ? 'sel' : ''}`} aria-hidden />
            </div>
          )
        })}
        <div className="mux-body" style={{ gridRow: `1 / span ${n}` }}>
          <svg className="mux-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <polygon points="0,0 100,14 100,86 0,100" />
          </svg>
          <span className="mux-title">{rom ? 'ROM' : 'MUX'}</span>
          <span className="mux-pick" data-testid="mux-pick">{dLabel(idx)}</span>
        </div>
        <div className="mux-out" style={{ gridRow: `1 / span ${n}` }}>
          <span key={sweepKey} className={`mux-wire out v${y}`} aria-hidden />
          <span className={`mux-lamp v${y}`} data-testid="mux-lamp" role="status" aria-label={`יציאה Y = ${y}`}>
            <b>Y</b>{y}
          </span>
        </div>
        <div className="mux-sel" style={{ gridRow: n + 1 }}>
          {s.select.map((b, k) => (
            <label key={k} className="mux-selbox">
              <span className="mux-sname">{names[k]}</span>
              <button
                type="button" className={`mux-bit v${b}`} data-testid={`mux-s-${k}`} aria-pressed={b === 1}
                aria-label={`${names[k]} = ${b}`}
                onClick={() => setS(p => setSelect(p, k, (p.select[k] ^ 1) as 0 | 1))}
              >{b}</button>
            </label>
          ))}
          {ext !== undefined && (
            <label className="mux-selbox xvar">
              <span className="mux-sname">{ext}</span>
              <button
                type="button" className={`mux-bit v${s.x ?? 0}`} data-testid="mux-x" aria-pressed={s.x === 1}
                aria-label={`${ext} = ${s.x ?? 0}`}
                onClick={() => setS(p => setX(p, ((p.x ?? 0) ^ 1) as 0 | 1))}
              >{s.x ?? 0}</button>
            </label>
          )}
        </div>
      </div>

      <p className="mux-line" data-testid="mux-line">
        <bdi dir="ltr" className="mono">{(`${names.join('')} = ${bits(idx, config.selectBits)}  →  ${dLabel(idx)}  →  Y = ${y}`)}</bdi>
      </p>

      {showTable && (
        <table className="mux-table" data-testid="mux-table">
          <thead>
            <tr>
              <th>{names.join('')}</th>
              {target && (ext !== undefined ? <><th>{`${ext}=0`}</th><th>{`${ext}=1`}</th></> : <th>F</th>)}
              <th>{rom ? 'תא' : 'D'}</th>
              {target && <th aria-label="התאמה" />}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: n }, (_, i) => {
              const ok = matches(i)
              const want = target?.[i]
              return (
                <tr key={i} className={`${i === idx ? 'cur' : ''} ${ok === undefined ? '' : ok ? 'ok' : 'miss'}`} data-testid={`mux-row-${i}`}>
                  <td>{bits(i, config.selectBits)}</td>
                  {target && want !== undefined && (ext !== undefined
                    ? <><td>{evalSrc(want, 0)}</td><td>{evalSrc(want, 1)}</td></>
                    : <td>{evalSrc(want, 0)}</td>)}
                  <td>{ext !== undefined && s.data ? srcText(s.data[i]) : s.inputs[i]}</td>
                  {target && <td className="mux-mark">{ok ? '✓' : '·'}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {config.mode === 'function' && (
        <p className="mux-fn mono" data-testid="mux-fn">
          {`F = Σm(${fn.join(', ')})`}
        </p>
      )}
    </div>
  )
}
