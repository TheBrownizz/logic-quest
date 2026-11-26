import { test, expect, type Page } from '@playwright/test'

const pin = (page: Page, node: string, dir: 'in' | 'out', i = 0) => page.getByTestId(`pin-${node}-${dir}-${i}`)

async function wire(page: Page, from: string, to: string, toPin = 0) {
  await pin(page, from, 'out').click()
  await pin(page, to, 'in', toPin).click()
}

/** n1 = NAND(A,B); S = NAND(NAND(A,n1), NAND(B,n1)); C = NAND(n1,n1) */
async function buildHalfAdder(page: Page) {
  await page.getByRole('button', { name: 'נקה' }).click()
  for (let i = 0; i < 5; i++) await page.getByTestId('palette-NAND').click()
  await expect(page.locator('[data-testid^="node-g"]')).toHaveCount(5)
  await wire(page, 'A', 'g1', 0); await wire(page, 'B', 'g1', 1)
  await wire(page, 'A', 'g2', 0); await wire(page, 'g1', 'g2', 1)
  await wire(page, 'B', 'g3', 0); await wire(page, 'g1', 'g3', 1)
  await wire(page, 'g2', 'g4', 0); await wire(page, 'g3', 'g4', 1)
  await wire(page, 'g1', 'g5', 0); await wire(page, 'g1', 'g5', 1)
  await wire(page, 'g5', 'C'); await wire(page, 'g4', 'S')
  await expect(page.locator('[data-testid="wire"]')).toHaveCount(12)
}

test('build the NAND half adder by hand, with live glow', async ({ page }) => {
  await page.goto('/#/room/sw-3-r1')
  await buildHalfAdder(page)

  // live: A=1, B=0 -> S=1, C=0
  await page.getByTestId('node-A').click()
  await expect(page.getByTestId('node-S')).toHaveAttribute('data-value', '1')
  await expect(page.getByTestId('node-C')).toHaveAttribute('data-value', '0')
  await expect(page.locator('[data-testid="wire"][data-value="1"]').first()).toBeVisible()

  await page.getByRole('button', { name: 'בדוק' }).click()
  await expect(page.getByText('נכון!')).toBeVisible()
  await expect(page.getByText('5 שערים · אופטימום 5')).toBeVisible()
  await expect(page.getByText('רכיב חדש נפתח: HA')).toBeVisible()
  await expect(page.getByTestId('result-stars')).toHaveAttribute('aria-label', '3 מתוך 3 כוכבים')
})

test('unconnected circuit shows a Hebrew error; delete removes a gate; draft survives reload', async ({ page }) => {
  await page.goto('/#/room/sw-3-r1')
  await page.getByRole('button', { name: 'נקה' }).click()
  await page.getByRole('button', { name: 'בדוק' }).click()
  await expect(page.getByRole('alert')).toHaveText('כניסה לא מחוברת')
  await expect(page.getByTestId('node-C')).toHaveClass(/error/)

  await page.getByTestId('palette-NAND').click()
  await page.getByTestId('palette-NAND').click()
  await page.getByTestId('node-g2').click()
  await page.keyboard.press('Delete')
  await expect(page.locator('[data-testid^="node-g"]')).toHaveCount(1)
  await page.reload()
  await expect(page.getByTestId('node-g1')).toBeVisible()
  await expect(page.locator('[data-testid^="node-g"]')).toHaveCount(1)
})

test('wrong circuit shows the first mismatching row', async ({ page }) => {
  await page.goto('/#/room/sw-3-r1')
  await page.getByRole('button', { name: 'נקה' }).click()
  await page.getByTestId('palette-NAND').click()
  await wire(page, 'A', 'g1', 0); await wire(page, 'B', 'g1', 1)
  await wire(page, 'g1', 'C'); await wire(page, 'g1', 'S')
  await page.getByRole('button', { name: 'בדוק' }).click()
  await expect(page.getByTestId('tt-row-0')).toHaveAttribute('data-mismatch', 'true')
})

test('hints reveal one at a time', async ({ page }) => {
  await page.goto('/#/room/sw-3-r1')
  await page.getByRole('button', { name: /רמז/ }).click()
  await expect(page.getByTestId('hint')).toHaveCount(1)
})

test('delay room: answer, then critical path and arrival times', async ({ page }) => {
  await page.goto('/#/room/sw-5-r1')
  await expect(page.getByText('מה ה-TPD בנקודה F?')).toBeVisible()
  await page.getByRole('spinbutton').fill('3')
  await page.getByRole('button', { name: 'בדוק' }).click()
  await expect(page.getByText('נכון!')).toBeVisible()
  await expect(page.locator('[data-critical="true"]')).toHaveCount(4)
  await expect(page.getByTestId('arrival-F')).toContainText('3')
})

test('unknown room is not found', async ({ page }) => {
  await page.goto('/#/room/nope')
  await expect(page.getByText('לא נמצא')).toBeVisible()
})

test('a hint still costs the star after a reload', async ({ page }) => {
  await page.goto('/#/room/sw-3-r1')
  await page.getByRole('button', { name: /רמז/ }).click()
  await expect(page.getByTestId('hint')).toHaveCount(1)
  await page.reload()
  await expect(page.getByTestId('hint')).toHaveCount(0)
  await buildHalfAdder(page)
  await page.getByRole('button', { name: 'בדוק' }).click()
  await expect(page.getByText('נכון!')).toBeVisible()
  await expect(page.getByTestId('result-stars')).toHaveAttribute('aria-label', '2 מתוך 3 כוכבים')
  await page.goto('/#/room/sw-3-r1')
  await page.reload()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('logic-quest-save')!))
  expect(saved.rooms['sw-3-r1']).toEqual({ solved: true, optimal: true, noHints: false })
  expect(saved.helped['sw-3-r1']).toBeUndefined()
})

test('a correct solve is saved even if the player leaves during the check sweep', async ({ page }) => {
  await page.goto('/?autofill=1#/room/sw-3-r1')
  await expect(page.locator('[data-testid="wire"]')).toHaveCount(12)
  await page.getByRole('button', { name: 'בדוק' }).click()
  await page.goto('/#/')
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('logic-quest-save')!))
  expect(saved.rooms['sw-3-r1']?.solved).toBe(true)
})
