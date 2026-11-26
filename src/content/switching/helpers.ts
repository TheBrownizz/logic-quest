import type { Node, Wire } from '../../logic/circuit'
import type { Card } from '../types'

type Claim = Extract<Card, { kind: 'claim' }>
type Mcq = Extract<Card, { kind: 'mcq' }>

/** A card factory bound to one stage id. */
export function cardsFor(stage: string) {
  return {
    claim: (id: string, c: Omit<Claim, 'id' | 'kind' | 'stage'>): Claim => ({ id, kind: 'claim', stage, ...c }),
    mcq: (id: string, c: Omit<Mcq, 'id' | 'kind' | 'stage'>): Mcq => ({ id, kind: 'mcq', stage, ...c }),
  }
}

/** A circuit node; layout is computed by the editor when every node sits at (0,0). */
export const node = (id: string, kind: Node['kind'], label?: string, delay?: number): Node =>
  delay === undefined ? { id, kind, label, x: 0, y: 0 } : { id, kind, label, x: 0, y: 0, delay }

/** A wire from output `fromPin` of `from` into input `toPin` of `to`. */
export const wire = (from: string, to: string, toPin = 0, fromPin = 0): Wire =>
  ({ from: { node: from, pin: fromPin }, to: { node: to, pin: toPin } })
