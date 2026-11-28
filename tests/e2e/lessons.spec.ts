import { test, expect, type Page } from '@playwright/test'
import { lessonsForStage } from '../../src/content/lessons/catalog'
import type { Step } from '../../src/content/lessons/types'
import { emptySave, type SaveData } from '../../src/game/progress'
import { readSave, seed } from './helpers'
import { completeStep, expectStep, lessonUrl, needsAutofill, playLesson } from './lessonWalk'

// Engine tests run on the first lesson of stage 1 (data-driven, so they keep working when its content changes).
const STAGE = 'sw-1-numbers'
const STAGE_URL = `/#/world/switching/stage/${STAGE}`
const lessons = lessonsForStage(STAGE)
const lesson = lessons[0]
const others = lessons.slice(1)
/** A save in which every stage-1 lesson except the first is done, so finishing the first opens the rooms. */
const othersDone = (): SaveData => ({
  ...emptySave(), lessons: Object.fromEntries(others.map(l => [l.id, { stepId: l.steps[0].id, done: true }])),
})
const firstOf = <K extends Step['kind']>(kind: K) => {
  const i = lesson.steps.findIndex(s => s.kind === kind)
  return { i, step: lesson.steps[i] as Extract<Step, { kind: K }> }
}
const noHorizontalScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)

test('a new player: the stage shows "למד", and rooms and run are locked until the lessons are done', async ({ page }) => {
  await page.goto(STAGE_URL)
  await expect(page.getByRole('heading', { name: 'למד' })).toBeVisible()
  const card = page.getByTestId(`lesson-card-${lesson.id}`)
  await expect(card).toContainText(lesson.title)
  await expect(card).toContainText(`${lesson.minutes} דק׳`)
  await expect(card.getByTestId('lesson-status')).toHaveText('חדש')
  await expect(page.getByTestId('lessons-lock-note')).toHaveText(/השלימו את השיעורים כדי לפתוח את החדרים/)
  await expect(page.getByRole('link', { name: 'ריצת חקירה' })).toHaveCount(0)
  await expect(page.getByTestId('run-locked')).toBeVisible()
  await expect(page.getByTestId('room-row').first()).toHaveAttribute('data-locked', 'true')
  await expect(page.locator('a.room-row')).toHaveCount(0)
  // a room or the run opened by URL shows the lock too
  await page.goto('/#/room/sw-1-r1')
  await expect(page.getByTestId('lessons-lock-note')).toBeVisible()
  await expect(page.getByTestId('number-input')).toHaveCount(0)
  await page.goto('/#/run/sw-1-numbers')
  await expect(page.getByTestId('lessons-lock-note')).toBeVisible()
  await expect(page.getByTestId('hud')).toHaveCount(0)
})

test('the sample lesson from start to finish opens the rooms, with a small unlock moment', async ({ page }) => {
  await seed(page, othersDone())
  await page.goto(STAGE_URL)
  await page.getByTestId(`lesson-card-${lesson.id}`).locator('a.lesson-main').click()
  await expect(page).toHaveURL(new RegExp(`#/lesson/${lesson.id}/${lesson.steps[0].id}$`))
  await expect(page.getByTestId('lesson-dots').locator('li')).toHaveCount(lesson.steps.length)
  if (lesson.steps.some(needsAutofill)) await page.goto(lessonUrl(lesson))
  await playLesson(page, lesson)
  await expect(page.getByTestId('unlock-moment')).toBeVisible()
  const saved = (await readSave(page)).lessons[lesson.id]
  expect(saved).toEqual({ stepId: lesson.steps[lesson.steps.length - 1].id, done: true })
  await page.getByTestId('to-rooms').click()
  await expect(page).toHaveURL(new RegExp(`#/world/switching/stage/${STAGE}\\?unlocked=1$`))
  await expect(page.getByTestId('rooms')).toHaveClass(/just-unlocked/)
  await expect(page.getByTestId(`lesson-card-${lesson.id}`).getByTestId('lesson-status')).toHaveText('הושלם')
  await expect(page.getByRole('link', { name: 'ריצת חקירה' })).toBeVisible()
  await page.locator('a.room-row').first().click()
  await expect(page.getByTestId('number-input')).toBeVisible()
})

