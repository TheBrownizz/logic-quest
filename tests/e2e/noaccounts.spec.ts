import { test, expect } from '@playwright/test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { seed, unlockedSave } from './helpers'

// Runs against the normal build (no Supabase env vars): the game is exactly the guest game, with no account UI.
test('without env vars there is no account UI, no nudge, and no fake backend in the bundle', async ({ page }) => {
  await seed(page, unlockedSave())
  await page.goto('/#/')
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('button', { name: 'התחברות עם Google' })).toHaveCount(0)
  await expect(page.getByTestId('guest-nudge')).toHaveCount(0)
  await expect(page.getByTestId('sync-badge')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'שמירה' })).toBeVisible()
  // the production bundle (every file of dist, lazy chunks included) has no fake backend
  const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]))
  const all = files('dist')
  expect(all.length).toBeGreaterThan(3)
  for (const f of all.filter(f => /\.(js|html|css)$/.test(f))) expect(readFileSync(f, 'utf8'), f).not.toContain('lq-fake')
})

test('the privacy page is reachable by address', async ({ page }) => {
  await page.goto('/#/privacy')
  await expect(page.getByRole('heading', { name: 'פרטיות', level: 1 })).toBeVisible()
})
