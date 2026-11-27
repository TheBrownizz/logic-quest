import { test, expect, type Page } from '@playwright/test'
import { readSave, seed, unlockedSave } from './helpers'

test.beforeEach(async ({ page }) => { await seed(page, unlockedSave(['sw-1-r1', 'sw-4-r1'])) })

async function pickGroup(page: Page, cells: Array<[number, number]>) {
  const toggle = page.getByRole('button', { name: 'בחירת תאים' })
  if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click()
  for (const [r, c] of cells) await page.getByTestId(`kcell-${r}-${c}`).click()
  await page.getByRole('button', { name: 'קבע קבוצה' }).click()
}

test('k-map: four corners need one wrap group', async ({ page }) => {
  await page.goto('/#/room/sw-4-r1')
  await expect(page.getByTestId('kmap-hint')).toContainText('בחירת תאים')
  // two wrap groups (a valid but wasteful cover)
  await pickGroup(page, [[0, 0], [0, 3]])
  await expect(page.getByTestId('kmap-group')).toHaveCount(1)
  await page.getByRole('button', { name: 'בדוק' }).click()
  await expect(page.getByRole('alert')).toHaveText('לא כיסית את כל ה-1')
  await pickGroup(page, [[3, 0], [3, 3]])
  await expect(page.getByTestId('kmap-group')).toHaveCount(2)
  await page.getByRole('button', { name: 'בדוק' }).click()
  await expect(page.getByRole('status')).toContainText('נכון – אבל אפשר עם פחות ליטרלים')
  // replace with the single wrap group
  await page.getByTestId('kmap-group').first().click()
  await page.getByTestId('kmap-group').first().click()
  await expect(page.getByTestId('kmap-group')).toHaveCount(0)
  await pickGroup(page, [[0, 0], [0, 3], [3, 0], [3, 3]])
  await expect(page.getByTestId('kmap-expr')).toHaveText("f = B'D'")
  await page.getByRole('button', { name: 'בדוק' }).click()
  await expect(page.getByRole('status')).toContainText('נכון!')
  await expect(page.getByTestId('result-stars')).toHaveAttribute('aria-label', '3 מתוך 3 כוכבים')
})

test('k-map: grabbing a zero is flagged', async ({ page }) => {
  await page.goto('/#/room/sw-4-r1')
  await page.getByTestId('kcell-1-1').focus()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'בדוק' }).click()
  await expect(page.getByRole('alert')).toHaveText('תפסת 0')
})

test('number room: wrong then right', async ({ page }) => {
  await page.goto('/#/room/sw-1-r1')
  const input = page.getByTestId('number-input')
  await input.fill('10110100')
  await page.getByRole('button', { name: 'בדוק' }).click()
  await expect(page.getByRole('alert')).toHaveText('לא נכון, נסו שוב')
  await expect(page.getByText('10110101')).toHaveCount(0)
  await input.fill('1011 0101')
  await page.getByRole('button', { name: 'בדוק' }).click()
  await expect(page.getByRole('status')).toContainText('נכון!')
  await expect(page.getByTestId('result-stars')).toHaveAttribute('aria-label', '3 מתוך 3 כוכבים')
})

test('number room: reveal after 3 misses costs the no-hints star', async ({ page }) => {
  await page.goto('/#/room/sw-1-r1')
  const input = page.getByTestId('number-input')
  await expect(page.getByRole('button', { name: 'הצג תשובה' })).toHaveCount(0)
  for (let i = 0; i < 3; i++) {
    await input.fill('0')
    await page.getByRole('button', { name: 'בדוק' }).click()
  }
  await page.getByRole('button', { name: 'הצג תשובה' }).click()
  await expect(page.getByTestId('revealed')).toContainText('10110101')
  await input.fill('10110101')
  await page.getByRole('button', { name: 'בדוק' }).click()
  await expect(page.getByTestId('result-stars')).toHaveAttribute('aria-label', '2 מתוך 3 כוכבים')
})

