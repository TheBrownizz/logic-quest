import { describe, it, expect } from 'vitest'
import { stars, isStageUnlocked, roomsToUnlock } from '../../src/game/rules'
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

describe('roomsToUnlock', () => {
  it('counts the rooms still needed in the previous stage', () => {
    expect(roomsToUnlock(world, 's1', emptySave())).toBe(0)
    expect(roomsToUnlock(world, 's2', emptySave())).toBe(2)
    expect(roomsToUnlock(world, 's2', solved('c'))).toBe(1)
    expect(roomsToUnlock(world, 's2', solved('a', 'b'))).toBe(0)
    expect(roomsToUnlock(world, 's3', emptySave())).toBe(0)
  })
  it('matches the 60% rule for every stage size', () => {
    for (let n = 1; n <= 12; n++) {
      const ids = Array.from({ length: n }, (_, i) => `r${i}`)
      const w: World = { id: 'w', title: '', icon: '', stages: [
        { id: 'p', order: 1, title: '', rooms: ids.map(room), cards: [] },
        { id: 'q', order: 2, title: '', rooms: [], cards: [] },
      ] }
      for (let k = 0; k <= n; k++) {
        const save = solved(...ids.slice(0, k))
        const need = roomsToUnlock(w, 'q', save)
        expect(need === 0).toBe(isStageUnlocked(w, 'q', save))
        if (need > 0) expect(isStageUnlocked(w, 'q', solved(...ids.slice(0, k + need)))).toBe(true)
        if (need > 1) expect(isStageUnlocked(w, 'q', solved(...ids.slice(0, k + need - 1)))).toBe(false)
      }
    }
  })
})
