import { test, expect, type Page } from '@playwright/test'
import { readSave, seed, unlockedSave } from './helpers'
import { switchingWorld } from '../../src/content/switching/world'
import { tableOf, usedRows, waveAnswer } from '../../src/ui/lab/seqLogic'
import type { LabPuzzle } from '../../src/content/types'
import { emptySave, type SaveData } from '../../src/game/progress'

type P<T extends LabPuzzle['type']> = Extract<LabPuzzle, { type: T }>
const room = (id: string) => switchingWorld.stages.flatMap(s => s.rooms).find(r => r.id === id)!
const bank = switchingWorld.boss!.bank
/** Every room of stages 1–8 solved and every lesson done: all stages and the boss are open. */
const allOpen = (): SaveData => unlockedSave([], 9)

async function typeBits(page: Page, firstCell: string, bits: string) {
  await page.getByTestId(firstCell).focus()
  for (const b of bits) await page.keyboard.press(b)
}
const solved = async (page: Page) => {
  await page.getByRole('button', { name: 'בדוק' }).click()
  await expect(page.getByRole('status')).toContainText('נכון!')
}

test.describe('sequential rooms', () => {
  test.beforeEach(async ({ page }) => { await seed(page, allOpen()) })

  test('waveform: a wrong Q column is marked, then Q drawn from the keyboard is accepted (JK toggles at J = K = 1)', async ({ page }) => {
    await page.goto('/#/room/sw-6-r1')
    const q = waveAnswer(room('sw-6-r1').puzzle as P<'waveform'>)
    const wrong = q.map((v, i) => (i === 1 ? 1 - v : v)).join('')
    await typeBits(page, 'wave-q-0', wrong)
    await page.getByRole('button', { name: 'בדוק' }).click()
    await expect(page.getByRole('alert')).toContainText('לא נכון')
    await expect(page.getByTestId('wave-q-1')).toHaveClass(/err/)
    await typeBits(page, 'wave-q-0', q.join(''))
    await solved(page)
    await expect(page.getByTestId('result-stars')).toHaveAttribute('aria-label', '3 מתוך 3 כוכבים')
  })

  test('identify: the schematic is drawn and the right option solves the room', async ({ page }) => {
    await page.goto('/#/room/sw-6-r2')
    await expect(page.getByTestId('schematic')).toBeVisible()
    const p = room('sw-6-r2').puzzle as P<'identify'>
    await page.getByTestId(`identify-opt-${p.correct}`).click()
    await solved(page)
  })

  test('state-table: filled from the equations, cell by cell', async ({ page }) => {
    await page.goto('/#/room/sw-7-r1')
    await expect(page.getByTestId('given-equations')).toBeVisible()
    const t = tableOf((room('sw-7-r1').puzzle as P<'state-table'>).machine)
    const bits = usedRows(t).map(r => r.next!.toString(2).padStart(2, '0') + String(r.out)).join('')
    await typeBits(page, 'st-0-next-0', bits)
    await solved(page)
  })

  test('Review Focus 2: fsm-equations accepts an answer that uses the don\'t-cares differently (no optimum star)', async ({ page }) => {
    await page.goto('/#/room/sw-8-r1')
    await page.getByTestId('eq-DA').fill("AB'X' + A'BX")
    await page.getByTestId('eq-DB').fill("A'B'X + A'BX'")
    await page.getByTestId('eq-Z').fill("A'")
    await page.getByRole('button', { name: 'בדוק' }).click()
    await expect(page.getByTestId('eq-msg-Z')).toContainText('שגוי בשורה')
    await page.getByTestId('eq-Z').fill("AB'")
    await solved(page)
    await expect(page.getByRole('status')).toContainText('14 ליטרלים · מינימום 10')
    await expect(page.getByTestId('result-stars')).toHaveAttribute('aria-label', '2 מתוך 3 כוכבים')
  })

  test('fsm-equations: the k-map helper writes its cover into the equation', async ({ page }) => {
    await page.goto('/#/room/sw-8-r1')
    await page.getByTestId('seq-kmap').waitFor({ state: 'detached' })
    await page.locator('.seq-eq-row').filter({ has: page.getByTestId('eq-Z') }).getByRole('button', { name: 'מפת קרנו' }).click()
    const map = page.getByTestId('seq-kmap')
    // Z = 1 on m4, m5 (A B' = 10 row), don't-cares m6, m7: one group of the whole A = 1 half
    await map.getByRole('button', { name: 'בחירת תאים' }).click()
    for (const m of [4, 5, 6, 7]) await map.getByRole('button', { name: new RegExp(`^תא ${m},`) }).click()
    await map.getByRole('button', { name: 'קבע קבוצה' }).click()
    await map.getByRole('button', { name: 'בדוק' }).click()
    await expect(page.getByTestId('eq-Z')).toHaveValue('A')
  })

  test('Review Focus 3: state-reduce accepts the partition whatever the group letters', async ({ page }) => {
    await page.goto('/#/room/sw-8-r2')
    // S1 ≡ S3 and S2 ≡ S4, in groups ה and א; S0 moved to ג
    await page.getByTestId('reduce-0-2').click()
    await page.getByTestId('reduce-1-4').click()
    await page.getByTestId('reduce-3-4').click()
    await page.getByTestId('reduce-2-0').click()
    await page.getByTestId('reduce-4-0').click()
    await solved(page)
    await expect(page.getByRole('status')).toContainText('נשארו 3 מצבים')
  })

  test('the waveform room fits 400px with no page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 800 })
    await page.goto('/#/room/sw-6-r1')
    await expect(page.getByTestId('waveform')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(400)
  })
})

