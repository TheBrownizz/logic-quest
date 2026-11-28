import { expect } from 'vitest'
import { validateWorld } from '../../src/content/validate'
import { validateLessons } from '../../src/content/lessons/validate'
import { lessonsForStage } from '../../src/content/lessons/catalog'
import { lintText } from '../../src/content/lint'
import { switchingWorld } from '../../src/content/switching/world'
import { SYLLABUS } from '../../src/content/switching/syllabus'
import type { Card, Claim, ExamQuestion, LabPuzzle, Room, Stage } from '../../src/content/types'

/** A reason must explain, never announce, the verdict (the same rule switching.test.ts applies to stages 1–5). */
export const VERDICT = /(^|[\s,.:;"'(\-])(לא\s+נכון|לא\s+נכונה|נכון|נכונה|נכונים|שגוי|שגויה|שגויים)(?=$|[\s,.:;"')!])/
export const POLARITY_START = /^\s*(כן|לא|להפך|אכן|ממש\s+לא)\s*[,:.!]/
const SOURCES = new Set(SYLLABUS.map(t => `סילבוס: ${t}`))

/** Every user-visible string of a puzzle (prompts, identify question and options, code definitions). */
export function puzzleTexts(p: LabPuzzle): string[] {
  switch (p.type) {
    case 'number': return [p.prompt]
    case 'code': return p.definition.split('\n')
    case 'identify': return [p.question, ...p.options]
    default: return []
  }
}
export const roomTexts = (r: Room): string[] => [r.title, r.intro, ...r.hints.map(h => h.text), ...puzzleTexts(r.puzzle)]
export const cardTexts = (c: Card): string[] =>
  [c.text, c.knowledge, ...(c.kind === 'claim' ? [...c.reasons, c.examReason] : c.options)]

function expectCardsOk(cards: Card[]): void {
  for (const c of cards) {
    expect(SOURCES.has(c.source), `${c.id}: source "${c.source}" is not a syllabus topic`).toBe(true)
    if (c.kind === 'claim') {
      expect(c.reasons.length, `${c.id}: reasons`).toBeGreaterThanOrEqual(3)
      for (const r of c.reasons) {
        expect(VERDICT.test(r), `${c.id}: reason states a verdict: "${r}"`).toBe(false)
        expect(POLARITY_START.test(r), `${c.id}: reason starts with yes/no: "${r}"`).toBe(false)
      }
    }
  }
}

function expectLintClean(texts: Array<[string, string]>): void {
  const bad = texts.flatMap(([id, t]) => lintText(t).map(m => `${id}: ${m}: "${t}"`))
  expect(bad, bad.join('\n')).toEqual([])
}

/**
 * Checks one switching stage the way every content task must: validateWorld finds nothing about its rooms
 * and cards; cards cite syllabus topics and their reasons state no verdict; every text passes the lint; every
 * room has an intro and 1–3 hints; its lessons pass validateLessons. Unless `shell` (Task 2's placeholder
 * stages), it also checks the plan's counts: ≥6 rooms, ≥15 cards with ≥8 claims (≥40% false) and ≥5 MCQs,
 * and 2–3 lessons. Returns the stage.
 *
 * Use it in a stage's content test: `const s = expectStageValid('sw-6-latches')`.
 */
export function expectStageValid(stageId: string, opts: { shell?: boolean } = {}): Stage {
  const stage = switchingWorld.stages.find(s => s.id === stageId)
  expect(stage, `stage ${stageId}`).toBeDefined()
  const s = stage!
  const ids = new Set([s.id, ...s.rooms.map(r => r.id), ...s.cards.map(c => c.id)])
  const errs = validateWorld(switchingWorld).filter(e => ids.has(e.split(':')[0]))
  expect(errs, errs.join('\n')).toEqual([])
  for (const r of s.rooms) {
    expect(r.intro.trim().length, r.id).toBeGreaterThan(0)
    expect(r.hints.length, `${r.id} hints`).toBeGreaterThanOrEqual(1)
    expect(r.hints.length, `${r.id} hints`).toBeLessThanOrEqual(3)
  }
  expectCardsOk(s.cards)
  expectLintClean([...s.rooms.flatMap(r => roomTexts(r).map((t): [string, string] => [r.id, t])), ...s.cards.flatMap(c => cardTexts(c).map((t): [string, string] => [c.id, t]))])
  const lessons = lessonsForStage(stageId)
  const lerrs = validateLessons(switchingWorld, lessons)
  expect(lerrs, lerrs.join('\n')).toEqual([])
  if (!opts.shell) {
    const claims = s.cards.filter((c): c is Claim => c.kind === 'claim')
    expect(s.rooms.length, `${stageId} rooms`).toBeGreaterThanOrEqual(6)
    expect(s.cards.length, `${stageId} cards`).toBeGreaterThanOrEqual(15)
    expect(claims.length, `${stageId} claims`).toBeGreaterThanOrEqual(8)
    expect(s.cards.length - claims.length, `${stageId} mcqs`).toBeGreaterThanOrEqual(5)
    expect(claims.filter(c => !c.isTrue).length / claims.length, `${stageId} false claims`).toBeGreaterThanOrEqual(0.4)
    expect(lessons.length, `${stageId} lessons`).toBeGreaterThanOrEqual(2)
    expect(lessons.length, `${stageId} lessons`).toBeLessThanOrEqual(3)
  }
  return s
}

/**
 * Checks the boss bank: validateWorld finds nothing about it; cards cite syllabus topics, reasons state no
 * verdict, texts pass the lint. Unless `shell`, at least `perTopic` (default 4) questions per topic.
 */
export function expectBossValid(opts: { shell?: boolean; perTopic?: number } = {}): ExamQuestion[] {
  const boss = switchingWorld.boss
  expect(boss).toBeDefined()
  const bank = boss!.bank
  const ids = new Set([boss!.id, ...bank.flatMap(q => [q.id, q.b.id, q.c.id])])
  const errs = validateWorld(switchingWorld).filter(e => ids.has(e.split(':')[0]))
  expect(errs, errs.join('\n')).toEqual([])
  expectCardsOk(bank.flatMap(q => [q.b, q.c]))
  expectLintClean(bank.flatMap(q => [q.prompt, ...puzzleTexts(q.a), ...cardTexts(q.b), ...cardTexts(q.c)].map((t): [string, string] => [q.id, t])))
  for (const t of [1, 2, 3, 4]) {
    const n = bank.filter(q => q.topic === t).length
    expect(n, `topic ${t} questions`).toBeGreaterThanOrEqual(opts.shell ? 1 : opts.perTopic ?? 4)
  }
  return bank
}
