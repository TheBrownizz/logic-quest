import { test, expect, type Page } from '@playwright/test'

async function drag(page: Page, from: [number, number], to: [number, number], shift = false) {
  const a = (await page.getByTestId(`kcell-${from[0]}-${from[1]}`).boundingBox())!
  const b = (await page.getByTestId(`kcell-${to[0]}-${to[1]}`).boundingBox())!
  if (shift) await page.keyboard.down('Shift')
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 })
  await page.mouse.up()
  if (shift) await page.keyboard.up('Shift')
}

test('k-map: four corners need one wrap group', async ({ page }) => {
  await page.goto('/#/room/sw-4-r1')
  await expect(page.getByTestId('kmap-hint')).toContainText('Shift')
  // two wrap groups (a valid but wasteful cover)
  await drag(page, [0, 0], [0, 3], true)
  await expect(page.getByTestId('kmap-group')).toHaveCount(1)
  await page.getByRole('button', { name: 'בדוק' }).click()
  await expect(page.getByRole('alert')).toHaveText('לא כיסית את כל ה-1')
  await drag(page, [3, 0], [3, 3], true)
  await expect(page.getByTestId('kmap-group')).toHaveCount(2)
  await page.getByRole('button', { name: 'בדוק' }).click()
  await expect(page.getByRole('status')).toContainText('נכון – אבל אפשר עם פחות ליטרלים')
  // replace with the single wrap group
  await page.getByTestId('kmap-group').first().click()
  await page.getByTestId('kmap-group').first().click()
  await expect(page.getByTestId('kmap-group')).toHaveCount(0)
  await drag(page, [0, 0], [3, 3], true)
  await expect(page.getByTestId('kmap-expr')).toHaveText("f = B'D'")
  await page.getByRole('button', { name: 'בדוק' }).click()
  await expect(page.getByRole('status')).toContainText('נכון!')
  await expect(page.getByTestId('result-stars')).toHaveAttribute('aria-label', '3 מתוך 3 כוכבים')
})

test('k-map: grabbing a zero is flagged', async ({ page }) => {
  await page.goto('/#/room/sw-4-r1')
  await page.getByTestId('kcell-1-1').click()
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
