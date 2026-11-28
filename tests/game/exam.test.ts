import { describe, it, expect } from 'vitest'
import {
  EXAM_MINUTES, MAX_ATTEMPTS, partAEarned, partANeedsOptimal, READY_SCORE, bestExam, bossLocked, buildExam, emptyAnswers, recordExam, scoreExam, type PartAnswers,
} from '../../src/game/exam'
import { emptySave, LocalProgressStore, SAVE_KEY } from '../../src/game/progress'
import { switchingWorld } from '../../src/content/switching/world'
import type { ExamQuestion } from '../../src/content/types'

const bank = switchingWorld.boss!.bank
const right = (q: ExamQuestion): PartAnswers => ({ a: true, aAnswered: true, verdict: q.b.isTrue, reason: q.b.correctReason, choice: q.c.correct })

class MemStorage {
  m = new Map<string, string>()
  getItem(k: string) { return this.m.get(k) ?? null }
  setItem(k: string, v: string) { this.m.set(k, v) }
  removeItem(k: string) { this.m.delete(k) }
}

describe('buildExam', () => {
  it('full: one question per topic, in topic order, 150 minutes', () => {
    const e = buildExam(bank, 'full', 42)
    expect(e.questions.map(q => q.topic)).toEqual([1, 2, 3, 4])
    expect(e.minutes).toBe(EXAM_MINUTES.full)
    expect(e.minutes).toBe(150)
  })
  it('short: topic 4 plus one other topic, 60 minutes; the seed decides', () => {
    const topics = new Set<number>()
    for (let seed = 1; seed < 40; seed++) {
      const e = buildExam(bank, 'short', seed)
      expect(e.questions).toHaveLength(2)
      expect(e.questions[1].topic).toBe(4)
      expect(e.minutes).toBe(60)
      topics.add(e.questions[0].topic)
    }
    expect([...topics].sort()).toEqual([1, 2, 3])
    expect(buildExam(bank, 'short', 7)).toEqual(buildExam(bank, 'short', 7))
  })
  it('the MCQ options are shuffled by the seed; `order` maps shown positions to option indices', () => {
    const e = buildExam(bank, 'full', 3)
    for (const o of e.order) expect([...o].sort()).toEqual([0, 1, 2, 3, 4, 5])
  })
})

describe('scoreExam', () => {
  it('all right is 100; scoring is א 10, ב 5 + 5, ג 5', () => {
    const e = buildExam(bank, 'full', 1)
    expect(scoreExam(e, e.questions.map(right)).score).toBe(100)
    const ans = e.questions.map(right)
    ans[0] = { ...ans[0], a: false }
    ans[1] = { ...ans[1], reason: (ans[1].reason! + 1) % 3 }
    ans[2] = { ...ans[2], choice: (ans[2].choice! + 1) % 6 }
    const s = scoreExam(e, ans)
    expect(s.score).toBe(80)
    expect(s.perTopic).toEqual([15, 20, 20, 25])
    expect(s.questions[0]).toMatchObject({ a: 0, verdict: 5, reason: 5, c: 5, total: 15 })
  })
  it('the reason counts only with the right verdict', () => {
    const e = buildExam(bank, 'full', 1)
    const ans = e.questions.map(right)
    ans[3] = { ...ans[3], verdict: !ans[3].verdict }
    expect(scoreExam(e, ans).questions[3]).toMatchObject({ verdict: 0, reason: 0, total: 15 })
  })
  it('Review Focus 4: unanswered parts score 0, so a time-out scores what was answered so far', () => {
    const e = buildExam(bank, 'full', 1)
    const ans = e.questions.map(() => emptyAnswers())
    ans[0] = right(e.questions[0])
    expect(scoreExam(e, ans).score).toBe(25)
  })
  it('short mode is scaled to 100; topics not asked are -1', () => {
    const e = buildExam(bank, 'short', 5)
    const ans = e.questions.map(right)
    ans[0] = emptyAnswers()
    const s = scoreExam(e, ans)
    expect(s.score).toBe(50)
    expect(s.perTopic[3]).toBe(25)
    expect(s.perTopic.filter(x => x === -1)).toHaveLength(2)
  })
})