test('k-map: plain drag makes a rectangle; 2x2 across the left/right edge is accepted; bad selection is rejected', async ({ page }) => {
  await page.goto('/#/room/sw-4-r1')
  const a = (await page.getByTestId('kcell-0-1').boundingBox())!
  const b = (await page.getByTestId('kcell-1-2').boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 4 })
  await page.mouse.up()
  await expect(page.getByTestId('kmap-group')).toHaveCount(1)
  await page.getByTestId('kmap-group').click()
  await pickGroup(page, [[0, 0], [1, 0], [0, 3], [1, 3]])
  await expect(page.getByTestId('kmap-group')).toHaveCount(1)
  await expect(page.getByTestId('kmap-group')).not.toHaveClass(/invalid/)
  await pickGroup(page, [[0, 1], [0, 2], [3, 3]])
  await expect(page.getByRole('alert')).toHaveText('קבוצה לא חוקית')
  await expect(page.getByTestId('kmap-group')).toHaveCount(1)
})

test('I1: k-map hint, non-minimal, then minimal stays at two stars; התחל מחדש clears it', async ({ page }) => {
  await page.goto('/#/room/sw-4-r1')
  await page.getByRole('button', { name: /רמז/ }).click()
  await pickGroup(page, [[0, 0], [0, 3]])
  await pickGroup(page, [[3, 0], [3, 3]])
  await page.getByRole('button', { name: 'בדוק' }).click()
  await expect(page.getByTestId('result-stars')).toHaveAttribute('aria-label', '1 מתוך 3 כוכבים')
  await page.getByRole('button', { name: 'נקה' }).click()
  await pickGroup(page, [[0, 0], [0, 3], [3, 0], [3, 3]])
  await page.getByRole('button', { name: 'בדוק' }).click()
  await expect(page.getByTestId('result-stars')).toHaveAttribute('aria-label', '2 מתוך 3 כוכבים')
  expect((await readSave(page)).rooms['sw-4-r1']).toEqual({ solved: true, optimal: true, noHints: false })
  // starting over from a clean state may earn the third star
  await page.getByRole('button', { name: 'התחל מחדש' }).click()
  await expect(page.getByTestId('hint')).toHaveCount(0)
  await expect(page.getByTestId('kmap-group')).toHaveCount(0)
  await pickGroup(page, [[0, 0], [0, 3], [3, 0], [3, 3]])
  await page.getByRole('button', { name: 'בדוק' }).click()
  await expect(page.getByTestId('result-stars')).toHaveAttribute('aria-label', '3 מתוך 3 כוכבים')
})

test('I1: number room hint, solve, התחל מחדש, solve again earns three stars', async ({ page }) => {
  await page.goto('/#/room/sw-1-r1')
  await page.getByRole('button', { name: /רמז/ }).click()
  await page.getByTestId('number-input').fill('10110101')
  await page.getByRole('button', { name: 'בדוק' }).click()
  await expect(page.getByTestId('result-stars')).toHaveAttribute('aria-label', '2 מתוך 3 כוכבים')
  await page.reload()
  await page.getByTestId('number-input').fill('10110101')
  await page.getByRole('button', { name: 'בדוק' }).click()
  await expect(page.getByTestId('result-stars')).toHaveAttribute('aria-label', '2 מתוך 3 כוכבים')
  await page.getByRole('button', { name: 'התחל מחדש' }).click()
  await expect(page.getByTestId('number-input')).toHaveValue('')
  await page.getByTestId('number-input').fill('10110101')
  await page.getByRole('button', { name: 'בדוק' }).click()
  await expect(page.getByTestId('result-stars')).toHaveAttribute('aria-label', '3 מתוך 3 כוכבים')
})

test('M5: after a solve, "לחדר הבא" leads to the next room; the last room leads back to the stage', async ({ page }) => {
  await page.goto('/#/room/sw-1-r1')
  await expect(page.getByRole('link', { name: /לחדר הבא/ })).toHaveCount(0)
  await page.getByTestId('number-input').fill('10110101')
  await page.getByRole('button', { name: 'בדוק' }).click()
  await page.getByRole('link', { name: /לחדר הבא/ }).click()
  await expect(page).toHaveURL(/#\/room\/sw-1-r2$/)
  await expect(page.getByRole('heading', { name: 'חזרה לעשרוני' })).toBeVisible()
  await page.goto('/#/room/sw-1-r8')
  await page.getByTestId('number-input').fill('0010001')
  await page.getByRole('button', { name: 'בדוק' }).click()
  await page.getByTestId('next-room').click()
  await expect(page).toHaveURL(/#\/world\/switching\/stage\/sw-1-numbers$/)
})
