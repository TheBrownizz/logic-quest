/**
 * RippleTimeline (spec 6.4.8): a ripple-carry adder (or adder/subtractor) with a draggable timeline.
 *
 * Timing model, the one of the course exam: every full adder (FA) is `delays.fa` ns from any input to any output;
 * with `m` set, each B input first passes an XOR (`delays.xor` ns) and M is also the carry in (M itself is ideal, 0 ns).
 * So stage i starts when both its B input and its carry in are ready, and finishes `fa` ns later; its sum and its
 * carry out are ready then. These are worst-case arrival times, the same numbers `arrivalTimes` computes for the
 * equivalent circuit (tests/ui/widgets/ripple.test.ts compares them).
 *
 * Pure: no DOM, so the lesson validator can run it in node.
 */

export interface RippleTimelineConfig {
  /** Operand A, most significant first (e.g. '0111'); 2–8 bits. */
  a: string
  /** Operand B, same length as `a`. */
  b: string
  /** Delays in ns: one full adder, and the XOR on each B input (used when `m` is set). */
  delays: { fa: number; xor?: number }
  /** Adder/subtractor control: B passes through XOR with M, and M is the carry in. Absent: a plain adder, carry in 0. */
  m?: 0 | 1
  /** Also show the overflow output V = C(n) ⊕ C(n−1): one more XOR after the last carry. */
  overflow?: boolean
}
export interface RippleTimelineState {
  /** The time on the timeline, in ns. */
  t: number
}
export type RippleTimelineGoal =
  /** Drag until every output has settled (t ≥ the worst-case delay). */
  | { kind: 'settled' }
  /** Drag to at least `t` ns. */
  | { kind: 'time'; t: number }

export function initial(_c: RippleTimelineConfig): RippleTimelineState {
  return { t: 0 }
}

export const MIN_BITS = 2
export const MAX_BITS = 8

/** Bit string, most significant first, to an array with bit 0 first. */
const lsbFirst = (s: string): number[] => [...s].reverse().map(ch => (ch === '1' ? 1 : 0))

/** Throws when the config is not a well-formed adder (bad bit strings, lengths, delays). */
export function checkConfig(c: RippleTimelineConfig): number {
  const n = c.a.length
  if (n < MIN_BITS || n > MAX_BITS) throw new RangeError(`operands must have ${MIN_BITS}–${MAX_BITS} bits`)
  if (c.b.length !== n) throw new RangeError('a and b must have the same length')
  if (!/^[01]+$/.test(c.a) || !/^[01]+$/.test(c.b)) throw new RangeError('a and b must be 0/1 strings')
  const ok = (x: number) => Number.isFinite(x) && x >= 0
  if (!ok(c.delays.fa) || c.delays.fa <= 0) throw new RangeError('fa delay must be positive')
  if (c.delays.xor !== undefined && !ok(c.delays.xor)) throw new RangeError('xor delay must not be negative')
  return n
}

/** One bar of the timeline: a gate or stage that is busy from `start` to `end` ns. */
export interface Bar {
  id: string
  /** 'xor': the XORs on B; 'fa': a full adder; 'v': the overflow XOR. */
  kind: 'xor' | 'fa' | 'v'
  /** Stage number for 'fa' (0 = least significant). */
  stage?: number
  start: number
  end: number
}

export interface Timing {
  n: number
  /** When the B inputs of the adder are ready: after the XOR with `m`, or at 0 for a plain adder. */
  bReady: number
  /** carry[i] is when the carry INTO stage i is ready; carry[n] is the carry out. */
  carry: number[]
  /** The busy window of each full adder, stage 0 first. */
  stages: Bar[]
  /** When the overflow output V is ready (only with `overflow`). */
  vReady?: number
  /** The bars to draw, top to bottom: XOR (if any), FA0…FA(n−1), V (if any). */
  bars: Bar[]
  /** The worst-case time at which every output is stable. */
  settle: number
}

export function timing(c: RippleTimelineConfig): Timing {
  const n = checkConfig(c)
  const xor = c.delays.xor ?? 0
  const bReady = c.m === undefined ? 0 : xor
  const carry: number[] = [0]
  const stages: Bar[] = []
  for (let i = 0; i < n; i++) {
    const start = Math.max(bReady, carry[i])
    const end = start + c.delays.fa
    stages.push({ id: `fa${i}`, kind: 'fa', stage: i, start, end })
    carry.push(end)
  }
  const bars: Bar[] = []
  if (c.m !== undefined) bars.push({ id: 'xor', kind: 'xor', start: 0, end: xor })
  bars.push(...stages)
  let vReady: number | undefined
  if (c.overflow) {
    // V = C(n) xor C(n−1): ready one XOR after the later of the two carries, which is C(n)
    vReady = Math.max(carry[n], carry[n - 1]) + xor
    bars.push({ id: 'v', kind: 'v', start: Math.max(carry[n], carry[n - 1]), end: vReady })
  }
  return { n, bReady, carry, stages, vReady, bars, settle: vReady ?? carry[n] }
}

export interface Values {
  /** All arrays have bit 0 first. */
  a: number[]
  b: number[]
  /** B after the XOR with M (equal to `b` for a plain adder). */
  bx: number[]
  /** carry[i] into stage i; carry[n] is the carry out. */
  carry: number[]
  sum: number[]
  /** C(n) xor C(n−1), with `overflow`. */
  v?: number
}

/** The settled values of every wire. */
export function values(c: RippleTimelineConfig): Values {
  const n = checkConfig(c)
  const m = c.m ?? 0
  const a = lsbFirst(c.a)
  const b = lsbFirst(c.b)
  const bx = c.m === undefined ? b : b.map(x => x ^ m)
  const carry: number[] = [m]
  const sum: number[] = []
  for (let i = 0; i < n; i++) {
    const t = a[i] + bx[i] + carry[i]
    sum.push(t & 1)
    carry.push(t >> 1)
  }
  return { a, b, bx, carry, sum, v: c.overflow ? carry[n] ^ carry[n - 1] : undefined }
}

export type StageStatus = 'waiting' | 'active' | 'done'

export interface Snapshot {
  /** Per stage: not started (waits for its carry), busy, or finished. */
  stages: StageStatus[]
  /** Is the carry into stage i (i = 0…n) ready at time t? */
  carryReady: boolean[]
  /** Are the XORs on B finished (always true for a plain adder)? */
  bReady: boolean
  /** Is V ready (only meaningful with `overflow`)? */
  vReady: boolean
  /** Every output is stable. */
  settled: boolean
}

/** What is ready at time `t` ns. */
export function snapshot(c: RippleTimelineConfig, t: number): Snapshot {
  const tm = timing(c)
  return {
    stages: tm.stages.map((s): StageStatus => (t >= s.end ? 'done' : t >= s.start ? 'active' : 'waiting')),
    carryReady: tm.carry.map(x => t >= x),
    bReady: t >= tm.bReady,
    vReady: tm.vReady !== undefined && t >= tm.vReady,
    settled: t >= tm.settle,
  }
}

/** The time after which the carry out is stable in a plain ripple chain: n stages of `fa` ns each. */
export const rippleChainDelay = (bits: number, fa: number): number => bits * fa

export function isGoalMet(s: RippleTimelineState, g: RippleTimelineGoal, c: RippleTimelineConfig): boolean {
  if (!Number.isFinite(s.t)) return false
  return g.kind === 'settled' ? s.t >= timing(c).settle : s.t >= g.t
}

/** The unsigned value of a bit array (bit 0 first). */
export const toNumber = (bits: number[]): number => bits.reduce((acc, b, i) => acc + b * 2 ** i, 0)
