import { test, expect } from '@playwright/test'
import { seed, unlockedSave } from './helpers'

// Runs against the normal build (no Supabase env vars): the game is exactly the guest game, with no account UI.
test('without env vars there is no account UI, no nudge, and no fake backend in the bundle', async ({ page, request }) => {
  await seed(page, unlockedSave())
  const scripts: string[] = []
  page.on('response', r => { if (r.url().endsWith('.js')) scripts.push(r.url()) })
  await page.goto('/#/')
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('button', { name: 'התחברות עם Google' })).toHaveCount(0)
  await expect(page.getByTestId('guest-nudge')).toHaveCount(0)
  await expect(page.getByTestId('sync-badge')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'שמירה' })).toBeVisible()
  for (const u of scripts) expect(await (await request.get(u)).text()).not.toContain('lq-fake')
})

test('the privacy page is reachable by address', async ({ page }) => {
  await page.goto('/#/privacy')
  await expect(page.getByRole('heading', { name: 'פרטיות', level: 1 })).toBeVisible()
})
