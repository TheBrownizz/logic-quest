import type { Lesson, Step } from '../../content/lessons/types'
import type { LessonProgress } from '../../game/progress'

/**
 * The lesson player's state. `completed[i]` says step i is done (so "המשך" past it is open); a completed step
 * stays completed, so going back and forward again is free.
 */
export interface PlayerState { index: number; completed: boolean[] }

/**
 * Every action names the step it was issued from: a second "המשך" from the same step (a double click) or
 * a stale event finds the player elsewhere and does nothing.
 */
export type PlayerAction =
  | { type: 'complete'; index: number }
  | { type: 'next'; from: number }
  | { type: 'back'; from: number }
  | { type: 'goto'; index: number }

/** Steps that are complete as soon as they are shown. */
export const autoComplete = (s: Step): boolean =>
  s.kind === 'explain' || s.kind === 'recap' || (s.kind === 'widget' && s.goal === undefined)

const indexOf = (lesson: Lesson, id: string | undefined) => (id === undefined ? -1 : lesson.steps.findIndex(s => s.id === id))

/**
 * Where to open a lesson. The saved step (an unknown id, e.g. a step removed from the lesson, means the start).
 * A step named in the URL is honoured when it is not past the saved one, or anywhere in a done lesson.
 * A done lesson opened without a step starts from the top (its saved step is the finish screen).
 */
export function resumeIndex(lesson: Lesson, saved: LessonProgress | undefined, requested?: string): number {
  const at = Math.max(0, indexOf(lesson, saved?.stepId))
  const req = indexOf(lesson, requested)
  if (req >= 0 && (saved?.done || req <= at)) return req
  if (saved?.done) return requested === undefined ? 0 : at
  return at
}

/** The player at step `index`; every step before it, and every step of a done lesson, is complete. */
export function initPlayer(lesson: Lesson, index: number, done: boolean): PlayerState {
  const i = Math.min(Math.max(0, index), Math.max(0, lesson.steps.length - 1))
  return { index: i, completed: lesson.steps.map((s, j) => done || j < i || autoComplete(s)) }
}

/** Furthest step the player may jump to: up to and including the first incomplete step. */
const reachable = (s: PlayerState, i: number) => i >= 0 && i < s.completed.length && s.completed.slice(0, i).every(Boolean)

export function playerReducer(s: PlayerState, a: PlayerAction): PlayerState {
  switch (a.type) {
    case 'complete':
      if (a.index < 0 || a.index >= s.completed.length || s.completed[a.index]) return s
      return { ...s, completed: s.completed.map((c, i) => c || i === a.index) }
    case 'next':
      if (s.index !== a.from || !s.completed[a.from] || a.from >= s.completed.length - 1) return s
      return { ...s, index: a.from + 1 }
    case 'back':
      if (s.index !== a.from || a.from <= 0) return s
      return { ...s, index: a.from - 1 }
    case 'goto':
      if (a.index === s.index || !reachable(s, a.index)) return s
      return { ...s, index: a.index }
  }
}

/** Shared with the validator (src/content/lessons/answer.ts). */
export { matchesAnswer } from '../../content/lessons/answer'
