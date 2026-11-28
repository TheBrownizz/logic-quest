import { test, expect, type Page } from '@playwright/test'
import { emptySave, type SaveData } from '../../src/game/progress'
import { seed, unlockedSave, withLessonsDone } from './helpers'

// Runs against the build with the fake backend (VITE_E2E_FAKE=1); see playwright.config.ts.

const ROWS = 'lq-fake:saves'
const rows = (page: Page) => page.evaluate(k => JSON.parse(localStorage.getItem(k) ?? '{}') as Record<string, { data: SaveData; rev: number }>, ROWS)
const readKey = (page: Page, key: string) => page.evaluate(k => { const r = localStorage.getItem(k); return r ? JSON.parse(r) as SaveData : null }, key)
const solvedRooms = (s: SaveData | null) => Object.entries(s?.rooms ?? {}).filter(([, r]) => r.solved).map(([id]) => id)

async function signIn(page: Page, id = 'u1') {
  await page.evaluate(u => localStorage.setItem('lq-fake:next-user', u), id)
  await page.getByRole('button', { name: 'התחברות עם Google' }).first().click()
  await expect(page.getByLabel(/^החשבון של/)).toBeVisible()
}
async function signOut(page: Page) {
  await page.getByLabel(/^החשבון של/).click()
  await page.getByRole('button', { name: 'התנתקות' }).click()
  await expect(page.getByRole('button', { name: 'התחברות עם Google' }).first()).toBeVisible()
}
async function solveFirstRoom(page: Page) {
  await page.goto('/#/room/sw-1-r1')
  await page.getByTestId('number-input').fill('10110101')
  await page.getByRole('button', { name: 'בדוק' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'נכון!' })).toBeVisible()
}
/** Signs in as a guest with the lessons done (so rooms are open) and brings that progress into the account. */
async function signInWithLessons(page: Page, id = 'u1') {
  await signIn(page, id)
  await page.getByRole('dialog').getByRole('button', { name: 'צרף', exact: true }).click()
}
const synced = (page: Page) => expect(page.getByTestId('sync-badge')).toHaveAttribute('data-status', 'synced')

test('guest: a sign-in button, no sync badge, nothing changes without an account', async ({ page }) => {
  await seed(page, withLessonsDone(emptySave()))
  await page.goto('/#/')
  await expect(page.getByRole('button', { name: 'התחברות עם Google' })).toBeVisible()
  await expect(page.getByTestId('sync-badge')).toHaveCount(0)
  await expect(page.getByTestId('guest-nudge')).toHaveCount(0)
})

test('the nudge shows once after 3 solved rooms and stays dismissed', async ({ page }) => {
  await seed(page, unlockedSave())
  await page.goto('/#/')
  const nudge = page.getByTestId('guest-nudge')
  await expect(nudge).toContainText('התחבר כדי לשמור את ההתקדמות בכל מכשיר')
  await nudge.getByRole('button', { name: 'סגירת ההודעה' }).click()
  await expect(nudge).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('button', { name: 'התחברות עם Google' }).first()).toBeVisible()
  await expect(page.getByTestId('guest-nudge')).toHaveCount(0)
})

