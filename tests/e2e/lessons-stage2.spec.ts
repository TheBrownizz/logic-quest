import { test, expect } from '@playwright/test'
import { findLesson } from '../../src/content/lessons/catalog'
import { switchingWorld } from '../../src/content/switching/world'
import { emptySave } from '../../src/game/progress'
import { seed } from './helpers'
import { completeStep, expectStep } from './lessonWalk'

const lesson = findLesson('sw-2-l2')!
/** Stage 1 solved (so stage 2 is open); no stage-2 lesson started. */
const save = () => {
  const s = emptySave()
  for (const r of switchingWorld.stages[0].rooms) s.rooms[r.id] = { solved: true, optimal: false, noHints: false }
  return s
}

test('lesson 2.2: build 0.25 by clicking exponent bits, then build −6.25 with the keyboard, and advance', async ({ page }) => {
  await seed(page, save())
  await page.goto(`/#/lesson/${lesson.id}`)
  const box = page.getByTestId('lesson-step')
  const goalAt = lesson.steps.findIndex(s => s.id === 'exp-goal')
  for (let i = 0; i < goalAt; i++) {
    await expectStep(page, lesson.steps[i])
    await completeStep(page, lesson.steps[i])
    await page.getByTestId('lesson-next').click()
  }
  await expectStep(page, lesson.steps[goalAt])
  const field = box.getByTestId('bitfield')
  await expect(box.getByTestId('bitfield-value')).toHaveText('1')
  await expect(page.getByTestId('lesson-next')).toBeDisabled()
  // locked fields do not change
  await box.getByTestId('bit-0').click({ force: true })
  await expect(field).toHaveAttribute('data-bits', '0' + '01111111' + '0'.repeat(23))
  // E: 01111111 → 01111101 (bit index 7 is exponent bit 1): e = −2
  await box.getByTestId('bit-7').click()
  await expect(box.getByTestId('bitfield-value')).toHaveText('0.25')
  await expect(box.getByTestId('goal-status')).toContainText('✓')
  // the binary point slides two places left: 1.0 → 0.01
  await box.getByTestId('bitfield-play').click()
  await expect(box.getByTestId('bitfield-shifted')).toHaveText('0.01₂')
  await page.getByTestId('lesson-next').click()
  await expectStep(page, lesson.steps[goalAt + 1])

  // jump to the build-from-zero step (each step on the way is completed the same way)
  const buildAt = lesson.steps.findIndex(s => s.id === 'build')
  for (let i = goalAt + 1; i < buildAt; i++) {
    const s = lesson.steps[i]
    await expectStep(page, s)
    if (s.kind === 'widget' && s.goal !== undefined) {
      // mantissa 1.875 = 1.111₂: the first three mantissa bits (indices 9, 10, 11)
      for (const b of [9, 10, 11]) await box.getByTestId(`bit-${b}`).click()
    }
    await completeStep(page, s)
    await page.getByTestId('lesson-next').click()
  }
  await expectStep(page, lesson.steps[buildAt])
  await expect(box.getByTestId('bitfield-value')).toHaveText('0')
  // keyboard only: −6.25 = 1 | 10000001 | 1001…  → bits 0, 1, 8, 9, 12
  await box.getByTestId('bit-0').focus()
  const want = [0, 1, 8, 9, 12]
  for (let i = 0; i <= 12; i++) {
    if (want.includes(i)) await page.keyboard.press('Space')
    if (i < 12) await page.keyboard.press('ArrowRight')
  }
  await expect(box.getByTestId('bitfield')).toHaveAttribute('data-bits', '1' + '10000001' + '1001'.padEnd(23, '0'))
  await expect(box.getByTestId('bitfield-value')).toHaveText('−6.25')
  await expect(box.getByTestId('goal-status')).toContainText('✓')
  await page.getByTestId('lesson-next').click()
  await expectStep(page, lesson.steps[buildAt + 1])
})

test('BitField fits a 400px screen with no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 900 })
  await seed(page, save())
  await page.goto(`/#/lesson/${lesson.id}`)
  for (let i = 0; i < 2; i++) await page.getByTestId('lesson-next').click()
  await expect(page.getByTestId('bitfield')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  const area = await page.getByTestId('widget-area').evaluate(el => el.scrollWidth - el.clientWidth)
  expect(area).toBeLessThanOrEqual(0)
})
