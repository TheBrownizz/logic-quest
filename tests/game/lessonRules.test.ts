import { describe, it, expect } from 'vitest'
import {
  QUIZ_COOLDOWN_MS, QUIZ_SIZE, drawQuiz, lessonDone, lessonStatus, lessonsForStage, quizCooldownLeft,
  recordQuizFail, recordQuizPass, recordStep, stageRoomsOpen,
} from '../../src/game/lessonRules'
import { LocalProgressStore, emptySave, type SaveData } from '../../src/game/progress'
import { mulberry32 } from '../../src/game/run'
import type { Lesson, SkipQuestion } from '../../src/content/lessons/types'
import type { World } from '../../src/content/types'
import { switchingWorld } from '../../src/content/switching/world'

const room = (id: string) => ({ id }) as never
const world: World = { id: 'w', title: 'w', icon: '', stages: [
  { id: 's1', order: 1, title: '', rooms: [room('a'), room('b'), room('c')], cards: [] },
  { id: 's2', order: 2, title: '', rooms: [room('d')], cards: [] },
] }
const lesson = (id: string, stage = 's1'): Lesson => ({
  id, stage, order: 1, title: id, minutes: 5, blurb: '', source: 'x',
  steps: [{ id: 'a', kind: 'explain', text: 'x' }, { id: 'end', kind: 'recap', points: ['p'] }], skipQuiz: [],
})
const L = [lesson('l1'), lesson('l2')]
const withLessons = (lessons: SaveData['lessons'], rooms: string[] = []): SaveData => ({
  ...emptySave(), lessons,
  rooms: Object.fromEntries(rooms.map(r => [r, { solved: true, optimal: false, noHints: false }])),
})

describe('lessonDone / lessonStatus', () => {
  it('done when the entry says so (end reached or quiz passed)', () => {
    expect(lessonDone(emptySave(), 'l1')).toBe(false)
    expect(lessonDone(withLessons({ l1: { stepId: 'a', done: false } }), 'l1')).toBe(false)
    expect(lessonDone(withLessons({ l1: { stepId: 'end', done: true } }), 'l1')).toBe(true)
    expect(lessonDone(withLessons({ l1: { stepId: 'a', done: true, skipped: true } }), 'l1')).toBe(true)
  })
  it('status: new, progress, done, skipped', () => {
    expect(lessonStatus(emptySave(), 'l1')).toBe('new')
    expect(lessonStatus(withLessons({ l1: { stepId: 'a', done: false } }), 'l1')).toBe('progress')
    expect(lessonStatus(withLessons({ l1: { stepId: 'end', done: true } }), 'l1')).toBe('done')
    expect(lessonStatus(withLessons({ l1: { stepId: 'a', done: true, skipped: true } }), 'l1')).toBe('skipped')
  })
})

describe('stageRoomsOpen', () => {
  it('locked until every lesson of the stage is done', () => {
    expect(stageRoomsOpen(world, 's1', emptySave(), L)).toBe(false)
    expect(stageRoomsOpen(world, 's1', withLessons({ l1: { stepId: 'end', done: true } }), L)).toBe(false)
    expect(stageRoomsOpen(world, 's1', withLessons({ l1: { stepId: 'end', done: true }, l2: { stepId: 'a', done: true, skipped: true } }), L)).toBe(true)
  })
  it('a stage without lessons is open', () => {
    expect(stageRoomsOpen(world, 's1', emptySave(), [])).toBe(true)
  })
  it('Review Focus 2: a v1 save with a solved room and no lessons field keeps the stage open', () => {
    const raw = JSON.stringify({ version: 1, rooms: { a: { solved: true, optimal: false, noHints: true } } })
    const m: Record<string, string> = { 'logic-quest-save': raw }
    const st = { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v } } as unknown as Storage
    const save = new LocalProgressStore(st).load()
    expect(save.lessons).toEqual({})
    expect(stageRoomsOpen(world, 's1', save, L)).toBe(true)
  })
  it('an unsolved room entry does not open it', () => {
    const save = { ...emptySave(), rooms: { a: { solved: false, optimal: false, noHints: false } } }
    expect(stageRoomsOpen(world, 's1', save, L)).toBe(false)
  })
  it('the 60% stage rule still applies first', () => {
    expect(stageRoomsOpen(world, 's2', emptySave(), [])).toBe(false)
    expect(stageRoomsOpen(world, 's2', withLessons({}, ['a', 'b']), [])).toBe(true)
    expect(stageRoomsOpen(world, 'nope', emptySave(), [])).toBe(false)
  })
  it('defaults to the real lessons of the stage', () => {
    const s1 = lessonsForStage('sw-1-numbers')
    expect(s1.length).toBeGreaterThan(0)
    expect(stageRoomsOpen(switchingWorld, 'sw-1-numbers', emptySave())).toBe(false)
    const done = withLessons(Object.fromEntries(s1.map(l => [l.id, { stepId: l.steps[0].id, done: true }])))
    expect(stageRoomsOpen(switchingWorld, 'sw-1-numbers', done)).toBe(true)
  })
  it('lessonsForStage sorts by order; unknown stage -> []', () => {
    expect(lessonsForStage('nope')).toEqual([])
    const ls = lessonsForStage('sw-1-numbers')
    expect(ls.map(l => l.order)).toEqual([...ls.map(l => l.order)].sort((a, b) => a - b))
  })
})

