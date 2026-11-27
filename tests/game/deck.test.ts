import { describe, it, expect } from 'vitest'
import { buildDeck } from '../../src/game/deck'
import { switchingWorld } from '../../src/content/switching/world'
import { emptySave } from '../../src/game/progress'

const solved = (...ids: string[]) => {
  const s = emptySave()
  for (const id of ids) s.rooms[id] = { solved: true, optimal: false, noHints: false }
  return s
}
const roomsOf = (stageId: string) => switchingWorld.stages.find(s => s.id === stageId)!.rooms.map(r => r.id)
const stageIds = (cards: { stage: string }[]) => [...new Set(cards.map(c => c.stage))].sort()

describe('buildDeck', () => {
  it('stage 1 draws only from stage 1', () => {
    expect(stageIds(buildDeck(switchingWorld, 'sw-1-numbers', emptySave())!)).toEqual(['sw-1-numbers'])
  })
  it('draws from all unlocked stages up to the run stage', () => {
    const d = buildDeck(switchingWorld, 'sw-3-boolean', solved(...roomsOf('sw-1-numbers'), ...roomsOf('sw-2-arith')))!
    expect(stageIds(d)).toEqual(['sw-1-numbers', 'sw-2-arith', 'sw-3-boolean'])
  })
  it('returns null for locked or unknown stages', () => {
    expect(buildDeck(switchingWorld, 'sw-2-arith', emptySave())).toBeNull()
    expect(buildDeck(switchingWorld, 'nope', emptySave())).toBeNull()
  })
  it('skips a locked middle stage', () => {
    const d = buildDeck(switchingWorld, 'sw-3-boolean', solved(...roomsOf('sw-2-arith')))!
    expect(stageIds(d)).toEqual(['sw-1-numbers', 'sw-3-boolean'])
  })
})