test('a check: a wrong option shows its own feedback and retry is free; double "המשך" moves one step', async ({ page }) => {
  const { i, step } = firstOf('check')
  expect(i, 'the lesson needs a check step').toBeGreaterThanOrEqual(0)
  const saved = { ...emptySave(), lessons: { [lesson.id]: { stepId: step.id, done: false } } }
  await seed(page, saved)
  await page.goto(`/#/lesson/${lesson.id}`)
  await expectStep(page, step)
  const next = page.getByTestId('lesson-next')
  await expect(next).toBeDisabled()
  const wrong = (step.correct + 1) % step.options.length
  await page.getByTestId(`check-opt-${wrong}`).click()
  await expect(page.getByTestId('check-feedback')).toHaveClass(/bad/)
  await expect(page.getByTestId('check-feedback')).toContainText(step.feedback[wrong])
  await expect(next).toBeDisabled()
  await page.getByTestId(`check-opt-${step.correct}`).click()
  await expect(page.getByTestId('check-feedback')).toContainText(step.feedback[step.correct])
  await page.getByTestId(`check-opt-${step.correct}`).click({ force: true }) // a second answer changes nothing
  await next.dblclick()
  await expectStep(page, lesson.steps[i + 1])
  // back and forward again over completed steps is free
  await page.getByTestId('lesson-back').click()
  await expectStep(page, step)
  await expect(page.getByTestId(`check-opt-${step.correct}`)).toHaveClass(/right/)
  await expect(next).toBeEnabled()
  await next.click()
  await expectStep(page, lesson.steps[i + 1])
})

test('Review Focus 3: a double click on "המשך" moves exactly one step', async ({ page }) => {
  // a done lesson has every step complete, so this works whatever the lesson's steps are
  expect(lesson.steps.length).toBeGreaterThanOrEqual(3)
  await seed(page, { ...emptySave(), lessons: { [lesson.id]: { stepId: lesson.steps[0].id, done: true } } })
  await page.goto(`/#/lesson/${lesson.id}`)
  await expectStep(page, lesson.steps[0])
  await page.getByTestId('lesson-next').dblclick() // both clicks in one task
  await expectStep(page, lesson.steps[1])
  await page.waitForTimeout(500)
  await expectStep(page, lesson.steps[1])
  await page.getByTestId('lesson-back').click()
  await expectStep(page, lesson.steps[0])
  // a human double click: the page re-renders between the two clicks (the second has click count 2)
  const next = page.getByTestId('lesson-next')
  await next.dispatchEvent('click', { detail: 1 })
  await expectStep(page, lesson.steps[1])
  await next.dispatchEvent('click', { detail: 2 })
  await page.waitForTimeout(300)
  await expectStep(page, lesson.steps[1])
})

test('a reload mid-lesson resumes at the same step', async ({ page }) => {
  await page.goto(lessonUrl(lesson))
  const stop = Math.min(3, lesson.steps.length - 2)
  for (let i = 0; i < stop; i++) {
    await expectStep(page, lesson.steps[i])
    await completeStep(page, lesson.steps[i])
    await page.getByTestId('lesson-next').click()
  }
  const at = lesson.steps[stop]
  await expectStep(page, at)
  expect((await readSave(page)).lessons[lesson.id].stepId).toBe(at.id)
  await expect(page).toHaveURL(new RegExp(`#/lesson/${lesson.id}/${at.id}$`))
  await page.reload()
  await expectStep(page, at)
  // and from the stage screen's card too
  await page.goto(STAGE_URL)
  await expect(page.getByTestId(`lesson-card-${lesson.id}`).getByTestId('lesson-status')).toHaveText('בתהליך')
  await page.getByTestId(`lesson-card-${lesson.id}`).locator('a.lesson-main').click()
  await expectStep(page, at)
})

