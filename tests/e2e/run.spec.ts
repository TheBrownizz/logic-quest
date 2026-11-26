import { test, expect, type Page } from '@playwright/test'
import { buildDeck } from '../../src/game/deck'
import { startRun, mulberry32 } from '../../src/game/run'
import { switchingWorld } from '../../src/content/switching/world'
import { emptySave } from '../../src/game/progress'
import type { Card } from '../../src/content/types'

const save = emptySave()
// unlock stage 4: solve every room of stages 1–3 (a stage opens at 60% of the previous one)
for (const s of switchingWorld.stages.filter(s => s.order <= 3)) for (const r of s.rooms) save.rooms[r.id] = { solved: true, optimal: false, noHints: false }
const deck = startRun(buildDeck(switchingWorld, 'sw-4-minimize', save)!, mulberry32(1)).deck

test.beforeEach(async ({ page }) => {
  await page.addInitScript(s => {
    if (!sessionStorage.getItem('seeded')) { localStorage.setItem('logic-quest-save', s); sessionStorage.setItem('seeded', '1') }
  }, JSON.stringify(save))
})

async function play(page: Page, c: Card, correct: boolean, opts?: { expectMult?: string }) {
  if (c.kind === 'claim') {
    await page.getByTestId(`verdict-${correct ? c.isTrue : !c.isTrue}`).click()
    await page.getByTestId(`opt-${correct ? c.correctReason : (c.correctReason + 1) % c.reasons.length}`).click()
  } else {
    await page.getByTestId(`opt-${correct ? c.correct : (c.correct + 1) % 6}`).click()
  }
  await expect(page.getByTestId('reveal')).toBeVisible()
  if (correct && opts?.expectMult) await expect(page.getByTestId('multiplier')).toHaveText(opts.expectMult)
  await page.getByRole('button', { name: 'הבא' }).click()
}

test('run: correct gives x2, a mistake costs a life and lands in the collection', async ({ page }) => {
  await page.goto('/?seed=1#/run/sw-4-minimize')
  await expect(page.getByTestId('progress')).toContainText(`קלף 1/${deck.length}`)
  await play(page, deck[0], true, { expectMult: '×2' }) // HUD already shows ×2 before pressing הבא
  await expect(page.getByTestId('multiplier')).toHaveText('×2')
  await expect(page.getByTestId('score')).toHaveAttribute('data-score', '100')
  await play(page, deck[1], false)
  await expect(page.getByTestId('lives').locator('.heart.on')).toHaveCount(2)
  await expect(page.getByTestId('multiplier')).toHaveText('×1')
  await page.goto('/#/collection')
  await expect(page.getByTestId('collected')).toContainText('נאספו 1/')
  await expect(page.getByText(deck[1].knowledge)).toBeVisible()
  await expect(page.getByText(deck[0].knowledge)).toHaveCount(0)
  const flag = page.getByRole('button', { name: '⚑ נראה שגוי' }).first()
  await flag.click()
  await expect(page.getByRole('button', { name: 'סומן ✓' })).toBeVisible()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('logic-quest-save')!))
  expect(saved.flagged).toEqual([deck[1].id])
  expect(saved.knowledge).toEqual([deck[1].id])
})

test('run: finishing shows end screen with best score, rerun works', async ({ page }) => {
  await page.goto('/?seed=1#/run/sw-4-minimize')
  for (const c of deck) await play(page, c, true)
  await expect(page.getByTestId('end')).toBeVisible()
  await expect(page.getByText('שיא חדש!')).toBeVisible()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('logic-quest-save')!))
  expect(saved.bestRun['sw-4-minimize']).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'עוד ריצה' }).click()
  await expect(page.getByTestId('progress')).toContainText(`קלף 1/${deck.length}`)
})

test('run: locked stage shows a lock message', async ({ page }) => {
  await page.goto('/#/run/sw-5-blocks')
  await expect(page.getByText('השלב נעול')).toBeVisible()
})
