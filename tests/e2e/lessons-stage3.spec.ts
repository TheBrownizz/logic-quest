import { test, expect } from '@playwright/test'
import { lessonsForStage } from '../../src/content/lessons/catalog'
import { seed, unlockedSave } from './helpers'
import { completeStep, expectStep } from './lessonWalk'

const lessons = lessonsForStage('sw-3-boolean')
const [l1, l2, l3] = lessons
const box = (page: import('@playwright/test').Page) => page.getByTestId('lesson-step')
/** Resume a lesson at `stepId` (saved progress, lesson not done), so its earlier steps count as completed. */
const resumeAt = (lessonId: string, stepId: string) => ({ ...unlockedSave(), lessons: { [lessonId]: { stepId, done: false } } })
const noHScroll = async (page: import('@playwright/test').Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)

test('3.1: play the NOT gate until the table is full, then continue', async ({ page }) => {
  await seed(page, { ...unlockedSave(), lessons: {} }) // stage open, lessons not done: the player walks them for real
  await page.goto(`/#/lesson/${l1.id}`)
  await expectStep(page, l1.steps[0])
  await page.getByTestId('lesson-next').click()
  await expectStep(page, l1.steps[1])
  await expect(page.getByTestId('lesson-next')).toBeDisabled()
  await expect(page.getByTestId('gt-lamp')).toHaveAttribute('aria-label', 'נורה: 1')
  await expect(page.getByTestId('gt-row-1').locator('.gt-out')).toHaveText('?')
  await box(page).getByTestId('gate-switch-A').click()
  await expect(page.getByTestId('gt-lamp')).toHaveAttribute('aria-label', 'נורה: 0')
  await expect(page.getByTestId('gt-row-1').locator('.gt-out')).toHaveText('0')
  await expect(page.getByTestId('goal-status')).toContainText('✓')
  await page.getByTestId('lesson-next').click()
  await expectStep(page, l1.steps[2])
})

test('3.1: a switch works from the keyboard, and a table row jumps the switches', async ({ page }) => {
  await seed(page, resumeAt(l1.id, 'and-play'))
  await page.goto(`/#/lesson/${l1.id}`)
  await expectStep(page, l1.steps[3])
  const a = page.getByTestId('gate-switch-A')
  await a.focus()
  await page.keyboard.press('Space')
  await expect(a).toHaveAttribute('aria-checked', 'true')
  await page.getByTestId('gate-switch-B').focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('gt-lamp')).toHaveAttribute('aria-label', 'נורה: 1')
  await page.getByRole('button', { name: 'נסו את שורה 2' }).click()
  await expect(a).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByTestId('gate-switch-B')).toHaveAttribute('aria-checked', 'false')
  await page.getByRole('button', { name: 'נסו את שורה 1' }).click()
  await expect(page.getByTestId('goal-status')).toContainText('✓')
})

test('3.2: find the row where the false De Morgan breaks', async ({ page }) => {
  await seed(page, resumeAt(l2.id, 'demorgan-wrong'))
  await page.goto(`/#/lesson/${l2.id}`)
  const i = l2.steps.findIndex(s => s.id === 'demorgan-wrong')
  await expectStep(page, l2.steps[i])
  await expect(page.getByTestId('goal-status')).not.toContainText('✓')
  await expect(page.getByTestId('ib-status')).toContainText('אין הבדל')
  await page.getByRole('button', { name: 'נסו את שורה 3' }).click() // 1,1: both 0
  await expect(page.getByTestId('goal-status')).not.toContainText('✓')
  await page.getByTestId('ib-switch-B').click() // row 2 (A=1, B=0): f=0, g=1
  await expect(page.getByTestId('ib-row-2')).toHaveAttribute('data-differ', 'true')
  await expect(page.getByTestId('goal-status')).toContainText('✓')
  await expect(page.getByTestId('ib-status')).toContainText('לא שקולים')
  await page.getByTestId('lesson-next').click()
  await expectStep(page, l2.steps[i + 1])
})

test('3.2: "run all rows" fills the table of two equivalent expressions', async ({ page }) => {
  await seed(page, { ...unlockedSave() })
  await page.goto(`/#/lesson/${l2.id}/demorgan-right`)
  await expectStep(page, l2.steps.find(s => s.id === 'demorgan-right')!)
  await page.getByTestId('ib-run').click()
  await expect(page.getByTestId('ib-status')).toContainText('שקולים', { timeout: 6000 })
  await expect(page.locator('[data-testid^="ib-row-"][data-tried="true"]')).toHaveCount(4)
  await expect(page.getByTestId('goal-status')).toContainText('✓')
})

test('3.3: the NAND-only try step (NOT) is solved with the real lab and the lesson goes on', async ({ page }) => {
  await seed(page, { ...unlockedSave(), lessons: {} })
  await page.goto(`/?autofill=1#/lesson/${l3.id}`)
  const i = l3.steps.findIndex(s => s.id === 'try-not')
  for (let k = 0; k <= i; k++) {
    await expectStep(page, l3.steps[k])
    await completeStep(page, l3.steps[k])
    if (k < i) await page.getByTestId('lesson-next').click()
  }
  await page.getByTestId('lesson-next').click()
  await expectStep(page, l3.steps[i + 1])
})

test('stage 3 widgets fit a 400px screen without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await seed(page, unlockedSave())
  for (const [lesson, id] of [[l1, 'and3'], [l1, 'box'], [l2, 'distribute-bench'], [l3, 'or-from-nand']] as const) {
    await page.goto(`/#/lesson/${lesson.id}/${id}`)
    await page.reload()
    await expect(box(page)).toHaveAttribute('data-step', id)
    await noHScroll(page)
    const w = await page.locator('.widget-area').evaluate(el => ({ sw: el.scrollWidth, cw: el.clientWidth }))
    expect(w.sw, `${id} widget fits its area`).toBeLessThanOrEqual(w.cw)
  }
})
