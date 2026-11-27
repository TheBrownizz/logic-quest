import { test, expect } from '@playwright/test'
import { emptySave } from '../../src/game/progress'

test('export saves the in-memory progress even when storage writes fail', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('quota') } })
  await page.goto('/#/room/sw-1-r1')
  await page.getByTestId('number-input').fill('10110101')
  await page.getByRole('button', { name: 'בדוק' }).click()
  await expect(page.getByRole('status')).toContainText('נכון!')
  // capture the exported file's text as the page creates its download link
  await page.evaluate(() => {
    const w = window as unknown as { exported?: Promise<string> }
    const orig = URL.createObjectURL
    URL.createObjectURL = (b: Blob) => { w.exported = b.text(); return orig(b) }
  })
  await page.getByRole('button', { name: 'שמירה' }).click()
  await page.getByRole('button', { name: 'ייצוא' }).click()
  const text = await page.evaluate(() => (window as unknown as { exported: Promise<string> }).exported)
  expect(JSON.parse(text).rooms['sw-1-r1']?.solved).toBe(true)
})

test('import loads the file into the app before reporting success', async ({ page }) => {
  const save = emptySave()
  save.knowledge = ['sw-1-c1', 'sw-1-c2']
  await page.goto('/#/collection')
  await expect(page.getByTestId('collected')).toContainText('נאספו 0/')
  await page.getByRole('button', { name: 'שמירה' }).click()
  await page.getByLabel('קובץ שמירה').evaluate((input: HTMLInputElement, json) => {
    const dt = new DataTransfer()
    dt.items.add(new File([json], 'save.json', { type: 'application/json' }))
    input.files = dt.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, JSON.stringify(save))
  await expect(page.getByRole('dialog').getByRole('status')).toHaveText('השמירה נטענה בהצלחה')
  await page.getByRole('button', { name: 'סגירה' }).click()
  await expect(page.getByTestId('collected')).toContainText('נאספו 2/')
})
