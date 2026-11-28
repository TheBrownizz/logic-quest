import type { Bit, Out } from './boolean'

export type FFType = 'D' | 'T' | 'JK' | 'SR'

/** Input order per type: D=[D], T=[T], JK=[J,K], SR=[S,R]. */
export function inputCount(t: FFType): number {
  return t === 'JK' || t === 'SR' ? 2 : 1
}

/** SR with S=R=1 is the only forbidden combination. */
export function isForbidden(t: FFType, inp: readonly Bit[]): boolean {
  return t === 'SR' && inp[0] === 1 && inp[1] === 1
}

function check(t: FFType, inp: readonly Bit[]): void {
  if (inp.length !== inputCount(t)) {
    throw new Error(`${t} flip-flop takes ${inputCount(t)} input(s), got ${inp.length}`)
  }
}

/** Characteristic table: next Q for current Q and inputs. Throws on SR with S=R=1. */
export function nextState(t: FFType, q: Bit, inp: readonly Bit[]): Bit {
  check(t, inp)
  switch (t) {
    case 'D':
      return inp[0]
    case 'T':
      return (q ^ inp[0]) as Bit
    case 'JK': {
      const [j, k] = inp
      if (j && k) return (1 - q) as Bit // toggle
      if (j) return 1
      if (k) return 0
      return q
    }
    case 'SR': {
      const [s, r] = inp
      if (s && r) throw new Error('SR flip-flop: S=R=1 is forbidden')
      if (s) return 1
      if (r) return 0
      return q
    }
  }
}

/** Excitation table: required inputs (with 'x' don't-cares) to move q to qNext. */
export function excitation(t: FFType, q: Bit, qNext: Bit): Out[] {
  switch (t) {
    case 'D':
      return [qNext]
    case 'T':
      return [(q ^ qNext) as Bit]
    case 'JK':
      if (q === 0) return qNext === 0 ? [0, 'x'] : [1, 'x']
      return qNext === 0 ? ['x', 1] : ['x', 0]
    case 'SR':
      if (q === 0) return qNext === 0 ? [0, 'x'] : [1, 0]
      return qNext === 0 ? [0, 1] : ['x', 0]
  }
}
