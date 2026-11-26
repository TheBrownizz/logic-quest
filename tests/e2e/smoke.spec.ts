import { test, expect } from '@playwright/test'

test('map -> world -> stage path, rtl', async ({ page }) => {
  await page.goto('/')
  expect(await page.evaluate(() => document.dir)).toBe('rtl')
  await page.getByText('מיתוג ותכנון לוגי').first().click()
  await expect(page.getByTestId('stage-sw-1-numbers')).toHaveAttribute('data-locked', 'false')
  await expect(page.getByTestId('stage-sw-1-numbers')).toContainText('מספרים ובסיסים')
  await expect(page.getByTestId('stage-sw-4-minimize')).toHaveAttribute('data-locked', 'true')
  await expect(page.getByTestId('stage-sw-4-minimize')).toContainText('מינימיזציה')
})

test('disabled worlds say soon; stage screen lists rooms and run button', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('בקרוב')).toHaveCount(4)
  await page.goto('/#/world/switching/stage/sw-1-numbers')
  await expect(page.getByRole('link', { name: 'ריצת חקירה' })).toHaveAttribute('href', '#/run/sw-1-numbers')
  await expect(page.getByTestId('room-row').first()).toContainText('☆☆☆')
})

test('locked stage cannot be entered', async ({ page }) => {
  await page.goto('/#/world/switching/stage/sw-4-minimize')
  await expect(page.getByText('פתור 60% מהשלב הקודם')).toBeVisible()
  await expect(page.getByRole('link', { name: 'ריצת חקירה' })).toHaveCount(0)
})

test('save menu opens, placeholder routes', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'שמירה' }).click()
  await expect(page.getByRole('button', { name: 'ייצוא' })).toBeVisible()
  await page.goto('/#/collection')
  await expect(page.getByText('בבנייה')).toBeVisible()
})