test.describe('Review Focus 5: stages 6–8 and the boss lock and unlock', () => {
  test('a v1 save plus lessons opens stage 6 only; the boss is locked', async ({ page }) => {
    await seed(page, unlockedSave([], 6))
    await page.goto('/#/world/switching')
    await expect(page.getByTestId('stage-sw-6-latches')).toHaveAttribute('data-locked', 'false')
    await expect(page.getByTestId('stage-sw-7-fsm')).toHaveAttribute('data-locked', 'true')
    await expect(page.getByTestId('stage-sw-8-design')).toHaveAttribute('data-locked', 'true')
    await expect(page.getByTestId('boss-node')).toHaveAttribute('data-locked', 'true')
    await page.goto('/#/boss')
    await expect(page.getByTestId('boss-lock')).toBeVisible()
  })

  test('a plain v1 save (no lessons, openStages or exams fields) still loads and keeps stage 6 locked', async ({ page }) => {
    const v1 = { version: 1, rooms: { 'sw-1-r1': { solved: true, optimal: true, noHints: true } }, chips: {}, drafts: {}, knowledge: [], bestRun: {}, flagged: [] }
    await seed(page, v1 as unknown as SaveData)
    await page.goto('/#/world/switching')
    await expect(page.getByTestId('stage-sw-6-latches')).toHaveAttribute('data-locked', 'true')
    await expect(page.getByTestId('boss-node')).toHaveAttribute('data-locked', 'true')
  })

  test('solving the stage-6 rooms opens stage 7, solving stage 7 opens stage 8, and the boss waits for stage 8', async ({ page }) => {
    const s = unlockedSave([], 6)
    for (const id of ['sw-6-r1', 'sw-6-r2']) s.rooms[id] = { solved: true, optimal: false, noHints: false }
    await seed(page, s)
    await page.goto('/#/world/switching')
    await expect(page.getByTestId('stage-sw-7-fsm')).toHaveAttribute('data-locked', 'false')
    await expect(page.getByTestId('stage-sw-8-design')).toHaveAttribute('data-locked', 'true')
    await page.goto('/#/room/sw-7-r1')
    const t = tableOf((room('sw-7-r1').puzzle as P<'state-table'>).machine)
    await typeBits(page, 'st-0-next-0', usedRows(t).map(r => r.next!.toString(2).padStart(2, '0') + String(r.out)).join(''))
    await solved(page)
    await page.goto('/#/world/switching')
    await expect(page.getByTestId('stage-sw-8-design')).toHaveAttribute('data-locked', 'false')
    await expect(page.getByTestId('boss-node')).toHaveAttribute('data-locked', 'true')
  })

  test('the map shows the best exam score and the badge at 80 or more', async ({ page }) => {
    const s = allOpen()
    s.exams = { attempts: [{ at: 1, score: 72, perTopic: [20, 15, 17, 20] }, { at: 2, score: 84, perTopic: [25, 20, 20, -1], mode: 'short' }] }
    await seed(page, s)
    await page.goto('/#/world/switching')
    await expect(page.getByTestId('boss-node')).toHaveAttribute('data-locked', 'false')
    await expect(page.getByTestId('boss-best-score')).toHaveText('שיא 84/100')
    await expect(page.getByTestId('boss-ready')).toHaveText('מוכן למבחן')
  })
})

