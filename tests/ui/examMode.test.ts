import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { PuzzleView } from '../../src/ui/lab/PuzzleView'
import { SaveProvider } from '../../src/ui/save'
import { LocalProgressStore } from '../../src/game/progress'
import { switchingWorld } from '../../src/content/switching/world'
import type { LabPuzzle } from '../../src/content/types'
import type { PuzzleHost } from '../../src/ui/lab/roomParts'

const KINDS: LabPuzzle['type'][] = ['circuit', 'kmap', 'number', 'delay', 'code', 'state-table', 'fsm-equations', 'waveform', 'state-reduce', 'identify']
const puzzleOf = (type: LabPuzzle['type']) => switchingWorld.stages.flatMap(s => s.rooms).find(r => r.puzzle.type === type)!.puzzle
const host = (exam: boolean): PuzzleHost => ({ hints: [{ text: 'רמז' }], helped: false, markHelped: () => {}, solve: () => undefined, stars: false, onRestart: () => {}, exam, grade: () => {} })
const render = (p: LabPuzzle, exam: boolean) => {
  const store = new LocalProgressStore({ getItem: () => null, setItem: () => {}, removeItem: () => {} } as unknown as Storage)
  return renderToString(createElement(SaveProvider, { store, children: createElement(PuzzleView, { host: host(exam), puzzle: p, world: switchingWorld }) }))
}

describe('Review I1: every puzzle kind in exam mode', () => {
  it.each(KINDS)('%s: no "בדוק", the auto-save note instead; outside the exam "בדוק" is there', type => {
    const p = puzzleOf(type)
    const exam = render(p, true)
    expect(exam).not.toContain('>בדוק<')
    expect(exam).toContain('data-testid="exam-save-note"')
    expect(exam).not.toContain('מפת קרנו')
    expect(render(p, false)).toContain('>בדוק<')
  })
})
