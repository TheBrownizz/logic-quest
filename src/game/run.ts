import type { Card } from '../content/types'

export type RunState = { deck: Card[]; index: number; lives: number; multiplier: number; score: number; mistakes: string[]; done: boolean }

export const RUN_LENGTH = 10
export const MAX_LIVES = 3
export const MAX_MULTIPLIER = 5

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function startRun(cards: Card[], rng: () => number): RunState {
  const a = [...cards]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  const deck = a.slice(0, RUN_LENGTH)
  return { deck, index: 0, lives: MAX_LIVES, multiplier: 1, score: 0, mistakes: [], done: deck.length === 0 }
}

export function answer(s: RunState, correct: boolean): RunState {
  if (s.done) return s
  const index = s.index + 1
  if (correct) {
    return { ...s, index, score: s.score + 100 * s.multiplier, multiplier: Math.min(MAX_MULTIPLIER, s.multiplier + 1), done: index >= s.deck.length }
  }
  const lives = s.lives - 1
  return { ...s, index, lives, multiplier: 1, mistakes: [...s.mistakes, s.deck[s.index].id], done: lives <= 0 || index >= s.deck.length }
}
