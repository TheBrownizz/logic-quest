import { test, expect } from '@playwright/test'
import { switchingWorld } from '../../src/content/switching/world'

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

test('locked stage cannot be entered and says how many rooms are missing', async ({ page }) => {
  await page.goto('/#/world/switching/stage/sw-4-minimize')
  await expect(page.getByTestId('lock-note')).toContainText('פתור עוד 5 חדרים בשלב הקודם')
  await expect(page.getByRole('link', { name: 'ריצת חקירה' })).toHaveCount(0)
  await page.goto('/#/world/switching')
  await expect(page.getByTestId('stage-sw-2-arith')).toContainText('עוד 5 חדרים')
})

test('a room of a locked stage, opened by URL, shows the lock and a way back', async ({ page }) => {
  await page.goto('/#/room/sw-3-r1')
  await expect(page.getByTestId('lock-note')).toContainText('פתור עוד 5 חדרים בשלב הקודם')
  await expect(page.getByTestId('palette-NAND')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'בדוק' })).toHaveCount(0)
  await page.getByRole('link', { name: /→/ }).click()
  await expect(page).toHaveURL(/#\/world\/switching\/stage\/sw-3-boolean$/)
})

test('save menu opens, collection route', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'שמירה' }).click()
  await expect(page.getByRole('button', { name: 'ייצוא' })).toBeVisible()
  await page.goto('/#/collection')
  await expect(page.getByTestId('collected')).toContainText('נאספו 0/')
})

const seed = (rooms: Record<string, { solved: boolean; optimal: boolean; noHints: boolean }>) =>
  JSON.stringify({ version: 1, rooms, chips: {}, drafts: {}, knowledge: [], bestRun: {}, flagged: [] })

test('NAND half adder room: autofill, check, stars on the stage screen', async ({ page }) => {
  const done = { solved: true, optimal: true, noHints: true }
  await page.addInitScript(s => {
    if (!sessionStorage.getItem('seeded')) { localStorage.setItem('logic-quest-save', s); sessionStorage.setItem('seeded', '1') }
  }, seed(Object.fromEntries(switchingWorld.stages.filter(s => s.order <= 2).flatMap(s => s.rooms.map(r => [r.id, done])))))
  await page.goto('/#/world/switching/stage/sw-3-boolean')
  await page.getByTestId('room-row').filter({ hasText: 'מחבר למחצה מ-NAND' }).click()
  await expect(page.getByRole('heading', { name: 'מחבר למחצה מ-NAND' })).toBeVisible()
  await page.goto('/?autofill=1#/room/sw-3-r1')
  await page.getByRole('button', { name: 'בדוק' }).click()
  await expect(page.getByText('נכון!')).toBeVisible()
  await expect(page.getByTestId('result-stars')).toHaveAttribute('aria-label', /^[123] מתוך 3/)
  await page.getByRole('link', { name: /אלגברה בוליאנית ושערים/ }).click()
  await expect(page.getByTestId('room-row').filter({ hasText: 'מחבר למחצה מ-NAND' })).toContainText('★')
})
