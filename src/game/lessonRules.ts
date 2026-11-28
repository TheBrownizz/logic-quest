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

/** A stage's lessons, by stage id (tests pass their own). */
export type LessonsOf = (stageId: string) => Lesson[]

/** Done = the end was reached or the skip quiz passed. */
export function lessonDone(save: SaveData, lessonId: string): boolean {
  return save.lessons[lessonId]?.done === true
}

/**
 * חדש / בתהליך / הושלם / דולג. An entry made only by a failed skip quiz (no step visited, stepId '') is still new.
 */
export function lessonStatus(save: SaveData, lessonId: string): LessonStatus {
  const e = save.lessons[lessonId]
  if (!e) return 'new'
  if (!e.done) return e.stepId === '' ? 'new' : 'progress'
  return e.skipped ? 'skipped' : 'done'
}

/** The stage has lessons and every one of them is done. */
const lessonsComplete = (save: SaveData, lessons: Lesson[]) =>
  lessons.length > 0 && lessons.every(l => lessonDone(save, l.id))

/**
 * Whether a stage's rooms and run are open. The stage itself must be open (the 60% rule), and then any of:
 * its lessons opened it before (`save.openStages`, so the unlock is permanent even when lessons are added later);
 * every one of its lessons is done; at least one of its rooms is already solved (v1 saves stay open).
 * A stage without lessons is open.
 */
export function stageRoomsOpen(world: World, stageId: string, save: SaveData, lessons: Lesson[] = lessonsForStage(stageId)): boolean {
  const stage = world.stages.find(s => s.id === stageId)
  if (!stage || !isStageUnlocked(world, stageId, save)) return false
  if (save.openStages.includes(stageId)) return true
  if (stage.rooms.some(r => save.rooms[r.id]?.solved)) return true
  return lessons.every(l => lessonDone(save, l.id))
}

/**
 * Records in `openStages` every open stage of `world` whose lessons are all done, so the unlock survives lessons
 * added later. (A stage open only because it has no lessons is not recorded: lessons may still come; a stage
 * open through a solved room needs no record.) Returns `save` itself when nothing changes.
 */
export function rememberOpenStages(world: World, save: SaveData, lessonsOf: LessonsOf = lessonsForStage): SaveData {
  const add = world.stages
    .filter(s => !save.openStages.includes(s.id) && isStageUnlocked(world, s.id, save) && lessonsComplete(save, lessonsOf(s.id)))
    .map(s => s.id)
  return add.length ? { ...save, openStages: [...save.openStages, ...add] } : save
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
 * than skipped, and clears a failed quiz; if that completes the stage's lessons, the stage is recorded as open.
 * Returns `save` itself when nothing changes.
 */
export function recordStep(world: World, save: SaveData, lesson: Lesson, stepId: string, lessonsOf: LessonsOf = lessonsForStage): SaveData {
  const prev = save.lessons[lesson.id]
  const atEnd = lesson.steps.length > 0 && lesson.steps[lesson.steps.length - 1].id === stepId
  if (prev && prev.stepId === stepId && (!atEnd || (prev.done && !prev.skipped && prev.quizFailedAt === undefined))) {
    return rememberOpenStages(world, save, lessonsOf)
  }
  const e: LessonProgress = { stepId, done: (prev?.done ?? false) || atEnd }
  if (!atEnd && prev?.skipped) e.skipped = true
  if (!atEnd && prev?.quizFailedAt !== undefined) e.quizFailedAt = prev.quizFailedAt
  return rememberOpenStages(world, put(save, lesson.id, e), lessonsOf)
}

/** The skip quiz passed: the lesson is done (as "skipped", unless it was already finished); see recordStep. */
export function recordQuizPass(world: World, save: SaveData, lesson: Lesson, lessonsOf: LessonsOf = lessonsForStage): SaveData {
  const prev = save.lessons[lesson.id]
  const finished = prev?.done === true && !prev.skipped
  const e: LessonProgress = { stepId: prev?.stepId || firstStep(lesson), done: true }
  if (!finished) e.skipped = true
  return rememberOpenStages(world, put(save, lesson.id, e), lessonsOf)
}

/**
 * The skip quiz failed at `now`: another try waits QUIZ_COOLDOWN_MS or until the lesson is finished. A lesson
 * never opened keeps stepId '' (still "new": taking the quiz does not start the lesson).
 */
export function recordQuizFail(save: SaveData, lesson: Lesson, now: number): SaveData {
  const prev = save.lessons[lesson.id] ?? { stepId: '', done: false }
  return put(save, lesson.id, { ...prev, quizFailedAt: now })
}
