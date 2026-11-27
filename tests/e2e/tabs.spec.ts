import { test, expect } from '@playwright/test'
import { SAVE_KEY, seed, unlockedSave } from './helpers'

test('two tabs: a stale tab keeps the other tab\'s solve, and sees it without a reload', async ({ context }) => {
  const save = unlockedSave(['sw-1-r1'])
  const b = await context.newPage()
  await seed(b, save)
  await b.goto('/#/room/sw-3-r1')
  await expect(b.getByTestId('palette-NAND')).toBeVisible()

  const a = await context.newPage()
  await seed(a, save)
  await a.goto('/#/room/sw-1-r1')
  await a.getByTestId('number-input').fill('10110101')
  await a.getByRole('button', { name: 'בדוק' }).click()
  await expect(a.getByRole('status')).toContainText('נכון!')

  // the storage event brings A's solve into B's screen without a reload or an edit
  await b.evaluate(() => { location.hash = '#/world/switching/stage/sw-1-numbers' })
  await expect(b.getByTestId('room-row').filter({ hasText: 'מעבר לבינארי' })).toContainText('★')

  // B's next edit re-reads storage first, so it can't write an old copy over A's solve
  await b.evaluate(() => { location.hash = '#/room/sw-3-r1' })
  await b.getByTestId('palette-NAND').click()
  const stored = await b.evaluate(k => JSON.parse(localStorage.getItem(k)!), SAVE_KEY)
  expect(stored.rooms['sw-1-r1']?.solved).toBe(true)
  expect(stored.drafts['sw-3-r1']).toBeDefined()
})
