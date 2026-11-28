import { describe, it, expect } from 'vitest'
import { expectBossValid, expectStageValid } from './stageTestUtils'
import { switchingWorld } from '../../src/content/switching/world'
import { tableOf, waveAnswer, designFunctions, varsOf, minLiterals } from '../../src/ui/lab/seqLogic'
import { reduceStates } from '../../src/logic/fsm'
import type { LabPuzzle } from '../../src/content/types'

type P<T extends LabPuzzle['type']> = Extract<LabPuzzle, { type: T }>
const room = (id: string) => switchingWorld.stages.flatMap(s => s.rooms).find(r => r.id === id)!

describe('stages 6–8 shells (Task 2) and the boss sample bank', () => {
  it('the three stages follow stage 5 with the agreed ids, and the boss is sw-boss', () => {
    expect(switchingWorld.stages.map(s => [s.id, s.order]).slice(5)).toEqual([['sw-6-latches', 6], ['sw-7-fsm', 7], ['sw-8-design', 8]])
    expect(switchingWorld.boss?.id).toBe('sw-boss')
  })
  it.each(['sw-6-latches', 'sw-7-fsm', 'sw-8-design'])('%s is valid (as a shell)', id => {
    expectStageValid(id, { shell: true })
  })
  it('the boss bank is valid with one question per topic at least', () => {
    expectBossValid({ shell: true })
  })
  it('sample answers, re-derived', () => {
    // edges at columns 1, 5, 9 sample columns 0, 4, 8: J=K=1 toggles to 1, J=K=1 toggles to 0, J=1 K=0 sets
    expect(waveAnswer(room('sw-6-r1').puzzle as P<'waveform'>)).toEqual([0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1])
    expect((room('sw-6-r2').puzzle as P<'identify'>).options[(room('sw-6-r2').puzzle as P<'identify'>).correct]).toMatch(/^D Latch/)
    const t7 = tableOf((room('sw-7-r1').puzzle as P<'state-table'>).machine)
    // A+ = B'X + AB, B+ = A'X + BX', Y = AX — rows (A B X): next and Y
    expect(t7.rows.map(r => [r.next, r.out])).toEqual([[0, 0], [3, 0], [1, 0], [1, 0], [0, 0], [2, 1], [3, 0], [2, 1]])
    const t8 = tableOf((room('sw-8-r1').puzzle as P<'fsm-equations'>).machine)
    expect(minLiterals(designFunctions(t8, 'D'), varsOf(t8).length)).toBe(10)
    expect(reduceStates(tableOf((room('sw-8-r2').puzzle as P<'state-reduce'>).machine))).toEqual([[0], [1, 3], [2, 4]])
  })
})
