import { describe, it, expect } from 'vitest'
import { stars, isStageUnlocked } from '../../src/game/rules'
import { emptySave } from '../../src/game/progress'
import type { World } from '../../src/content/types'

const room = (id: string) => ({ id }) as never
const world: World = { id: 'w', title: 'w', icon: '', stages: [
  { id: 's2', order: 2, title: '', rooms: [], cards: [] },
  { id: 's1', order: 1, title: '', rooms: [room('a'), room('b'), room('c')], cards: [] },
  { id: 's3', order: 3, title: '', rooms: [room('d')], cards: [] },
] }
const solved = (...ids: string[]) => ({ ...emptySave(), rooms: Object.fromEntries(ids.map(i => [i, { solved: true, optimal: false, noHints: false }])) })

describe('stars', () => {
  it('counts flags', () => {
    expect(stars({ solved: true, optimal: true, noHints: false })).toBe(2)
    expect(stars({ solved: true, optimal: true, noHints: true })).toBe(3)
    expect(stars({ solved: true, optimal: false, noHints: false })).toBe(1)
    expect(stars({ solved: false, optimal: true, noHints: true })).toBe(0)
    expect(stars(undefined)).toBe(0)
  })
})
describe('isStageUnlocked', () => {
  it('first always; 60% threshold', () => {
    expect(isStageUnlocked(world, 's1', emptySave())).toBe(true)
    expect(isStageUnlocked(world, 's2', solved('a'))).toBe(false)
    expect(isStageUnlocked(world, 's2', solved('a', 'b'))).toBe(true)
  })
  it('empty previous stage counts as 100%; unknown stage locked', () => {
    expect(isStageUnlocked(world, 's3', emptySave())).toBe(true)
    expect(isStageUnlocked(world, 'nope', emptySave())).toBe(false)
  })
})
