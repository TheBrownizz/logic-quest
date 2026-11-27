import { expect, type Page } from '@playwright/test'
import type { Lesson, Step } from '../../src/content/lessons/types'

/** True when a step can't be completed from its data alone (a widget goal, a non-number try): it needs ?autofill=1. */
export const needsAutofill = (s: Step) => (s.kind === 'widget' && s.goal !== undefined) || (s.kind === 'try' && s.puzzle.type !== 'number')

/** The step on screen is `step`. */
export async function expectStep(page: Page, step: Step) {
  await expect(page.getByTestId('lesson-step')).toHaveAttribute('data-step', step.id)
}

/**
 * Completes the step on screen from its content data: the correct check option, the check-number answer, the
 * number `try` answer. Widget goals and other `try` puzzles must be opened with ?autofill=1 (see needsAutofill).
 */
export async function completeStep(page: Page, step: Step) {
  const box = page.getByTestId('lesson-step')
  switch (step.kind) {
    case 'check':
      await box.getByTestId(`check-opt-${step.correct}`).click()
      await expect(box.getByTestId('check-feedback')).toHaveClass(/good/)
      break
    case 'check-number':
      await box.getByTestId('check-number-input').fill(step.answer)
      await box.getByRole('button', { name: 'בדוק' }).click()
      await expect(box.getByTestId('check-feedback')).toHaveClass(/good/)
      break
    case 'try':
      if (step.puzzle.type === 'number') {
        await box.getByTestId('number-input').fill(step.puzzle.answer)
        await box.getByRole('button', { name: 'בדוק' }).click()
      }
      await expect(box.getByTestId('try-done')).toBeVisible()
      break
    case 'widget':
      if (step.goal !== undefined) await expect(box.getByTestId('goal-status')).toContainText('✓')
      break
    default:
      break
  }
}

/**
 * Plays `lesson` from the step on screen to its finish screen. `each` runs on every step before it is
 * completed (e.g. a layout check). The page must already show the lesson at step `from`.
 */
export async function playLesson(page: Page, lesson: Lesson, opts: { from?: number; each?: (s: Step) => Promise<void> } = {}) {
  for (let i = opts.from ?? 0; i < lesson.steps.length; i++) {
    const step = lesson.steps[i]
    await expectStep(page, step)
    await opts.each?.(step)
    await completeStep(page, step)
    if (i < lesson.steps.length - 1) await page.getByTestId('lesson-next').click()
  }
  await expect(page.getByTestId('recap-points')).toBeVisible()
}

/** The URL that opens `lesson`, with ?autofill=1 when some step needs it. */
export const lessonUrl = (lesson: Lesson) => `/${lesson.steps.some(needsAutofill) ? '?autofill=1' : ''}#/lesson/${lesson.id}`
