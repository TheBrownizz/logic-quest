import { test, expect, type Locator } from '@playwright/test'
import { seed, unlockedSave } from './helpers'

/**
 * Checks that `formula`, found inside `el`, is laid out left to right in source order on one line:
 * every visible character sits to the right of the one before it. In an RTL paragraph without
 * an LTR isolate, parts of the formula swap places and this fails.
 */
async function expectLtr(el: Locator, formula: string) {
  const xs = await el.evaluate((root, f) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = (n.textContent ?? '').replace(/\u00A0/g, ' ')
      const at = t.indexOf(f)
      if (at < 0) continue
      const out: Array<[number, number]> = []
      for (let i = 0; i < f.length; i++) {
        if (f[i] === ' ') continue
        const r = document.createRange()
        r.setStart(n, at + i); r.setEnd(n, at + i + 1)
        const b = r.getBoundingClientRect()
        out.push([b.left + b.width / 2, b.top])
      }
      return out
    }
    return null
  }, formula)
  expect(xs, `"${formula}" not found as one text run`).not.toBeNull()
  for (let i = 1; i < xs!.length; i++) {
    expect(xs![i][1], `"${formula}" wraps onto another line`).toBe(xs![0][1])
    expect(xs![i][0], `"${formula}" char ${i} is out of order`).toBeGreaterThan(xs![i - 1][0])
  }
}

const shot = (el: Locator, name: string) => el.screenshot({ path: test.info().outputPath(`${name}.png`) })

test.beforeEach(async ({ page }) => {
  const save = unlockedSave()
  save.knowledge = ['sw-3-c3', 'sw-3-c8']
  await seed(page, save)
})

test('sw-1-r5 intro: the base equation reads left to right', async ({ page }) => {
  await page.goto('/#/room/sw-1-r5')
  const intro = page.locator('.intro')
  await expect(intro).toHaveAttribute('dir', 'rtl')
  await expectLtr(intro, '(5)_r · (6)_r = (36)_r')
  await shot(intro, 'sw-1-r5')
})

test('sw-2-r8 definition: each line is its own block and formulas read left to right', async ({ page }) => {
  await page.goto('/#/room/sw-2-r8')
  const def = page.getByTestId('code-def')
  await expect(def.locator('.line')).toHaveCount(3)
  const q4 = def.locator('.line').nth(1)
  await expect(q4).toHaveAttribute('dir', 'ltr')
  await expectLtr(q4, "q4 = b4'")
  await expectLtr(def.locator('.line').nth(2), "q_i = (b_i ⊕ b_(i+1))·b4' + b_i·b4")
  await expectLtr(def.locator('.line').nth(2), '0 ≤ i ≤ 3')
  await expectLtr(def.locator('.line').nth(0), 'b4b3b2b1b0')
  await shot(def, 'sw-2-r8')
})

test('sw-3-c3 and sw-3-c8 knowledge cards: formulas read left to right', async ({ page }) => {
  await page.goto('/#/collection')
  const c3 = page.getByTestId('kcard').filter({ hasText: 'דה-מורגן' })
  await expect(c3.locator('.k-text')).toHaveAttribute('dir', 'rtl')
  await expectLtr(c3.locator('.k-q'), "(A·B)' = A' + B'")
  await expectLtr(c3.locator('.k-text'), "(A·B)' = A' + B'")
  await expectLtr(c3.locator('.k-text'), "(A + B)' = A'·B'")
  await shot(c3, 'sw-3-c3')
  const c8 = page.getByTestId('kcard').filter({ hasText: '16' })
  await expectLtr(c8.locator('.k-text'), '2^4 = 16')
  await shot(c8, 'sw-3-c8')
})

test('sw-1-r4 hints and the sw-2-r4 IEEE hint: spaced bit groups read in source order', async ({ page }) => {
  await page.goto('/#/room/sw-1-r4')
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /רמז/ }).click()
  const hints = page.getByTestId('hint')
  await expectLtr(hints.nth(1), '0111 1010 0011')
  await expectLtr(hints.nth(2), '011 110 100 011')
  await shot(hints.nth(2), 'sw-1-r4-hint')
  await page.goto('/#/room/sw-2-r4')
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /רמז/ }).click()
  await expectLtr(page.getByTestId('hint').nth(2), '1 | 10000001 | 1011000…')
  await expectLtr(page.getByTestId('hint').nth(2), '1100 0000 1101 1000')
})
