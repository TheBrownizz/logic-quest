import type { Bit } from '../../logic/boolean'

/** Width of one waveform column and height of one signal row, in px. */
export const WAVE_COL = 36
export const WAVE_H = 30

/** The step line of a signal; null cells break the line. `edges` marks rising edges with an arrow. */
export function WaveLine({ bits, edges, cls }: { bits: Array<Bit | null>; edges?: boolean; cls?: string }) {
  const W = bits.length * WAVE_COL
  const y = (b: Bit) => (b ? 5 : WAVE_H - 5)
  const runs: string[] = []
  let d = ''
  bits.forEach((b, i) => {
    if (b === null) { if (d) runs.push(d); d = ''; return }
    const x0 = i * WAVE_COL, x1 = x0 + WAVE_COL
    d += d ? ` V${y(b)} H${x1}` : `M${x0},${y(b)} H${x1}`
  })
  if (d) runs.push(d)
  return (
    <svg className={`wave-line ${cls ?? ''}`} width={W} height={WAVE_H} viewBox={`0 0 ${W} ${WAVE_H}`} aria-hidden>
      {bits.map((_, i) => i > 0 && <line key={i} className="wave-grid" x1={i * WAVE_COL} x2={i * WAVE_COL} y1={0} y2={WAVE_H} />)}
      {runs.map((r, i) => <path key={i} d={r} />)}
      {edges && bits.map((b, i) => (i > 0 && b === 1 && bits[i - 1] === 0
        ? <path key={`e${i}`} className="wave-edge" d={`M${i * WAVE_COL - 4},${WAVE_H / 2 + 3} L${i * WAVE_COL},${WAVE_H / 2 - 4} L${i * WAVE_COL + 4},${WAVE_H / 2 + 3}`} />
        : null))}
    </svg>
  )
}