test('a saved step that no longer exists resumes at step 1', async ({ page }) => {
  await seed(page, { ...emptySave(), lessons: { [lesson.id]: { stepId: 'removed-step', done: false } } })
  await page.goto(`/#/lesson/${lesson.id}`)
  await expectStep(page, lesson.steps[0])
  // a URL naming a step past the saved one opens the saved one
  await page.goto(`/#/lesson/${lesson.id}/${lesson.steps[lesson.steps.length - 1].id}`)
  await expectStep(page, lesson.steps[0])
})

/** Answers the quiz question on screen: correctly, or with the first wrong option. */
async function answerQuiz(page: Page, correct: boolean) {
  const qid = await page.getByTestId('quiz-q').getAttribute('data-qid')
  const q = lesson.skipQuiz.find(x => x.id === qid)!
  await page.getByTestId(`quiz-opt-${correct ? q.correct : (q.correct + 1) % q.options.length}`).click()
}

test('skip quiz pass: 4 right answers mark the lesson skipped and open the rooms', async ({ page }) => {
  await seed(page, othersDone())
  await page.goto(STAGE_URL)
  await page.getByTestId(`lesson-card-${lesson.id}`).getByRole('link', { name: 'כבר מכיר? מבחן דילוג' }).click()
  await expect(page.getByTestId('quiz')).toBeVisible()
  const seen = new Set<string>()
  for (let k = 1; k <= 4; k++) {
    await expect(page.getByTestId('quiz-progress')).toHaveText(`${k}/4`)
    seen.add((await page.getByTestId('quiz-q').getAttribute('data-qid'))!)
    await answerQuiz(page, true)
    if (k < 4) await page.getByTestId('quiz-next').click()
  }
  expect(seen.size).toBe(4)
  await expect(page.getByTestId('quiz-passed')).toBeVisible()
  await expect(page.getByTestId('unlock-moment')).toBeVisible()
  expect((await readSave(page)).lessons[lesson.id]).toMatchObject({ done: true, skipped: true })
  await page.getByTestId('to-rooms').click()
  await expect(page.getByTestId(`lesson-card-${lesson.id}`).getByTestId('lesson-status')).toHaveText('דולג')
  await expect(page.getByRole('link', { name: 'ריצת חקירה' })).toBeVisible()
})

test('skip quiz fail: the first wrong answer ends it, and the 10-minute cooldown survives a reload', async ({ page }) => {
  await page.goto(`/#/lesson/${lesson.id}`)
  await page.getByTestId('start-quiz').click()
  await answerQuiz(page, true)
  await page.getByTestId('quiz-next').click()
  await answerQuiz(page, false)
  await expect(page.getByTestId('quiz-failed')).toBeVisible()
  expect(typeof (await readSave(page)).lessons[lesson.id].quizFailedAt).toBe('number')
  await page.getByRole('button', { name: /לשיעור/ }).click()
  await expectStep(page, lesson.steps[0])
  await expect(page.getByTestId('start-quiz')).toHaveCount(0)
  await expect(page.getByTestId('quiz-cooldown')).toContainText('אפשר לנסות שוב עוד 10 דקות')
  await page.reload()
  await expect(page.getByTestId('quiz-cooldown')).toContainText('עוד 10 דקות')
  await page.goto(STAGE_URL)
  await expect(page.getByTestId(`lesson-card-${lesson.id}`).getByTestId('quiz-cooldown')).toBeVisible()
  await expect(page.getByTestId('card-quiz')).toHaveCount(others.length)
})