describe('Review I2: part א needs the optimum for kmap and fsm-equations', () => {
  it('defaults by puzzle type, and aNeedsOptimal overrides', () => {
    const kmap = bank.find(q => q.a.type === 'kmap')!
    const num = bank.find(q => q.a.type === 'number')!
    expect(partANeedsOptimal(kmap)).toBe(true)
    expect(partANeedsOptimal(num)).toBe(false)
    expect(partAEarned(kmap, true, false)).toBe(false)
    expect(partAEarned(kmap, true, true)).toBe(true)
    expect(partAEarned({ ...kmap, aNeedsOptimal: false }, true, false)).toBe(true)
    expect(partAEarned({ ...num, aNeedsOptimal: true }, true, false)).toBe(false)
    expect(partANeedsOptimal({ ...kmap, a: { type: 'fsm-equations', show: 'table', machine: { from: 'rows', stateVars: ['A'], inputs: ['X'], outputs: [], next: [[0, 1], [1, 0]], out: [[0, 0], [0, 0]] } } })).toBe(true)
  })
})

describe('boss lock and saved attempts', () => {
  it('the boss opens by the 60% rule on the last stage', () => {
    const save = emptySave()
    expect(bossLocked(switchingWorld, save)).toBeGreaterThan(0)
    const last = [...switchingWorld.stages].sort((a, b) => b.order - a.order)[0]
    for (const r of last.rooms) save.rooms[r.id] = { solved: true, optimal: false, noHints: false }
    expect(bossLocked(switchingWorld, save)).toBe(0)
  })
  it('recordExam keeps the last 20 attempts; bestExam is the highest; READY at 80', () => {
    let s = emptySave()
    expect(bestExam(s)).toBeUndefined()
    for (let i = 0; i < 25; i++) s = recordExam(s, { at: 1000 + i, score: i, perTopic: [i, -1, -1, 0], mode: 'short' })
    expect(s.exams.attempts).toHaveLength(MAX_ATTEMPTS)
    expect(s.exams.attempts[0].at).toBe(1005)
    expect(bestExam(s)).toBe(24)
    expect(READY_SCORE).toBe(80)
  })
  it('a save without exams loads with { attempts: [] }; bad attempts are dropped, the rest sorted and capped', () => {
    const st = new MemStorage()
    const store = new LocalProgressStore(st as unknown as Storage)
    st.setItem(SAVE_KEY, JSON.stringify({ version: 1, rooms: {}, chips: {}, drafts: {}, knowledge: [], bestRun: {}, flagged: [] }))
    expect(store.load().exams).toEqual({ attempts: [] })
    const attempts = [
      { at: 5, score: 90, perTopic: [25, 25, 15, 25] },
      { at: 2, score: 40, perTopic: [10, -1, -1, 10], mode: 'short' },
      { at: 'x', score: 1, perTopic: [] },
      { at: 3, score: 200, perTopic: [1, 1, 1, 1] },
      { at: 4, score: 50, perTopic: 'no' },
    ]
    st.setItem(SAVE_KEY, JSON.stringify({ version: 1, rooms: {}, chips: {}, drafts: {}, knowledge: [], bestRun: {}, flagged: [], exams: { attempts } }))
    expect(store.load().exams.attempts.map(a => a.at)).toEqual([2, 5])
    st.setItem(SAVE_KEY, JSON.stringify({ version: 1, rooms: {}, chips: {}, drafts: {}, knowledge: [], bestRun: {}, flagged: [], exams: 'oops' }))
    expect(store.load().exams).toEqual({ attempts: [] })
  })
})

describe('exam clock', () => {
  it('shows minutes:seconds, minutes past 59, never negative', async () => {
    const { clock } = await import('../../src/ui/exam/examText')
    expect(clock(150 * 60_000)).toBe('150:00')
    expect(clock(60 * 60_000)).toBe('60:00')
    expect(clock(61_500)).toBe('01:02')
    expect(clock(-5)).toBe('00:00')
  })
})
