import { test, expect, type Page } from '@playwright/test'
import { emptySave } from '../../src/game/progress'
import { seed } from './helpers'

const SHOTS = '/home/user/logic-quest/.superpowers/sdd/2026-11-27-lessons'
const at = (page: Page, lesson: string, step: string) =>
  seed(page, { ...emptySave(), lessons: { [lesson]: { stepId: step, done: false } } })
const noHorizontalScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)

test('1.1: build 45 on the binary dial (mouse and keyboard), the goal completes and the lesson advances', async ({ page }) => {
  await at(page, 'sw-1-l1', 'dial2')
  await page.goto('/#/lesson/sw-1-l1')
  const step = page.getByTestId('lesson-step')
  await expect(step).toHaveAttribute('data-step', 'dial2')
  await expect(page.getByTestId('lesson-next')).toBeDisabled()
  await expect(page.getByTestId('dial-weight-0')).toHaveText('32')
  // 45 = 32 + 8 + 4 + 1 → 101101
  await page.getByTestId('dial-up-0').click()
  await page.getByTestId('dial-up-2').click()
  await page.getByTestId('dial-up-3').click()
  await expect(page.getByTestId('dial-value')).toHaveText('44')
  await expect(page.getByTestId('goal-status')).not.toContainText('✓')
  await page.getByTestId('dial-digit-5').focus()
  await page.keyboard.press('ArrowUp')
  await expect(page.getByTestId('dial-value')).toHaveText('45')
  await expect(page.getByTestId('dial-number')).toContainText('(101101)')
  await expect(page.getByTestId('goal-status')).toContainText('✓')
  await page.getByTestId('lesson-next').click()
  await expect(step).toHaveAttribute('data-step', 'weight')
})

test('1.2: repeated division drops the remainders into place, right to left', async ({ page }) => {
  await at(page, 'sw-1-l2', 'divide2')
  await page.goto('/#/lesson/sw-1-l2')
  await expect(page.getByTestId('lesson-step')).toHaveAttribute('data-step', 'divide2')
  for (let i = 0; i < 3; i++) await page.getByTestId('bc-step').click()
  await expect(page.getByTestId('bc-result')).toHaveAttribute('aria-label', 'תוצאה: 101')
  await expect(page.getByTestId('goal-status')).not.toContainText('✓')
  for (let i = 0; i < 3; i++) await page.getByTestId('bc-step').click()
  await expect(page.getByTestId('bc-result')).toHaveAttribute('aria-label', 'תוצאה: 101101')
  await expect(page.getByTestId('goal-status')).toContainText('✓')
  await expect(page.getByTestId('bc-step')).toBeDisabled()
})

test('1.3: subtraction by complement reaches the result with a dropped end carry', async ({ page }) => {
  await at(page, 'sw-1-l3', 'sub-pos')
  await page.goto('/#/lesson/sw-1-l3')
  await expect(page.getByTestId('lesson-step')).toHaveAttribute('data-step', 'sub-pos')
  for (const label of ['הפכו כל ספרה', 'הוסיפו 1', 'חברו', 'קבלו את התוצאה']) {
    await expect(page.getByTestId('cl-next')).toHaveText(label)
    await page.getByTestId('cl-next').click()
  }
  await expect(page.getByTestId('complement-lab')).toHaveAttribute('data-phase', 'result')
  await expect(page.getByTestId('cl-pos-0')).toHaveText('4')
  await expect(page.getByTestId('cl-pos-1')).toHaveText('4')
  await expect(page.getByTestId('cl-endcarry')).toHaveText('1')
  await expect(page.getByTestId('goal-status')).toContainText('✓')
  await page.getByTestId('lesson-next').click()
  await expect(page.getByTestId('lesson-step')).toHaveAttribute('data-step', 'sub-neg')
})

// Screenshots for review (each widget at 1280px and 400px), and no horizontal scroll at 400px.
const shots: { name: string; lesson: string; step: string; act?: (p: Page) => Promise<void> }[] = [
  { name: 'basedial', lesson: 'sw-1-l1', step: 'dial2', act: async p => { for (const i of [0, 2, 3, 5]) await p.getByTestId(`dial-up-${i}`).click() } },
  { name: 'baseconvert-divide', lesson: 'sw-1-l2', step: 'divide2', act: async p => { for (let i = 0; i < 4; i++) await p.getByTestId('bc-step').click() } },
  { name: 'baseconvert-group', lesson: 'sw-1-l2', step: 'bin-hex', act: async p => { for (let i = 0; i < 2; i++) await p.getByTestId('bc-step').click() } },
  { name: 'complement-r', lesson: 'sw-1-l3', step: 'r-lab', act: async p => { await p.getByTestId('cl-next').click(); await p.getByTestId('cl-next').click() } },
  { name: 'complement-sum', lesson: 'sw-1-l3', step: 'sub-neg', act: async p => { for (let i = 0; i < 3; i++) await p.getByTestId('cl-next').click() } },
  { name: 'complement-result', lesson: 'sw-1-l3', step: 'sub-neg', act: async p => { for (let i = 0; i < 4; i++) await p.getByTestId('cl-next').click() } },
]
for (const s of shots) for (const width of [1280, 400]) {
  test(`screenshot ${s.name} at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ colorScheme: 'dark' })
    await at(page, s.lesson, s.step)
    await page.goto(`/#/lesson/${s.lesson}`)
    await expect(page.getByTestId('lesson-step')).toHaveAttribute('data-step', s.step)
    await s.act?.(page)
    await page.waitForTimeout(2200)
    await noHorizontalScroll(page)
    await page.getByTestId('lesson-step').screenshot({ path: `${SHOTS}/task-2-${s.name}-${width}.png` })
  })
}
