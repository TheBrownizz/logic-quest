import { describe, it, expect } from 'vitest'
import { startRun, answer, mulberry32 } from '../../src/game/run'
import type { Card } from '../../src/content/types'

const cards = (n: number): Card[] => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, kind: 'mcq', stage: 's', text: '', options: ['a','b','c','d','e','f'], correct: 0, knowledge: '', source: '' }) as Card)

describe('run', () => {
  it('10 cards or all, no repeats, seeded', () => {
    const a = startRun(cards(30), mulberry32(7)), b = startRun(cards(30), mulberry32(7))
    expect(a.deck).toHaveLength(10)
    expect(new Set(a.deck.map(c => c.id)).size).toBe(10)
    expect(a.deck.map(c => c.id)).toEqual(b.deck.map(c => c.id))
    expect(startRun(cards(4), mulberry32(1)).deck).toHaveLength(4)
    expect(a).toMatchObject({ index: 0, lives: 3, multiplier: 1, score: 0, mistakes: [], done: false })
  })
  it('scoring', () => {
    let s = startRun(cards(10), mulberry32(1))
    for (let i = 0; i < 3; i++) s = answer(s, true)
    expect(s.score).toBe(600); expect(s.multiplier).toBe(4)
  })
  it('multiplier caps at 5', () => {
    let s = startRun(cards(10), mulberry32(1))
    for (let i = 0; i < 7; i++) s = answer(s, true)
    expect(s.multiplier).toBe(5); expect(s.score).toBe(100+200+300+400+500+500+500)
  })
  it('mistake', () => {
    let s = startRun(cards(10), mulberry32(1))
    s = answer(s, true); const id = s.deck[s.index].id; s = answer(s, false)
    expect(s.lives).toBe(2); expect(s.multiplier).toBe(1); expect(s.mistakes).toEqual([id]); expect(s.score).toBe(100)
  })
  it('done on 3 mistakes, deck end; unchanged after', () => {
    let s = startRun(cards(10), mulberry32(1))
    for (let i = 0; i < 3; i++) s = answer(s, false)
    expect(s.done).toBe(true); expect(answer(s, true)).toBe(s)
    let t = startRun(cards(2), mulberry32(1)); t = answer(answer(t, true), true)
    expect(t.done).toBe(true)
  })
  it('does not mutate input', () => {
    const input = cards(30), ids = input.map(c => c.id)
    startRun(input, mulberry32(3))
    expect(input.map(c => c.id)).toEqual(ids)
  })
  it('empty deck is done', () => {
    expect(startRun([], mulberry32(1))).toMatchObject({ deck: [], done: true })
  })
})
