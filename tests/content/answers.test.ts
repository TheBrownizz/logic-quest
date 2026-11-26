import { describe, it, expect } from 'vitest'
import { complementR, digitsValue, encodeIEEE754, findBases, fromBase, isValidIn, toBase } from '../../src/logic/numbers'
import { evenParityBit, toBCD, toGray } from '../../src/logic/codes'
import { muxTree, romBits } from '../../src/logic/sizing'
import { minimizeSOP, primeImplicants, formatSOP, literalCount } from '../../src/logic/qm'
import { arrivalTimes } from '../../src/logic/circuit'
import { referenceChips } from '../../src/content/chips'
import { switchingWorld } from '../../src/content/switching/world'
import { adderSubtractor } from '../../src/content/switching/stage5'
import type { Card } from '../../src/content/types'

/** Re-derives card answers with the logic core (self-review guard). */
const card = (id: string): Card => switchingWorld.stages.flatMap(s => s.cards).find(c => c.id === id)!
const mcqAnswer = (id: string) => { const c = card(id); if (c.kind !== 'mcq') throw new Error(id); return c.options[c.correct] }
const claimTruth = (id: string) => { const c = card(id); if (c.kind !== 'claim') throw new Error(id); return c.isTrue }
const bases = (l: (r: number) => number, rr: (r: number) => number, digits: string[]) =>
  findBases(l, rr).filter(r => digits.every(d => isValidIn(d, r)))
/** Truth table (as minterm list) of f over n variables, A = MSB. */
const minterms = (n: number, f: (v: number[]) => boolean) =>
  Array.from({ length: 1 << n }, (_, i) => i).filter(i => f(Array.from({ length: n }, (_, j) => (i >> (n - 1 - j)) & 1)))

describe('stage 1 answers', () => {
  it('cards', () => {
    expect(claimTruth('sw-1-c2')).toBe(fromBase('1A7', 16) < fromBase('647', 8))
    expect(fromBase('1A7', 16)).toBe(fromBase('647', 8))
    expect(bases(r => digitsValue('121', r), () => 49, ['121'])).toEqual([6])
    expect(claimTruth('sw-1-c9')).toBe(false)
    expect(bases(r => digitsValue('13', r) + digitsValue('22', r), r => digitsValue('40', r), ['13', '22', '40'])).toEqual([5])
    expect(mcqAnswer('sw-1-c10')).toBe(String(fromBase('2F', 16)))
    expect(mcqAnswer('sw-1-c12')).toBe(String(bases(r => digitsValue('3', r) * digitsValue('4', r), r => digitsValue('20', r), ['3', '4', '20'])[0]))
    expect(mcqAnswer('sw-1-c13')).toBe(complementR('01100100', 2))
    expect(mcqAnswer('sw-1-c14')).toBe(String(toBase(1000, 2).length))
    expect(mcqAnswer('sw-1-c15')).toBe('0.' + toBase(0.6875 * 16, 2).padStart(4, '0'))
  })
})

describe('stage 2 answers', () => {
  it('cards', () => {
    for (const x of [4, 5.5, 7.999]) expect(encodeIEEE754(x).exponent).toBe(129)
    expect(encodeIEEE754(8).exponent).toBe(130)
    expect(mcqAnswer('sw-2-c12')).toBe(String(encodeIEEE754(0.375).exponent))
    expect([...'11010110'].filter(b => b === '1').length % 2).toBe(1)
    expect(mcqAnswer('sw-2-c14')).toBe(toGray('0110'))
    expect(mcqAnswer('sw-2-c15')).toBe(toBCD(59))
    expect(toBase((7 + 6) % 16, 2)).toBe('1101')
    expect(mcqAnswer('sw-2-c16').startsWith('1101, ויש גלישה')).toBe(true)
    expect(evenParityBit('0110100')).toBe('1')
    // special values
    expect(encodeIEEE754(Infinity)).toMatchObject({ exponent: 255, mantissa: 0 })
    expect(encodeIEEE754(0)).toMatchObject({ exponent: 0, mantissa: 0 })
    expect(encodeIEEE754(2 ** -126)).toMatchObject({ exponent: 1, mantissa: 0 })
  })
})

describe('stage 3 answers', () => {
  it('cards', () => {
    expect(mcqAnswer('sw-3-c15')).toBe(`Σ(${minterms(3, ([a, b, c]) => (!a && !!b) || (!!a && !!c)).join(',')})`)
    // De Morgan and absorption by exhaustion
    for (const a of [0, 1]) for (const b of [0, 1]) {
      expect(+!(a && b)).toBe(+(!a || !b))
      expect(+!(a || b) === +(!a || !b)).toBe(a === b) // claim c4 fails exactly when a != b
      expect(+(a || (!a && b))).toBe(+(a || b))
    }
  })
})

describe('stage 4 answers', () => {
  it('cards', () => {
    const f = [0, 1, 2, 3, 7]
    expect(minterms(3, ([a, b, c]) => (!a || !!b) && (!a || !!c))).toEqual(f)
    expect(minterms(3, ([a, b, c]) => (!!a || !b) && (!!a || !c))).not.toEqual(f)
    expect(minterms(3, ([a, b, c]) => !a || !!b || !!c)).not.toEqual(f)
    expect(minterms(3, ([a, b, c]) => (!a || !b) && (!a || !c))).not.toEqual(f)
    expect(minterms(3, ([a, b, c]) => (!!a || !!b) && (!!a || !!c))).not.toEqual(f)
    expect(minterms(3, ([a, b, c]) => !a && (!!b || !!c))).not.toEqual(f)
    expect(mcqAnswer('sw-4-c12')).toBe(String(primeImplicants(3, [0, 1, 2, 5, 6, 7]).length))
    expect(mcqAnswer('sw-4-c13')).toBe(formatSOP(minimizeSOP(4, [5, 7, 13, 15]), ['A', 'B', 'C', 'D']))
    expect(mcqAnswer('sw-4-c14')).toBe(formatSOP(minimizeSOP(4, [1, 3, 5, 7, 9], [11, 13, 15]), ['A', 'B', 'C', 'D']))
    // c8: two different minimal covers of the cyclic function
    const best = minimizeSOP(3, [0, 1, 2, 5, 6, 7])
    expect(best.length).toBe(3)
    expect(literalCount(best)).toBe(6)
  })
})

describe('stage 5 answers', () => {
  it('cards', () => {
    expect(mcqAnswer('sw-5-c13')).toBe(String(muxTree(64, 4).total))
    expect(muxTree(8, 4)).toMatchObject({ total: 3, partial: 1 })
    expect(mcqAnswer('sw-5-c15')).toBe(`128×4 = ${romBits(7, 4)} ביטים`)
    expect(romBits(6, 4)).toBe(256)
    const chips = referenceChips(switchingWorld)
    expect(arrivalTimes(adderSubtractor(4), chips).V).toBe(550)
    expect(mcqAnswer('sw-5-c16')).toBe(`${arrivalTimes(adderSubtractor(8), chips).V} ns`)
    // c12: in FA from two HAs the two carries are never 1 together
    for (const a of [0, 1]) for (const b of [0, 1]) for (const c of [0, 1]) expect((a & b) & ((a ^ b) & c)).toBe(0)
  })
})
