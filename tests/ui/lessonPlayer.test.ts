import { describe, it, expect } from 'vitest'
import { autoComplete, initPlayer, matchesAnswer, playerReducer, resumeIndex, type PlayerState } from '../../src/ui/lessons/player'
import type { Lesson } from '../../src/content/lessons/types'

const lesson: Lesson = {
  id: 'l', stage: 's', order: 1, title: '', minutes: 1, blurb: '', source: 'x', skipQuiz: [],
  steps: [
    { id: 'e1', kind: 'explain', text: 'x' },
    { id: 'c1', kind: 'check', prompt: '', options: ['a', 'b'], correct: 1, feedback: ['no', 'yes'] },
    { id: 'w1', kind: 'widget', prompt: '', widget: 'BaseDial', config: {} },
    { id: 'w2', kind: 'widget', prompt: '', widget: 'BaseDial', config: {}, goal: {}, example: {} },
    { id: 'r', kind: 'recap', points: ['p'] },
  ],
}
const run = (s: PlayerState, ...as: Parameters<typeof playerReducer>[1][]) => as.reduce(playerReducer, s)

describe('resumeIndex', () => {
  it('no save -> step 1', () => {
    expect(resumeIndex(lesson, undefined)).toBe(0)
  })
  it('resumes at the saved step', () => {
    expect(resumeIndex(lesson, { stepId: 'w1', done: false })).toBe(2)
  })
  it('Review Focus 1: a saved stepId that was removed from the lesson resumes at step 1', () => {
    expect(resumeIndex(lesson, { stepId: 'gone', done: false })).toBe(0)
    expect(() => initPlayer(lesson, resumeIndex(lesson, { stepId: 'gone', done: false }), false)).not.toThrow()
  })
  it('a requested step (URL) is honoured only up to the saved one, or anywhere in a done lesson', () => {
    expect(resumeIndex(lesson, { stepId: 'w1', done: false }, 'c1')).toBe(1)
    expect(resumeIndex(lesson, { stepId: 'c1', done: false }, 'r')).toBe(1)
    expect(resumeIndex(lesson, { stepId: 'c1', done: true }, 'r')).toBe(4)
    expect(resumeIndex(lesson, { stepId: 'c1', done: false }, 'nope')).toBe(1)
  })
  it('a done lesson opened without a step starts from the top', () => {
    expect(resumeIndex(lesson, { stepId: 'r', done: true })).toBe(0)
  })
})

describe('autoComplete', () => {
  it('explain, recap and goal-less widgets are complete on arrival', () => {
    expect(lesson.steps.map(autoComplete)).toEqual([true, false, true, false, true])
  })
})

describe('playerReducer', () => {
  it('starts with the steps before the resume point complete', () => {
    const s = initPlayer(lesson, 3, false)
    expect(s.index).toBe(3)
    expect(s.completed).toEqual([true, true, true, false, true])
  })
  it('a done lesson has every step complete', () => {
    expect(initPlayer(lesson, 0, true).completed.every(Boolean)).toBe(true)
  })
  it('"המשך" needs the current step complete', () => {
    const s = run(initPlayer(lesson, 1, false), { type: 'next', from: 1 })
    expect(s.index).toBe(1)
    expect(run(s, { type: 'complete', index: 1 }, { type: 'next', from: 1 }).index).toBe(2)
  })
  it('Review Focus 3: a double click on "המשך" advances exactly one step', () => {
    const s = run(initPlayer(lesson, 0, false), { type: 'next', from: 0 }, { type: 'next', from: 0 })
    expect(s.index).toBe(1)
  })
  it('Review Focus 3: answering a check twice, then double "המשך", advances one step', () => {
    const s0 = initPlayer(lesson, 1, false)
    const s = run(s0, { type: 'complete', index: 1 }, { type: 'complete', index: 1 }, { type: 'next', from: 1 }, { type: 'next', from: 1 })
    expect(s.index).toBe(2)
    expect(s.completed[2]).toBe(true)
    expect(s.completed[3]).toBe(false)
  })
  it('back and forward over completed steps is free', () => {
    let s = run(initPlayer(lesson, 1, false), { type: 'complete', index: 1 }, { type: 'next', from: 1 })
    s = run(s, { type: 'back', from: 2 }, { type: 'back', from: 1 })
    expect(s.index).toBe(0)
    s = run(s, { type: 'next', from: 0 }, { type: 'next', from: 1 })
    expect(s.index).toBe(2)
  })
  it('back on the first step and next on the last do nothing', () => {
    const a = initPlayer(lesson, 0, false)
    expect(run(a, { type: 'back', from: 0 })).toBe(a)
    const z = initPlayer(lesson, 4, true)
    expect(run(z, { type: 'next', from: 4 })).toBe(z)
  })
  it('goto reaches only steps whose predecessors are complete', () => {
    const s = initPlayer(lesson, 1, false)
    expect(run(s, { type: 'goto', index: 0 }).index).toBe(0)
    expect(run(s, { type: 'goto', index: 3 }).index).toBe(1)
    expect(run(s, { type: 'goto', index: 99 }).index).toBe(1)
  })
  it('complete is idempotent and returns the same state', () => {
    const s = initPlayer(lesson, 0, false)
    expect(run(s, { type: 'complete', index: 0 })).toBe(s)
  })
})

describe('matchesAnswer', () => {
  it('ignores spaces and case', () => {
    expect(matchesAnswer(' 1011 0101 ', '10110101')).toBe(true)
    expect(matchesAnswer('5ba', '5BA')).toBe(true)
    expect(matchesAnswer('5BB', '5BA')).toBe(false)
  })
  it('compares numeric answers by value', () => {
    expect(matchesAnswer('45.0', '45')).toBe(true)
    expect(matchesAnswer('+45', '45')).toBe(true)
    expect(matchesAnswer('0045', '45')).toBe(true)
    expect(matchesAnswer('-6.25', '−6.25')).toBe(true)
    expect(matchesAnswer('', '0')).toBe(false)
  })
  it('a binary string answer is not read as a decimal number', () => {
    expect(matchesAnswer('0101', '101')).toBe(false)
  })
})
