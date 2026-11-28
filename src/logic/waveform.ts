import type { Bit } from './boolean'
import { isForbidden, nextState, type FFType } from './sequential'

export type WaveKind = 'latch-D' | 'latch-SR' | 'ff-D' | 'ff-T' | 'ff-JK'

const SPEC: Record<WaveKind, { names: string[]; level: boolean; ff?: FFType }> = {
  'latch-D': { names: ['D'], level: true },
  'latch-SR': { names: ['S', 'R'], level: true },
  'ff-D': { names: ['D'], level: false, ff: 'D' },
  'ff-T': { names: ['T'], level: false, ff: 'T' },
  'ff-JK': { names: ['J', 'K'], level: false, ff: 'JK' },
}

/**
 * Discrete half-cycle grid: column i holds clk[i], the inputs and the returned Q[i].
 * Each signal is constant within a column; changes happen on column boundaries.
 *
 * - Latches are level-sensitive (clk=1 transparent/enabled, clk=0 hold).
 *   The latch closes at the 1->0 boundary and captures the value before it.
 * - Flip-flops are rising-edge triggered: at a 0->1 boundary between columns i-1 and i
 *   they sample the inputs of column i-1, and the new Q appears in column i.
 *   Column 0 is never an edge (no previous column).
 * - Only well-defined cases are allowed; otherwise this throws:
 *   an input that changes on the same boundary as the sampling edge (setup/hold race),
 *   SR with S=R=1 while enabled, missing or wrong-length inputs.
 */
export function simulateWave(
  kind: WaveKind,
  clk: readonly Bit[],
  inputs: Record<string, readonly Bit[]>,
  q0: Bit,
): Bit[] {
  const spec = SPEC[kind]
  if (!spec) throw new Error(`unknown waveform kind: ${String(kind)}`)
  const sig = spec.names.map(n => {
    const s = inputs[n]
    if (!s) throw new Error(`${kind}: missing input ${n}`)
    if (s.length !== clk.length) throw new Error(`${kind}: input ${n} has length ${s.length}, clk has ${clk.length}`)
    return s
  })
  const at = (i: number) => sig.map(s => s[i]) as Bit[]
  const changed = (i: number) => sig.some(s => s[i] !== s[i - 1])

  const out: Bit[] = []
  let q: Bit = q0
  for (let i = 0; i < clk.length; i++) {
    if (spec.level) {
      if (i > 0 && clk[i - 1] === 1 && clk[i] === 0 && changed(i)) {
        throw new Error(`${kind}: race, input changes as the latch closes (column ${i})`)
      }
      if (clk[i] === 1) {
        if (kind === 'latch-D') q = at(i)[0]
        else {
          const sr = at(i)
          if (isForbidden('SR', sr)) throw new Error(`${kind}: forbidden S=R=1 (column ${i})`)
          q = nextState('SR', q, sr)
        }
      }
    } else if (i > 0 && clk[i - 1] === 0 && clk[i] === 1) {
      if (changed(i)) throw new Error(`${kind}: race, input changes at the rising edge (column ${i})`)
      q = nextState(spec.ff!, q, at(i - 1))
    }
    out.push(q)
  }
  return out
}
