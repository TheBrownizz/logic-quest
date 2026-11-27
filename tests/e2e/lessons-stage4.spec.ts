import { test, expect, type Page } from '@playwright/test'
import { lessonsForStage } from '../../src/content/lessons/catalog'
import type { SaveData } from '../../src/game/progress'
import { readSave, seed, unlockedSave } from './helpers'
import { completeStep, expectStep, lessonUrl, playLesson } from './lessonWalk'

const STAGE = 'sw-4-minimize'
const lessons = lessonsForStage(STAGE)
const [l1, l2, l3] = lessons
const SHOTS = process.env.LQ_SHOTS // when set, a directory for the brief's screenshots

/** Stages 1–3 solved and every other lesson done; the stage-4 lessons are new. */
function stage4Save(): SaveData {
  const s = unlockedSave([], 4)
  const lessonsLeft = Object.fromEntries(Object.entries(s.lessons).filter(([id]) => !lessons.some(l => l.id === id)))
  return { ...s, lessons: lessonsLeft }
}
const at = (lessonId: string, stepId: string) => `/#/lesson/${lessonId}/${stepId}`
const noHorizontalScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)

declare const process: { env: Record<string, string | undefined> }

test('4.2: rows fly onto the map, then the neighbours of cell 0 (across the edges) complete the goal and the lesson moves on', async ({ page }) => {
  await seed(page, { ...stage4Save(), lessons: { ...stage4Save().lessons, [l2.id]: { stepId: 'fly', done: false } } })
  await page.goto(`/#/lesson/${l2.id}`)
  const fly = l2.steps.find(s => s.id === 'fly')!
  await expectStep(page, fly)
  const next = page.getByTestId('lesson-next')
  await expect(next).toBeDisabled()
  // one row by click, the rest with "שלחו הכול"
  await page.getByTestId('ttm-row-3').click()
  await expect(page.getByTestId('ttm-cell-3')).toHaveAttribute('data-filled', 'true')
  await expect(page.getByTestId('ttm-cell-3')).toContainText('1')
  await expect(next).toBeDisabled()
  await page.getByTestId('ttm-place-all').click()
  await expect(page.getByTestId('goal-status')).toContainText('✓')
  for (let m = 0; m < 8; m++) await expect(page.getByTestId(`ttm-cell-${m}`)).toHaveAttribute('data-filled', 'true')
  // Gray order: cell 2 (010) sits in the last column, after 3 (011)
  const x2 = (await page.getByTestId('ttm-cell-2').boundingBox())!.x
  const x3 = (await page.getByTestId('ttm-cell-3').boundingBox())!.x
  expect(x2).toBeGreaterThan(x3)
  if (SHOTS) await page.getByTestId('widget-area').screenshot({ path: `${SHOTS}/task-5-flow-1280.png` })
  await next.click()

  const gray = l2.steps[l2.steps.indexOf(fly) + 2]
  await completeStep(page, l2.steps[l2.steps.indexOf(fly) + 1]) // explain
  await next.click()
  await expectStep(page, gray)
  await completeStep(page, gray)
  await next.click()

  const nbr = l2.steps.find(s => s.id === 'nbr')!
  await expectStep(page, nbr)
  await page.getByTestId('ttm-cell-0').click()
  for (const m of [1, 2, 4, 8]) await expect(page.getByTestId(`ttm-cell-${m}`)).toHaveAttribute('data-nbr', 'true')
  await expect(page.getByTestId('ttm-cell-5')).not.toHaveAttribute('data-nbr', 'true')
  await expect(page.getByTestId('ttm-info')).toContainText('שכני תא 0')
  for (const m of [1, 2, 4]) await page.getByTestId(`ttm-cell-${m}`).click()
  await expect(next).toBeDisabled()
  await page.getByTestId('ttm-cell-8').click()
  await expect(page.getByTestId('goal-status')).toContainText('✓')
  if (SHOTS) await page.getByTestId('widget-area').screenshot({ path: `${SHOTS}/task-5-nbr-1280.png` })
  await next.click()
  await expectStep(page, l2.steps[l2.steps.indexOf(nbr) + 1])
  expect((await readSave(page)).lessons[l2.id].stepId).toBe(l2.steps[l2.steps.indexOf(nbr) + 1].id)
})

