import { test, expect, type Page } from '@playwright/test'
import { findLesson } from '../../src/content/lessons/catalog'
import type { SaveData } from '../../src/game/progress'
import { seed, unlockedSave } from './helpers'
import { expectStep } from './lessonWalk'

declare const process: { env: Record<string, string | undefined> }

/** Every stage open; `lessonId` in progress at `stepId` (not done), so its goal steps start incomplete. */
function atStep(lessonId: string, stepId: string): SaveData {
  const save = unlockedSave()
  return { ...save, lessons: { ...save.lessons, [lessonId]: { stepId, done: false } } }
}
const noHorizontalScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)

test('5.1: drag the ripple timeline until every bit settles, then go on', async ({ page }) => {
  const lesson = findLesson('sw-5-l1')!
  const i = lesson.steps.findIndex(s => s.id === 'ripple-plain')
  await seed(page, atStep(lesson.id, 'ripple-plain'))
  await page.goto(`/#/lesson/${lesson.id}/ripple-plain`)
  await expectStep(page, lesson.steps[i])
  const box = page.getByTestId('lesson-step')
  await expect(box.getByTestId('goal-status')).not.toContainText('✓')
  await expect(page.getByTestId('lesson-next')).toBeDisabled()
  // stage 0 is busy, stage 1 waits for its carry
  await expect(box.getByTestId('rt-fa-0')).toHaveAttribute('data-status', 'active')
  await expect(box.getByTestId('rt-fa-1')).toHaveAttribute('data-status', 'waiting')
  const slider = box.getByTestId('ripple-slider')
  await slider.focus()
  for (let k = 0; k < 30; k++) await page.keyboard.press('ArrowRight') // 150 ns
  await expect(box.getByTestId('ripple-time')).toHaveText('t = 150 ns')
  await expect(box.getByTestId('rt-fa-0')).toHaveAttribute('data-status', 'done')
  await expect(box.getByTestId('rt-fa-1')).toHaveAttribute('data-status', 'active')
  await expect(box.getByTestId('rt-sum-3')).toHaveText('?')
  await page.keyboard.press('End')
  await expect(box.getByTestId('ripple-time')).toHaveText('t = 400 ns')
  await expect(box.getByTestId('rt-sum-3')).toHaveText('1')
  await expect(box.getByTestId('ripple-result')).toContainText('7 + 1 = 8')
  await expect(box.getByTestId('goal-status')).toContainText('✓')
  await page.getByTestId('lesson-next').click()
  await expectStep(page, lesson.steps[i + 1])
})

test('5.2: route D2 to the output with the select lines, then go on', async ({ page }) => {
  const lesson = findLesson('sw-5-l2')!
  const i = lesson.steps.findIndex(s => s.id === 'route')
  await seed(page, atStep(lesson.id, 'route'))
  await page.goto(`/#/lesson/${lesson.id}/route`)
  const box = page.getByTestId('lesson-step')
  await expect(box.getByTestId('mux-lamp')).toHaveAttribute('aria-label', 'יציאה Y = 0')
  await box.getByTestId('mux-s-1').click() // S1S0 = 01: D1
  await expect(box.getByTestId('mux-pick')).toHaveText('D1')
  await expect(box.getByTestId('goal-status')).not.toContainText('✓')
  await box.getByTestId('mux-s-1').click()
  await box.getByTestId('mux-s-0').press('Enter') // keyboard: S1S0 = 10
  await expect(box.getByTestId('mux-pick')).toHaveText('D2')
  await expect(box.getByTestId('mux-lamp')).toHaveAttribute('aria-label', 'יציאה Y = 1')
  await expect(box.getByTestId('goal-status')).toContainText('✓')
  await page.getByTestId('lesson-next').click()
  await expectStep(page, lesson.steps[i + 1])
})

test('5.2: the majority function with C in the data inputs', async ({ page }) => {
  await seed(page, atStep('sw-5-l2', 'majority'))
  await page.goto('/#/lesson/sw-5-l2/majority')
  const box = page.getByTestId('lesson-step')
  for (let k = 0; k < 2; k++) await box.getByTestId('mux-d-1').click() // 0 → 1 → C
  for (let k = 0; k < 2; k++) await box.getByTestId('mux-d-2').click()
  await box.getByTestId('mux-d-3').click()
  await expect(box.getByTestId('mux-fn')).toContainText('Σm(3, 5, 6, 7)')
  await expect(box.getByTestId('goal-status')).toContainText('✓')
})

const SHOT_DIR = '/home/user/logic-quest/.superpowers/sdd/2026-11-27-lessons'
for (const width of [1280, 400]) {
  test(`stage 5 widgets fit at ${width}px${process.env.SHOTS ? ' (screenshots)' : ''}`, async ({ browser }) => {
    const shots: [string, string, (p: Page) => Promise<void>][] = [
      ['sw-5-l1', 'ripple-plain', async p => { await p.getByTestId('ripple-slider').focus(); for (let k = 0; k < 50; k++) await p.keyboard.press('ArrowRight') }],
      ['sw-5-l1', 'sub-timeline', async p => { await p.getByTestId('ripple-slider').focus(); await p.keyboard.press('End') }],
      ['sw-5-l2', 'route', async p => { await p.getByTestId('mux-s-0').click() }],
      ['sw-5-l2', 'majority', async p => { await p.getByTestId('mux-d-1').click(); await p.getByTestId('mux-d-1').click() }],
      ['sw-5-l3', 'program', async p => { await p.getByTestId('mux-d-1').click() }],
      ['sw-5-l1', 'fa', async () => {}],
      ['sw-5-l3', 'inside', async () => {}],
    ]
    for (const [lessonId, stepId, act] of shots) {
      const ctx = await browser.newContext({ viewport: { width, height: 1000 } })
      const page = await ctx.newPage()
      await seed(page, atStep(lessonId, stepId))
      await page.goto(`/#/lesson/${lessonId}/${stepId}`)
      await expect(page.getByTestId('lesson-step')).toHaveAttribute('data-step', stepId)
      await act(page)
      await noHorizontalScroll(page)
      if (process.env.SHOTS) await page.screenshot({ path: `${SHOT_DIR}/task-6-${stepId}-${width}.png`, fullPage: true })
      await ctx.close()
    }
  })
}
