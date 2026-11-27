import { test, expect } from '@playwright/test'
import { seed, unlockedSave } from './helpers'

test('no request leaves the origin; the fonts are served locally', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin
  const urls: string[] = []
  page.on('request', r => urls.push(r.url()))
  const save = unlockedSave()
  save.knowledge = ['sw-3-c3']
  await seed(page, save)
  for (const hash of ['#/', '#/world/switching/stage/sw-1-numbers', '#/room/sw-1-r5', '#/room/sw-3-r1', '#/collection']) {
    await page.goto(`/${hash}`)
    await page.waitForLoadState('networkidle')
  }
  expect(await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px Rubik', 'אבג') })).toBe(true)
  expect(await page.evaluate(() => document.fonts.check('16px "JetBrains Mono"', 'A1'))).toBe(true)
  const foreign = urls.filter(u => !u.startsWith('data:') && !u.startsWith('blob:') && new URL(u).origin !== origin)
  expect(foreign).toEqual([])
  expect(urls.some(u => /rubik.*\.woff2$/i.test(u))).toBe(true)
})
