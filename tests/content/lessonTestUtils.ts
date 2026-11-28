import { expect } from 'vitest'
import { validateLessons } from '../../src/content/lessons/validate'
import { lessonsForStage } from '../../src/content/lessons/catalog'
import type { Lesson, StepKind } from '../../src/content/lessons/types'
import { switchingWorld } from '../../src/content/switching/world'

/** The lessons of a switching stage, after asserting that validateLessons finds nothing wrong with them. */
export function expectLessonsValid(stageId: string): Lesson[] {
  const lessons = lessonsForStage(stageId)
  const errs = validateLessons(switchingWorld, lessons)
  expect(errs, errs.join('\n')).toEqual([])
  return lessons
}

/** How many steps of each kind a lesson has. */
export function stepCounts(l: Lesson): Record<StepKind, number> {
  const out: Record<StepKind, number> = { explain: 0, widget: 0, check: 0, 'check-number': 0, try: 0, recap: 0 }
  for (const s of l.steps) out[s.kind]++
  return out
}

/** Widget steps that have a goal (and so an example). */
export const goalWidgets = (l: Lesson) => l.steps.filter(s => s.kind === 'widget' && s.goal !== undefined)

/**
 * The counts every finished lesson must meet (plan, Tasks 2–6): 8–15 steps, a widget step with a goal,
 * at least 2 checks, one recap, a skip-quiz pool of at least 6.
 */
export function expectFullLesson(l: Lesson): void {
  const c = stepCounts(l)
  expect(l.steps.length, `${l.id} steps`).toBeGreaterThanOrEqual(8)
  expect(l.steps.length, `${l.id} steps`).toBeLessThanOrEqual(15)
  expect(goalWidgets(l).length, `${l.id} widget goals`).toBeGreaterThanOrEqual(1)
  expect(c.check, `${l.id} checks`).toBeGreaterThanOrEqual(2)
  expect(c.recap, `${l.id} recap`).toBe(1)
  expect(l.skipQuiz.length, `${l.id} skip quiz`).toBeGreaterThanOrEqual(6)
}