test('4.1: selecting the F = 1 rows writes the canonical SOP; a 0 row is flagged', async ({ page }) => {
  await seed(page, { ...stage4Save(), lessons: { ...stage4Save().lessons, [l1.id]: { stepId: 'pick-min', done: false } } })
  await page.goto(at(l1.id, 'pick-min'))
  await page.getByTestId('ttm-row-0').click()
  await expect(page.getByTestId('ttm-info')).toContainText('מינטרם נכתב רק משורה')
  await page.getByTestId('ttm-row-0').click()
  for (const m of [3, 5, 6, 7]) await page.getByTestId(`ttm-row-${m}`).click()
  await expect(page.getByTestId('ttm-expr')).toHaveText("F = A'BC + AB'C + ABC' + ABC")
  await expect(page.getByTestId('goal-status')).toContainText('✓')
  if (SHOTS) await page.getByTestId('widget-area').screenshot({ path: `${SHOTS}/task-5-rows-1280.png` })
  await page.getByTestId('lesson-next').click()
  await expectStep(page, l1.steps[l1.steps.findIndex(s => s.id === 'pick-min') + 1])
})

test('4.3: a group with an X cell shows its term', async ({ page }) => {
  await seed(page, { ...stage4Save(), lessons: { ...stage4Save().lessons, [l3.id]: { stepId: 'pick-x', done: false } } })
  await page.goto(at(l3.id, 'pick-x'))
  await expect(page.getByTestId('ttm-cell-6')).toContainText('X')
  await page.getByTestId('ttm-cell-4').click()
  await page.getByTestId('ttm-cell-5').click()
  await page.getByTestId('ttm-cell-7').click()
  await expect(page.getByTestId('ttm-info')).toContainText('לא קבוצה חוקית')
  await page.getByTestId('ttm-cell-6').click()
  await expect(page.getByTestId('ttm-expr')).toHaveText("A'B")
  await expect(page.getByTestId('goal-status')).toContainText('✓')
  if (SHOTS) await page.getByTestId('widget-area').screenshot({ path: `${SHOTS}/task-5-group-1280.png` })
})

test('the widget fits at 400px and works with the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 900 })
  await seed(page, { ...stage4Save(), lessons: { ...stage4Save().lessons, [l2.id]: { stepId: 'nbr', done: false } } })
  await page.goto(at(l2.id, 'nbr'))
  await noHorizontalScroll(page)
  await page.getByTestId('ttm-cell-0').focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('ttm-cell-0')).toHaveAttribute('data-picked', 'true')
  if (SHOTS) await page.getByTestId('widget-area').screenshot({ path: `${SHOTS}/task-5-nbr-400.png` })
})

test('every stage-4 lesson can be walked to its end at 400px without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 900 })
  await seed(page, stage4Save())
  for (const l of lessons) {
    await page.goto(lessonUrl(l))
    await playLesson(page, l, { each: async () => { await noHorizontalScroll(page) } })
  }
  const save = await readSave(page)
  for (const l of lessons) expect(save.lessons[l.id].done).toBe(true)
})

test('flow view at 400px (screenshot) and reduced motion lands the rows at once', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await seed(page, { ...stage4Save(), lessons: { ...stage4Save().lessons, [l2.id]: { stepId: 'fly', done: false } } })
  await page.goto(at(l2.id, 'fly'))
  await page.getByTestId('ttm-place-all').click()
  for (let m = 0; m < 8; m++) await expect(page.getByTestId(`ttm-cell-${m}`)).toHaveAttribute('data-filled', 'true', { timeout: 200 })
  await noHorizontalScroll(page)
  if (SHOTS) await page.getByTestId('widget-area').screenshot({ path: `${SHOTS}/task-5-flow-400.png` })
})
