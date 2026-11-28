import { describe, it, expect } from 'vitest'
import {
  QUIZ_COOLDOWN_MS, QUIZ_SIZE, drawQuiz, lessonDone, lessonStatus, lessonsForStage, quizCooldownLeft,
  recordQuizFail, recordQuizPass, recordStep, rememberOpenStages, stageRoomsOpen,
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

const of = (id: string) => (id === 's1' ? L : [])
const rs = (s: SaveData, l: Lesson, id: string) => recordStep(world, s, l, id, of)
const rqp = (s: SaveData, l: Lesson) => recordQuizPass(world, s, l, of)

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
    expect(s.lessons.l1).toEqual({ stepId: '', done: false, quizFailedAt: t0 })
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
    const s = rs(recordQuizFail(emptySave(), L[0], t0), L[0], 'end')
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
    const s = rqp(recordQuizFail(emptySave(), L[0], t0), L[0])
    expect(s.lessons.l1).toMatchObject({ stepId: 'a', done: true, skipped: true })
    expect(s.lessons.l1.quizFailedAt).toBeUndefined()
    expect(lessonStatus(s, 'l1')).toBe('skipped')
  })
  it('a pass after finishing keeps the status "done"', () => {
    const s = rqp(rs(emptySave(), L[0], 'end'), L[0])
    expect(lessonStatus(s, 'l1')).toBe('done')
  })
})

describe('recordStep', () => {
  it('saves the step id; the last step marks the lesson done', () => {
    const a = rs(emptySave(), L[0], 'a')
    expect(a.lessons.l1).toEqual({ stepId: 'a', done: false })
    const b = rs(a, L[0], 'end')
    expect(b.lessons.l1).toEqual({ stepId: 'end', done: true })
  })
  it('going back keeps done; finishing a skipped lesson makes it "done"', () => {
    const done = rs(rs(emptySave(), L[0], 'end'), L[0], 'a')
    expect(done.lessons.l1).toEqual({ stepId: 'a', done: true })
    const sk = rs(rqp(emptySave(), L[0]), L[0], 'end')
    expect(lessonStatus(sk, 'l1')).toBe('done')
  })
  it('returns the same save when nothing changes', () => {
    const a = rs(emptySave(), L[0], 'a')
    expect(rs(a, L[0], 'a')).toBe(a)
  })
})

describe('minor 3: taking the skip quiz does not start the lesson', () => {
  it('a failed quiz on an unopened lesson keeps it "new" (with the cooldown)', () => {
    const s = recordQuizFail(emptySave(), L[0], 1000)
    expect(lessonStatus(s, 'l1')).toBe('new')
    expect(quizCooldownLeft(s, 'l1', 1000)).toBe(QUIZ_COOLDOWN_MS)
    // opening the lesson afterwards starts it, and keeps the cooldown
    const t = rs(s, L[0], 'a')
    expect(lessonStatus(t, 'l1')).toBe('progress')
    expect(t.lessons.l1.quizFailedAt).toBe(1000)
  })
})

describe('openStages: the unlock is stored and permanent', () => {
  const done = (...ids: string[]) => withLessons(Object.fromEntries(ids.map(id => [id, { stepId: 'end', done: true }])))
  it('defaults to [] and drops bad entries on load', () => {
    expect(emptySave().openStages).toEqual([])
    const m: Record<string, string> = { 'logic-quest-save': JSON.stringify({ version: 1, openStages: ['s1', 5, null, 's1', 's2'] }) }
    const st = { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v } } as unknown as Storage
    expect(new LocalProgressStore(st).load().openStages).toEqual(['s1', 's2'])
    m['logic-quest-save'] = JSON.stringify({ version: 1, openStages: 'x' })
    expect(new LocalProgressStore(st).load().openStages).toEqual([])
  })
  it('finishing the last lesson of a stage records it', () => {
    const a = rs(done('l2'), L[0], 'a')
    expect(a.openStages).toEqual([])
    const b = rs(a, L[0], 'end')
    expect(b.openStages).toEqual(['s1'])
  })
  it('passing the skip quiz of the last lesson records it', () => {
    expect(rqp(done('l1'), L[1]).openStages).toEqual(['s1'])
    expect(rqp(emptySave(), L[1]).openStages).toEqual([])
  })
  it('a lesson added later does not relock a stage', () => {
    const save = rs(done('l2'), L[0], 'end')
    const more = [...L, lesson('l3')]
    expect(stageRoomsOpen(world, 's1', save, more)).toBe(true)
    // without the record the computed rule alone would lock it
    expect(stageRoomsOpen(world, 's1', { ...save, openStages: [] }, more)).toBe(false)
  })
  it('rememberOpenStages records stages whose lessons are all done (on load), and only those', () => {
    const save = done('l1', 'l2')
    const r = rememberOpenStages(world, save, of)
    expect(r.openStages).toEqual(['s1'])
    expect(rememberOpenStages(world, r, of)).toBe(r) // nothing new: same object
    // a stage open only because it has no lessons is not recorded (lessons may still come)
    expect(rememberOpenStages(world, withLessons({}, ['a', 'b']), of).openStages).toEqual([])
    // a stage that is itself still locked (60% rule) is not recorded
    const w2: World = { ...world, stages: [...world.stages, { id: 's3', order: 3, title: '', rooms: [], cards: [] }] }
    const of3 = (id: string) => (id === 's3' ? [lesson('l9', 's3')] : of(id))
    expect(rememberOpenStages(w2, done('l9'), of3).openStages).toEqual([])
  })
  it('a recorded stage still needs the stage itself open', () => {
    expect(stageRoomsOpen(world, 's2', { ...emptySave(), openStages: ['s2'] }, [])).toBe(false)
  })
})