test.describe('the mock exam', () => {
  test('Review Focus 4: short mode with a mocked clock; time-out scores what was answered and saves the attempt', async ({ page }) => {
    await page.clock.install()
    await seed(page, allOpen())
    await page.goto('/#/boss')
    await page.getByTestId('start-short').click()
    await page.getByTestId('exam-start').click()
    await expect(page.getByTestId('exam-timer')).toHaveText(/^(60:00|59:5\d)$/)
    await page.getByTestId('exam-tab-1').click()
    const panel = page.getByTestId('exam-q-1')
    const qid = await panel.locator('article').getAttribute('data-qid')
    const q = bank.find(x => x.id === qid)!
    expect(q.topic).toBe(4)
    await panel.getByTestId(`verdict-${q.b.isTrue}`).click()
    await panel.getByTestId(`reason-${q.b.correctReason}`).click()
    await panel.getByTestId(`mcq-opt-${q.c.correct}`).click()
    await expect(page.getByTestId('exam-tab-1')).toContainText('2/3')
    await page.clock.fastForward('59:00')
    await expect(page.getByTestId('exam-timer')).toHaveText(/^0[01]:/)
    await page.clock.fastForward('01:05')
    await expect(page.getByTestId('exam-results')).toBeVisible()
    await expect(page.getByText('הזמן נגמר')).toBeVisible()
    // 15 of 50 points, scaled to 100
    await expect(page.getByTestId('exam-score')).toHaveText('30')
    await expect(page.getByTestId('ready-badge')).toHaveCount(0)
    await expect(page.getByTestId('exam-breakdown').locator('tbody tr')).toHaveCount(2)
    await expect(page.getByTestId('review-0').getByRole('link').first()).toBeVisible()
    const save = await readSave(page)
    expect(save.exams.attempts).toHaveLength(1)
    expect(save.exams.attempts[0]).toMatchObject({ score: 30, mode: 'short' })
    expect(save.exams.attempts[0].perTopic[3]).toBe(15)
  })

  test('Review Focus 4: a reload mid-exam discards the attempt and comes back to the start page', async ({ page }) => {
    await seed(page, allOpen())
    await page.goto('/#/exam/full')
    await page.getByTestId('exam-start').click()
    await page.getByTestId('exam-q-0').getByTestId('verdict-true').click()
    await page.reload()
    await expect(page.getByTestId('exam-start')).toBeVisible()
    expect((await readSave(page)).exams?.attempts ?? []).toEqual([])
  })

  test('a full exam submitted with every ב and ג right scores 60 and shows the per-topic breakdown', async ({ page }) => {
    await seed(page, allOpen())
    await page.goto('/#/exam/full')
    await page.getByTestId('exam-start').click()
    for (let i = 0; i < 4; i++) {
      await page.getByTestId(`exam-tab-${i}`).click()
      const panel = page.getByTestId(`exam-q-${i}`)
      const qid = await panel.locator('article').getAttribute('data-qid')
      const q = bank.find(x => x.id === qid)!
      await panel.getByTestId(`verdict-${q.b.isTrue}`).click()
      await panel.getByTestId(`reason-${q.b.correctReason}`).click()
      await panel.getByTestId(`mcq-opt-${q.c.correct}`).click()
    }
    await page.getByTestId('exam-submit').click()
    await page.getByTestId('exam-submit-confirm').click()
    await expect(page.getByTestId('exam-score')).toHaveText('60')
    await expect(page.getByTestId('exam-breakdown').locator('tbody tr')).toHaveCount(4)
    await page.getByRole('link', { name: /חזרה לדף המבחן/ }).click()
    await expect(page.getByTestId('boss-best')).toContainText('60')
  })

  test('the exam is locked until stage 8 is 60% solved', async ({ page }) => {
    await seed(page, emptySave())
    await page.goto('/#/exam/short')
    await expect(page.getByTestId('boss-lock')).toBeVisible()
    await expect(page.getByTestId('exam-start')).toHaveCount(0)
  })
})
