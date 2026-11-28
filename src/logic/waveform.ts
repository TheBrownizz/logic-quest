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

const isBit = (v: unknown): v is Bit => v === 0 || v === 1

function bitsError(name: string, s: readonly unknown[]): string | null {
  const i = s.findIndex(v => !isBit(v))
  return i >= 0 ? `${name}[${i}] is not 0 or 1` : null
}

/**
 * Problems that make a waveform puzzle ill-defined; an empty list means it is fine.
 * Checks: kind inputs present, q0 is a bit, SR latch never has S=R=1 in any column, `simulateWave` does not throw, clk and inputs are bits of equal length, clk has at least one rising edge, and no input
 * changes on a column boundary where clk changes (in either direction), so every latch closing and
 * every flip-flop edge samples a stable value. Clock phases may span several columns.
 */
export function validateWaveConfig(
  kind: WaveKind,
  clk: readonly Bit[],
  inputs: Record<string, readonly Bit[]>,
  q0: Bit,
): string[] {
  const errs: string[] = []
  if (!SPEC[kind]) return [`unknown waveform kind: ${String(kind)}`]
  if (!isBit(q0)) errs.push('q0 is not 0 or 1')
  for (const n of SPEC[kind].names) if (!inputs[n]) errs.push(`missing input ${n}`)
  const e0 = bitsError('clk', clk)
  if (e0) errs.push(e0)
  for (const [n, s] of Object.entries(inputs)) {
    const e = bitsError(n, s)
    if (e) errs.push(e)
    if (s.length !== clk.length) errs.push(`input ${n} has length ${s.length}, clk has ${clk.length}`)
  }
  if (errs.length) return errs
  if (kind === 'latch-SR') {
    // forbidden in any column, even while the latch is disabled
    for (let i = 0; i < clk.length; i++) {
      if (inputs.S[i] === 1 && inputs.R[i] === 1) errs.push(`forbidden S=R=1 in column ${i}`)
    }
  }
  if (!clk.some((c, i) => i > 0 && clk[i - 1] === 0 && c === 1)) errs.push('clk has no rising edge')
  for (let i = 1; i < clk.length; i++) {
    if (clk[i] === clk[i - 1]) continue
    for (const [n, s] of Object.entries(inputs)) {
      if (s[i] !== s[i - 1]) errs.push(`input ${n} changes at the clk transition into column ${i}`)
    }
  }
  if (errs.length === 0) {
    try {
      simulateWave(kind, clk, inputs, q0)
    } catch (e) {
      errs.push((e as Error).message)
    }
  }
  return errs
}

/**
 * Discrete grid: column i holds clk[i], the inputs and the returned Q[i]. Each signal is constant
 * within a column; changes happen on column boundaries. A clock phase (a run of equal clk values)
 * may span two or more columns, so inputs can change while clk is high; this is what separates
 * level-sensitive latches from edge-triggered flip-flops. `q0` is the state before column 0.
 *
 * - Latches are level-sensitive (clk=1 transparent/enabled, clk=0 hold).
 *   The latch closes at the 1->0 boundary and captures the value before it.
 * - Flip-flops are rising-edge triggered: at a 0->1 boundary between columns i-1 and i
 *   they sample the inputs of column i-1, and the new Q appears in column i.
 *   Column 0 is never an edge (no previous column).
 * - Only well-defined cases are allowed; otherwise this throws:
 *   an input that changes on the same boundary as the sampling edge (setup/hold race; for the SR
 *   latch a lone 1->0 change of S or R with the other at 0 is harmless and allowed),
 *   SR with S=R=1 while enabled, missing or wrong-length inputs, non-bit values.
 */
export function simulateWave(
  kind: WaveKind,
  clk: readonly Bit[],
  inputs: Record<string, readonly Bit[]>,
  q0: Bit,
): Bit[] {
  const spec = SPEC[kind]
  if (!spec) throw new Error(`unknown waveform kind: ${String(kind)}`)
  if (!isBit(q0)) throw new Error('q0 is not 0 or 1')
  const ce = bitsError('clk', clk)
  if (ce) throw new Error(`${kind}: ${ce}`)
  const sig = spec.names.map(n => {
    const s = inputs[n]
    if (!s) throw new Error(`${kind}: missing input ${n}`)
    if (s.length !== clk.length) throw new Error(`${kind}: input ${n} has length ${s.length}, clk has ${clk.length}`)
    const e = bitsError(n, s)
    if (e) throw new Error(`${kind}: ${e}`)
    return s
  })
  const at = (i: number) => sig.map(s => s[i]) as Bit[]
  const changed = (i: number) => sig.some(s => s[i] !== s[i - 1])
  // SR latch: one input falls 1->0 while the other is 0 before and after: Q is unaffected.
  const harmlessSR = (i: number) => {
    if (kind !== 'latch-SR') return false
    const [s, r] = sig
    const sFall = s[i - 1] === 1 && s[i] === 0 && r[i - 1] === 0 && r[i] === 0
    const rFall = r[i - 1] === 1 && r[i] === 0 && s[i - 1] === 0 && s[i] === 0
    return sFall || rFall
  }

  const out: Bit[] = []
  let q: Bit = q0
  for (let i = 0; i < clk.length; i++) {
    if (spec.level) {
      if (i > 0 && clk[i - 1] === 1 && clk[i] === 0 && changed(i) && !harmlessSR(i)) {
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