test('sign-in returns to the same screen, without the OAuth query', async ({ page }) => {
  await page.goto('/#/collection')
  await signIn(page)
  expect(page.url()).toMatch(/#\/collection$/)
  expect(new URL(page.url()).search).toBe('')
})

test('attach: guest progress joins the account and reaches the server', async ({ page }) => {
  await seed(page, unlockedSave())
  await page.goto('/#/')
  await signIn(page)
  const dlg = page.getByRole('dialog', { name: 'לצרף את ההתקדמות מהמכשיר הזה לחשבון?' })
  await expect(dlg).toBeVisible()
  await dlg.getByRole('button', { name: 'צרף', exact: true }).click()
  await expect(dlg).toHaveCount(0)
  await synced(page)
  await expect.poll(async () => solvedRooms((await rows(page)).u1?.data ?? null).length).toBeGreaterThan(5)
  expect(solvedRooms(await readKey(page, 'logic-quest-save:u1')).length).toBeGreaterThan(5)
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/task-3-header-signed-in.png`, clip: { x: 0, y: 0, width: 1280, height: 120 } })
})

test('keep as guest: nothing is merged, and the guest save is intact after signing out', async ({ page }) => {
  await seed(page, unlockedSave())
  await page.goto('/#/')
  const guestBefore = solvedRooms(await readKey(page, 'logic-quest-save')).length
  expect(guestBefore).toBeGreaterThan(5)
  await signIn(page)
  await page.getByRole('dialog').getByRole('button', { name: 'השאר כאורח' }).click()
  await synced(page)
  expect(solvedRooms(await readKey(page, 'logic-quest-save:u1'))).toEqual([])
  expect(solvedRooms((await rows(page)).u1.data)).toEqual([])
  await signOut(page)
  expect(solvedRooms(await readKey(page, 'logic-quest-save')).length).toBe(guestBefore)
  // the answer is remembered: signing in again does not ask again
  await signIn(page)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('Escape in the attach dialog keeps the progress as the guest\'s', async ({ page }) => {
  await seed(page, unlockedSave())
  await page.goto('/#/')
  await signIn(page)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(solvedRooms(await readKey(page, 'logic-quest-save:u1'))).toEqual([])
})

test('Review Focus 2: user B never sees user A\'s data on the same browser, and A\'s save survives', async ({ page }) => {
  await seed(page, withLessonsDone(emptySave()))
  await page.goto('/#/')
  await signInWithLessons(page, 'u1')
  await solveFirstRoom(page)
  await synced(page)
  await expect.poll(async () => solvedRooms((await rows(page)).u1?.data ?? null)).toEqual(['sw-1-r1'])
  await signOut(page)
  expect(solvedRooms(await readKey(page, 'logic-quest-save'))).toEqual([]) // the guest does not get A's progress
  await signIn(page, 'u2')
  await page.getByRole('dialog').getByRole('button', { name: 'השאר כאורח' }).click()
  await synced(page)
  expect(solvedRooms(await readKey(page, 'logic-quest-save:u2'))).toEqual([])
  expect(solvedRooms((await rows(page)).u2?.data ?? null)).toEqual([])
  await page.goto('/#/world/switching/stage/sw-1-numbers')
  await expect(page.getByTestId('room-row').filter({ hasText: 'מעבר לבינארי' })).not.toContainText('★')
  // A's own save is still there, and A gets it back
  expect(solvedRooms(await readKey(page, 'logic-quest-save:u1'))).toEqual(['sw-1-r1'])
  await signOut(page)
  await signIn(page, 'u1')
  await synced(page)
  await page.goto('/#/world/switching/stage/sw-1-numbers')
  await expect(page.getByTestId('room-row').filter({ hasText: 'מעבר לבינארי' })).toContainText('★')
})

test('a session survives a reload', async ({ page }) => {
  await page.goto('/#/')
  await signIn(page)
  await page.reload()
  await expect(page.getByLabel(/^החשבון של/)).toBeVisible()
  await synced(page)
})

test('reset while signed in clears the server save too (and bumps resetGen)', async ({ page }) => {
  await seed(page, withLessonsDone(emptySave()))
  await page.goto('/#/')
  await signInWithLessons(page)
  await solveFirstRoom(page)
  await synced(page)
  page.once('dialog', d => d.accept())
  await page.getByRole('button', { name: 'שמירה' }).click()
  await page.getByRole('button', { name: 'איפוס' }).click()
  await expect.poll(async () => (await rows(page)).u1?.data.resetGen).toBe(1)
  expect(solvedRooms((await rows(page)).u1.data)).toEqual([])
  expect(solvedRooms(await readKey(page, 'logic-quest-save:u1'))).toEqual([])
})

test('delete account: needs the word, removes the row and this user\'s save, keeps the guest\'s', async ({ page }) => {
  await seed(page, unlockedSave())
  await page.goto('/#/')
  const guestBefore = solvedRooms(await readKey(page, 'logic-quest-save')).length
  await signIn(page)
  await page.getByRole('dialog').getByRole('button', { name: 'השאר כאורח' }).click()
  await synced(page)
  await page.getByLabel(/^החשבון של/).click()
  await page.getByRole('button', { name: 'מחיקת חשבון' }).click()
  const dlg = page.getByRole('dialog', { name: 'מחיקת חשבון' })
  const confirm = dlg.getByRole('button', { name: 'מחיקה לצמיתות' })
  await expect(confirm).toBeDisabled()
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/task-3-delete-dialog.png` })
  await dlg.getByLabel('אישור מחיקה').fill('מחק')
  await expect(confirm).toBeEnabled()
  await confirm.click()
  await expect(page.getByRole('button', { name: 'התחברות עם Google' }).first()).toBeVisible()
  expect((await rows(page)).u1).toBeUndefined()
  expect(await readKey(page, 'logic-quest-save:u1')).toBeNull()
  expect(solvedRooms(await readKey(page, 'logic-quest-save')).length).toBe(guestBefore)
})

test('privacy page', async ({ page }) => {
  await page.goto('/#/privacy')
  await expect(page.getByRole('heading', { name: 'פרטיות', level: 1 })).toBeVisible()
  await expect(page.getByText('איך מוחקים')).toBeVisible()
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/task-3-privacy.png` })
})

test('the account menu works from the keyboard', async ({ page }) => {
  await page.goto('/#/')
  await signIn(page)
  const toggle = page.getByLabel(/^החשבון של/)
  await toggle.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'התנתקות' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'התנתקות' })).toHaveCount(0)
  await expect(toggle).toBeFocused()
})

test('screenshots: guest header and attach dialog', async ({ page }) => {
  test.skip(!process.env.SHOTS_DIR, 'only when SHOTS_DIR is set')
  await seed(page, unlockedSave())
  await page.goto('/#/')
  await page.screenshot({ path: `${process.env.SHOTS_DIR}/task-3-header-guest.png`, clip: { x: 0, y: 0, width: 1280, height: 120 } })
  await signIn(page)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.screenshot({ path: `${process.env.SHOTS_DIR}/task-3-attach-dialog.png` })
})
