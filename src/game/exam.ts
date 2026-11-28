import type { ExamQuestion, ExamTopic, World } from '../content/types'
import { MAX_EXAM_ATTEMPTS, type ExamAttempt, type SaveData } from './progress'
import { UNLOCK_SHARE } from './rules'
import { mulberry32 } from './run'

/** The mock exam (spec 6.5, 6.7.2): composition, scoring, the boss lock and saved attempts. Pure. */

export type ExamMode = 'full' | 'short'
export const EXAM_MINUTES: Record<ExamMode, number> = { full: 150, short: 60 }
/** "מוכן למבחן" from this score. It opens nothing. */
export const READY_SCORE = 80
export const MAX_ATTEMPTS = MAX_EXAM_ATTEMPTS
export const POINTS = { a: 10, verdict: 5, reason: 5, c: 5 } as const
export const QUESTION_POINTS = POINTS.a + POINTS.verdict + POINTS.reason + POINTS.c

export interface Exam {
  mode: ExamMode
  seed: number
  minutes: number
  /** In topic order. */
  questions: ExamQuestion[]
  /** For each question, the MCQ option indices in the order shown. */
  order: number[][]
}

/**
 * What the player answered in one question. `a`: part א's current answer earns its points (graded live by the
 * puzzle, see PuzzleHost.grade; needs the optimum when partANeedsOptimal); `aAnswered`: something was entered.
 * `choice` is an option index of `c.options` (not a shown position).
 */
export interface PartAnswers { a: boolean; aAnswered: boolean; verdict: boolean | null; reason: number | null; choice: number | null }
export const emptyAnswers = (): PartAnswers => ({ a: false, aAnswered: false, verdict: null, reason: null, choice: null })

/** Whether part א needs the optimum (Review I2): `aNeedsOptimal`, by default true for kmap and fsm-equations. */
export const partANeedsOptimal = (q: ExamQuestion): boolean => q.aNeedsOptimal ?? (q.a.type === 'kmap' || q.a.type === 'fsm-equations')

/** Part א's points flag from the puzzle's live grade. */
export const partAEarned = (q: ExamQuestion, ok: boolean, optimal: boolean): boolean => (partANeedsOptimal(q) ? ok && optimal : ok)

function shuffle<T>(a: T[], rng: () => number): T[] {
  const out = [...a]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * One question per topic, picked by `seed`. Full: topics 1–4, 150 minutes. Short: one random topic of 1–3 and
 * topic 4, 60 minutes. A topic with no question in the bank is skipped.
 */
export function buildExam(bank: ExamQuestion[], mode: ExamMode, seed: number): Exam {
  const rng = mulberry32(seed)
  const byTopic = (t: ExamTopic) => bank.filter(q => q.topic === t)
  const pick = (t: ExamTopic): ExamQuestion | undefined => { const qs = byTopic(t); return qs.length ? qs[Math.floor(rng() * qs.length)] : undefined }
  let topics: ExamTopic[] = [1, 2, 3, 4]
  if (mode === 'short') {
    const others = ([1, 2, 3] as ExamTopic[]).filter(t => byTopic(t).length > 0)
    topics = [...(others.length ? [others[Math.floor(rng() * others.length)]] : []), 4]
  }
  const questions = topics.map(pick).filter((q): q is ExamQuestion => q !== undefined)
  return { mode, seed, minutes: EXAM_MINUTES[mode], questions, order: questions.map(q => shuffle(q.c.options.map((_, i) => i), rng)) }
}

export interface QuestionScore { id: string; topic: ExamTopic; a: number; verdict: number; reason: number; c: number; total: number }
export interface ExamScore {
  /** Out of 100 (a short exam is scaled). */
  score: number
  raw: number
  max: number
  /** Points of topics 1–4 out of 25; -1 for a topic not asked. */
  perTopic: number[]
  questions: QuestionScore[]
}

/** א' 10 all or nothing; ב' 5 for the verdict and 5 for the reason (only with the right verdict); ג' 5. */
export function scoreQuestion(q: ExamQuestion, ans: PartAnswers): QuestionScore {
  const a = ans.a ? POINTS.a : 0
  const verdictOk = ans.verdict !== null && ans.verdict === q.b.isTrue
  const verdict = verdictOk ? POINTS.verdict : 0
  const reason = verdictOk && ans.reason === q.b.correctReason ? POINTS.reason : 0
  const c = ans.choice === q.c.correct ? POINTS.c : 0
  return { id: q.id, topic: q.topic, a, verdict, reason, c, total: a + verdict + reason + c }
}

/** The exam's score from the answers so far (unanswered parts score 0). */
export function scoreExam(exam: Exam, answers: PartAnswers[]): ExamScore {
  const questions = exam.questions.map((q, i) => scoreQuestion(q, answers[i] ?? emptyAnswers()))
  const raw = questions.reduce((s, q) => s + q.total, 0)
  const max = exam.questions.length * QUESTION_POINTS
  const perTopic = [-1, -1, -1, -1]
  for (const q of questions) perTopic[q.topic - 1] = q.total
  return { score: max ? Math.round((raw / max) * 100) : 0, raw, max, perTopic, questions }
}

/** Rooms of the last stage still to solve before the boss opens (the 60% rule); 0 = open. No lessons gate it. */
export function bossLocked(world: World, save: SaveData): number {
  const last = [...world.stages].sort((a, b) => b.order - a.order)[0]
  if (!last || last.rooms.length === 0) return 0
  const solved = last.rooms.filter(r => save.rooms[r.id]?.solved).length
  let need = 0
  while ((solved + need) / last.rooms.length < UNLOCK_SHARE) need++
  return need
}

/** Adds a finished attempt, keeping the last MAX_ATTEMPTS. */
export function recordExam(save: SaveData, attempt: ExamAttempt): SaveData {
  const attempts = [...save.exams.attempts.filter(a => a.at !== attempt.at), attempt].sort((a, b) => a.at - b.at).slice(-MAX_ATTEMPTS)
  return { ...save, exams: { attempts } }
}

/** The best score so far, or undefined before the first attempt. */
export function bestExam(save: SaveData): number | undefined {
  return save.exams.attempts.length ? Math.max(...save.exams.attempts.map(a => a.score)) : undefined
}