test('minor 3: failing the quiz from the card does not start the lesson', async ({ page }) => {
  await page.goto(STAGE_URL)
  await page.getByTestId(`lesson-card-${lesson.id}`).getByTestId('card-quiz').click()
  await answerQuiz(page, false)
  await expect(page.getByTestId('quiz-failed')).toBeVisible()
  expect((await readSave(page)).lessons[lesson.id]).toMatchObject({ stepId: '', done: false })
  await page.getByRole('link', { name: /מספרים ובסיסים/ }).click()
  const card = page.getByTestId(`lesson-card-${lesson.id}`)
  await expect(card.getByTestId('lesson-status')).toHaveText('חדש')
  await expect(card.getByTestId('quiz-cooldown')).toBeVisible()
})

test('minor 5: with other lessons still open, "לשיעור הבא" is the primary way on', async ({ page }) => {
  test.skip(others.length === 0, 'stage 1 has a single lesson until Task 2')
  await page.goto(lessonUrl(lesson))
  await playLesson(page, lesson)
  await expect(page.getByTestId('to-next-lesson')).toHaveClass(/primary/)
  await expect(page.getByTestId('to-rooms')).not.toHaveClass(/primary/)
  await expect(page.getByTestId('unlock-moment')).toHaveCount(0)
  await page.getByTestId('to-next-lesson').click()
  await expect(page.getByTestId('lesson')).toHaveAttribute('data-lesson', others[0].id)
})

test('the unlock is stored: once open, a stage stays open', async ({ page }) => {
  await seed(page, othersDone())
  await page.goto(lessonUrl(lesson))
  await playLesson(page, lesson)
  expect((await readSave(page)).openStages).toContain(STAGE)
})

test('a v1 save with a solved room keeps the rooms open; the lessons are "מומלץ"', async ({ page }) => {
  await seed(page, { ...emptySave(), rooms: { 'sw-1-r2': { solved: true, optimal: true, noHints: true } } })
  await page.goto(STAGE_URL)
  await expect(page.getByRole('link', { name: 'ריצת חקירה' })).toBeVisible()
  await expect(page.getByTestId('lessons-lock-note')).toHaveCount(0)
  await expect(page.getByTestId(`lesson-card-${lesson.id}`)).toContainText('מומלץ')
})

test('the lesson at 400px: every step fits with no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await page.goto(STAGE_URL)
  await noHorizontalScroll(page)
  await page.goto(lessonUrl(lesson))
  await playLesson(page, lesson, { each: () => noHorizontalScroll(page) })
  await noHorizontalScroll(page)
})

test('editing the URL to another step of the open lesson jumps there; normal navigation does not remount', async ({ page }) => {
  const save = emptySave()
  save.lessons = { [lesson.id]: { stepId: lesson.steps[lesson.steps.length - 1].id, done: true } }
  await seed(page, save)
  await page.goto(`/#/lesson/${lesson.id}/${lesson.steps[0].id}`)
  await expectStep(page, lesson.steps[0])
  // "המשך" moves on inside the same mounted screen
  await page.getByTestId('lesson').evaluate(el => { (el as HTMLElement & { tag?: number }).tag = 7 })
  await page.getByTestId('lesson-next').click()
  await expectStep(page, lesson.steps[1])
  expect(await page.getByTestId('lesson').evaluate(el => (el as HTMLElement & { tag?: number }).tag)).toBe(7)
  // a manual change of the hash to another step of the same lesson takes effect, with no reload
  await page.evaluate(h => { window.location.hash = h }, `#/lesson/${lesson.id}/${lesson.steps[3].id}`)
  await expectStep(page, lesson.steps[3])
  await page.evaluate(h => { window.location.hash = h }, `#/lesson/${lesson.id}/${lesson.steps[0].id}`)
  await expectStep(page, lesson.steps[0])
  // an unknown step id is ignored
  await page.evaluate(h => { window.location.hash = h }, `#/lesson/${lesson.id}/no-such-step`)
  await expectStep(page, lesson.steps[0])
})
