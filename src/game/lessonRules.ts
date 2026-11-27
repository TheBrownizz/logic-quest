import type { Lesson, SkipQuestion } from '../content/lessons/types'
import { lessonsForStage } from '../content/lessons/catalog'
import type { World } from '../content/types'
import type { LessonProgress, SaveData } from './progress'
import { isStageUnlocked } from './rules'

export { lessonsForStage }

/** Questions a skip quiz asks. */
export const QUIZ_SIZE = 4
/** After a failed skip quiz, the wait before another try (unless the lesson is finished first). */
export const QUIZ_COOLDOWN_MS = 10 * 60 * 1000

export type LessonStatus = 'new' | 'progress' | 'done' | 'skipped'

/** Done = the end was reached or the skip quiz passed. */
export function lessonDone(save: SaveData, lessonId: string): boolean {
  return save.lessons[lessonId]?.done === true
}

/** חדש / בתהליך / הושלם / דולג */
export function lessonStatus(save: SaveData, lessonId: string): LessonStatus {
  const e = save.lessons[lessonId]
  if (!e) return 'new'
  if (!e.done) return 'progress'
  return e.skipped ? 'skipped' : 'done'
}

/**
 * Whether a stage's rooms and run are open: the stage itself is open (the 60% rule), and either every one of
 * its lessons is done or at least one of its rooms is already solved (v1 saves stay open). Both conditions only
 * ever become true, so an unlock is permanent. A stage without lessons is open.
 */
export function stageRoomsOpen(world: World, stageId: string, save: SaveData, lessons: Lesson[] = lessonsForStage(stageId)): boolean {
  const stage = world.stages.find(s => s.id === stageId)
  if (!stage || !isStageUnlocked(world, stageId, save)) return false
  if (stage.rooms.some(r => save.rooms[r.id]?.solved)) return true
  return lessons.every(l => lessonDone(save, l.id))
}

/** QUIZ_SIZE distinct questions of `pool`, in random order (all of it when the pool is smaller). */
export function drawQuiz(pool: SkipQuestion[], rng: () => number): SkipQuestion[] {
  const a = [...pool]
  const n = Math.min(QUIZ_SIZE, a.length)
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (a.length - i))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, n)
}

/** Milliseconds until the skip quiz may be tried again; 0 = allowed (never failed, cooldown over, or lesson done). */
export function quizCooldownLeft(save: SaveData, lessonId: string, now: number): number {
  const e = save.lessons[lessonId]
  if (!e || e.done || e.quizFailedAt === undefined) return 0
  return Math.min(QUIZ_COOLDOWN_MS, Math.max(0, e.quizFailedAt + QUIZ_COOLDOWN_MS - now))
}

const put = (save: SaveData, lessonId: string, e: LessonProgress): SaveData => ({ ...save, lessons: { ...save.lessons, [lessonId]: e } })
const firstStep = (l: Lesson) => l.steps[0]?.id ?? ''

/**
 * The player is now on `stepId`. Reaching the last step (the recap) marks the lesson done, as finished rather
 * than skipped, and clears a failed quiz. Returns `save` itself when nothing changes.
 */
export function recordStep(save: SaveData, lesson: Lesson, stepId: string): SaveData {
  const prev = save.lessons[lesson.id]
  const atEnd = lesson.steps.length > 0 && lesson.steps[lesson.steps.length - 1].id === stepId
  if (prev && prev.stepId === stepId && (!atEnd || (prev.done && !prev.skipped && prev.quizFailedAt === undefined))) return save
  const e: LessonProgress = { stepId, done: (prev?.done ?? false) || atEnd }
  if (!atEnd && prev?.skipped) e.skipped = true
  if (!atEnd && prev?.quizFailedAt !== undefined) e.quizFailedAt = prev.quizFailedAt
  return put(save, lesson.id, e)
}

/** The skip quiz passed: the lesson is done (as "skipped", unless it was already finished). */
export function recordQuizPass(save: SaveData, lesson: Lesson): SaveData {
  const prev = save.lessons[lesson.id]
  const finished = prev?.done === true && !prev.skipped
  const e: LessonProgress = { stepId: prev?.stepId ?? firstStep(lesson), done: true }
  if (!finished) e.skipped = true
  return put(save, lesson.id, e)
}

/** The skip quiz failed at `now`: another try waits QUIZ_COOLDOWN_MS or until the lesson is finished. */
export function recordQuizFail(save: SaveData, lesson: Lesson, now: number): SaveData {
  const prev = save.lessons[lesson.id] ?? { stepId: firstStep(lesson), done: false }
  return put(save, lesson.id, { ...prev, quizFailedAt: now })
}