describe('drawQuiz', () => {
  const pool: SkipQuestion[] = Array.from({ length: 7 }, (_, i) => ({ id: `q${i}`, prompt: `${i}`, options: ['a', 'b'], correct: 0 }))
  it(`draws ${QUIZ_SIZE} distinct questions from the pool`, () => {
    for (let seed = 1; seed < 40; seed++) {
      const q = drawQuiz(pool, mulberry32(seed))
      expect(q).toHaveLength(4)
      expect(new Set(q.map(x => x.id)).size).toBe(4)
      for (const x of q) expect(pool).toContain(x)
    }
  })
  it('is deterministic for a seeded rng and does not change the pool', () => {
    const copy = [...pool]
    expect(drawQuiz(pool, mulberry32(5))).toEqual(drawQuiz(pool, mulberry32(5)))
    expect(pool).toEqual(copy)
  })
  it('a pool smaller than 4 gives all of it', () => {
    expect(drawQuiz(pool.slice(0, 3), mulberry32(1))).toHaveLength(3)
  })
  it('different seeds reach different questions', () => {
    const seen = new Set<string>()
    for (let seed = 1; seed < 40; seed++) drawQuiz(pool, mulberry32(seed)).forEach(q => seen.add(q.id))
    expect(seen.size).toBe(7)
  })
})

describe('skip quiz pass, fail and cooldown', () => {
  const t0 = 1_700_000_000_000
  it('no entry or no failure -> 0', () => {
    expect(quizCooldownLeft(emptySave(), 'l1', t0)).toBe(0)
    expect(quizCooldownLeft(withLessons({ l1: { stepId: 'a', done: false } }), 'l1', t0)).toBe(0)
  })
  it('a failure blocks for 10 minutes', () => {
    expect(QUIZ_COOLDOWN_MS).toBe(10 * 60 * 1000)
    const s = recordQuizFail(emptySave(), L[0], t0)
    expect(s.lessons.l1).toEqual({ stepId: 'a', done: false, quizFailedAt: t0 })
    expect(quizCooldownLeft(s, 'l1', t0)).toBe(QUIZ_COOLDOWN_MS)
    expect(quizCooldownLeft(s, 'l1', t0 + 60_000)).toBe(QUIZ_COOLDOWN_MS - 60_000)
    expect(quizCooldownLeft(s, 'l1', t0 + QUIZ_COOLDOWN_MS)).toBe(0)
    // a clock set back can't make the wait longer than the cooldown
    expect(quizCooldownLeft(s, 'l1', t0 - 999_999)).toBe(QUIZ_COOLDOWN_MS)
  })
  it('a failure keeps the step reached', () => {
    const s = recordQuizFail(withLessons({ l1: { stepId: 'end', done: false } }), L[0], t0)
    expect(s.lessons.l1.stepId).toBe('end')
  })
  it('finishing the lesson lifts the cooldown', () => {
    const s = recordStep(recordQuizFail(emptySave(), L[0], t0), L[0], 'end')
    expect(s.lessons.l1.done).toBe(true)
    expect(quizCooldownLeft(s, 'l1', t0)).toBe(0)
  })
  it('Review Focus 5: the cooldown survives a reload (persisted through quizFailedAt)', () => {
    const m: Record<string, string> = {}
    const st = { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v } } as unknown as Storage
    new LocalProgressStore(st).save(recordQuizFail(emptySave(), L[0], t0))
    const again = new LocalProgressStore(st).load()
    expect(again.lessons.l1.quizFailedAt).toBe(t0)
    expect(quizCooldownLeft(again, 'l1', t0 + 1000)).toBe(QUIZ_COOLDOWN_MS - 1000)
  })
  it('a pass marks the lesson done and skipped, and clears the failure', () => {
    const s = recordQuizPass(recordQuizFail(emptySave(), L[0], t0), L[0])
    expect(s.lessons.l1).toEqual({ stepId: 'a', done: true, skipped: true })
    expect(lessonStatus(s, 'l1')).toBe('skipped')
  })
  it('a pass after finishing keeps the status "done"', () => {
    const s = recordQuizPass(recordStep(emptySave(), L[0], 'end'), L[0])
    expect(lessonStatus(s, 'l1')).toBe('done')
  })
})

describe('recordStep', () => {
  it('saves the step id; the last step marks the lesson done', () => {
    const a = recordStep(emptySave(), L[0], 'a')
    expect(a.lessons.l1).toEqual({ stepId: 'a', done: false })
    const b = recordStep(a, L[0], 'end')
    expect(b.lessons.l1).toEqual({ stepId: 'end', done: true })
  })
  it('going back keeps done; finishing a skipped lesson makes it "done"', () => {
    const done = recordStep(recordStep(emptySave(), L[0], 'end'), L[0], 'a')
    expect(done.lessons.l1).toEqual({ stepId: 'a', done: true })
    const sk = recordStep(recordQuizPass(emptySave(), L[0]), L[0], 'end')
    expect(lessonStatus(sk, 'l1')).toBe('done')
  })
  it('returns the same save when nothing changes', () => {
    const a = recordStep(emptySave(), L[0], 'a')
    expect(recordStep(a, L[0], 'a')).toBe(a)
  })
})
