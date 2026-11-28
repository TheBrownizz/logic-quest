import { describe, it, expect } from 'vitest'
import { validateWorld } from '../../src/content/validate'
import { switchingWorld } from '../../src/content/switching/world'
import { SYLLABUS } from '../../src/content/switching/syllabus'
import type { Card, LabPuzzle, Room, Stage } from '../../src/content/types'
import { gateCount, usesOnly, type Chip, type Circuit } from '../../src/logic/circuit'
import { referenceChips } from '../../src/content/chips'
import { minimizeSOP } from '../../src/logic/qm'
import { lintText, looseFormula, looseGroups, looseMinus } from '../../src/content/lint'

type P<T extends LabPuzzle['type']> = Extract<LabPuzzle, { type: T }>
const allStages = [...switchingWorld.stages].sort((a, b) => a.order - b.order)
/** Stages 1–5 (complete). Stages 6–8 are checked by their own tests through expectStageValid (stageTestUtils.ts). */
const stages = allStages.filter(s => s.order <= 5)
const stage = (id: string) => stages.find(s => s.id === id)!
const claims = (s: Stage) => s.cards.filter((c): c is Extract<Card, { kind: 'claim' }> => c.kind === 'claim')
const mcqs = (s: Stage) => s.cards.filter(c => c.kind === 'mcq')
const rooms = (type: LabPuzzle['type']) => stages.flatMap(s => s.rooms.filter(r => r.puzzle.type === type).map(r => ({ s, r })))
const room = (id: string): Room => stages.flatMap(s => s.rooms).find(r => r.id === id)!
const chipNames = (c: Circuit) => c.nodes.flatMap(n => (typeof n.kind === 'object' ? [n.kind.chip] : []))
const sorted = (xs: string[]) => [...xs].sort()

describe('switching content', () => {
  it('passes validateWorld', () => {
    expect(validateWorld(switchingWorld)).toEqual([])
  })

  it.each(stages.map(s => s.id))('%s meets the minimum counts', id => {
    const s = stage(id)
    expect(s.rooms.length).toBeGreaterThanOrEqual(6)
    expect(s.cards.length).toBeGreaterThanOrEqual(15)
    expect(claims(s).length).toBeGreaterThanOrEqual(8)
    expect(mcqs(s).length).toBeGreaterThanOrEqual(5)
  })

  it.each(stages.map(s => s.id))('%s: at least 40%% of claims are false', id => {
    const s = stage(id)
    const cs = claims(s)
    expect(cs.filter(c => !c.isTrue).length / cs.length).toBeGreaterThanOrEqual(0.4)
  })

  it('every claim has at least 3 distinct reasons', () => {
    for (const s of stages) for (const c of claims(s)) {
      expect(c.reasons.length, c.id).toBeGreaterThanOrEqual(3)
      expect(new Set(c.reasons).size, c.id).toBe(c.reasons.length)
    }
  })

  it('every card cites a syllabus topic by its exact name', () => {
    const ok = new Set(SYLLABUS.map(t => `סילבוס: ${t}`))
    for (const s of stages) for (const c of s.cards) expect(ok.has(c.source), `${c.id}: ${c.source}`).toBe(true)
  })

  it('every number room computes its answer from the logic core', () => {
    const nums = rooms('number')
    expect(nums.length).toBeGreaterThan(0)
    for (const { r } of nums) expect(typeof (r.puzzle as P<'number'>).compute, r.id).toBe('function')
  })

  it('every room has an intro and 1–3 hints', () => {
    for (const s of stages) for (const r of s.rooms) {
      expect(r.intro.trim().length, r.id).toBeGreaterThan(0)
      expect(r.hints.length, r.id).toBeGreaterThanOrEqual(1)
      expect(r.hints.length, r.id).toBeLessThanOrEqual(3)
    }
  })

  it('stage room types follow the brief', () => {
    expect(new Set(stage('sw-1-numbers').rooms.map(r => r.puzzle.type))).toEqual(new Set(['number']))
    const t2 = new Set(stage('sw-2-arith').rooms.map(r => r.puzzle.type))
    expect(t2).toEqual(new Set(['number', 'code']))
    expect(new Set(stage('sw-3-boolean').rooms.map(r => r.puzzle.type))).toEqual(new Set(['circuit']))
    expect(new Set(stage('sw-4-minimize').rooms.map(r => r.puzzle.type))).toEqual(new Set(['kmap']))
    const k = stage('sw-4-minimize').rooms.map(r => r.puzzle as P<'kmap'>)
    expect(k.some(p => p.nVars === 3)).toBe(true)
    expect(k.some(p => p.nVars === 4)).toBe(true)
    expect(k.some(p => p.dontCares.length > 0)).toBe(true)
    for (const p of k) expect(minimizeSOP(p.nVars, p.minterms, p.dontCares).length).toBeGreaterThan(0)
  })

  it('circuit specs and chips list IN/OUT names in alphabetical order', () => {
    for (const { r } of rooms('circuit')) {
      const p = r.puzzle as P<'circuit'>
      expect(p.spec.inputs, r.id).toEqual(sorted(p.spec.inputs))
      expect(p.spec.outputs, r.id).toEqual(sorted(p.spec.outputs))
      if (p.unlocksChip) {
        expect(p.unlocksChip.inputs, r.id).toEqual(sorted(p.unlocksChip.inputs))
        expect(p.unlocksChip.outputs, r.id).toEqual(sorted(p.unlocksChip.outputs))
      }
    }
  })

  it('unlocks HA in stage 3 (NAND only) and FA, ADD4, MUX2 in stage 5', () => {
    const unlocks = (s: Stage) => s.rooms.flatMap(r => (r.puzzle.type === 'circuit' && r.puzzle.unlocksChip ? [{ r, p: r.puzzle }] : []))
    const s3 = unlocks(stage('sw-3-boolean'))
    expect(s3.map(x => x.p.unlocksChip!.name)).toEqual(['HA'])
    expect(s3[0].p.allowed).toEqual(['NAND'])
    const s5 = unlocks(stage('sw-5-blocks'))
    expect(sorted(s5.map(x => x.p.unlocksChip!.name))).toEqual(['ADD4', 'FA', 'MUX2'])
    const fa = s5.find(x => x.p.unlocksChip!.name === 'FA')!
    expect(fa.p.allowed).toEqual(expect.arrayContaining(['NAND', 'OR']))
    expect(fa.p.unlocksChip).toEqual({ name: 'FA', inputs: ['A', 'B', 'Cin'], outputs: ['Cout', 'S'] })
  })

  it('every chip a reference uses is unlocked by an earlier room and fits that room palette', () => {
    const chips: Record<string, Chip> = {}
    for (const s of stages) for (const r of s.rooms) {
      if (r.puzzle.type !== 'circuit') continue
      const p = r.puzzle
      for (const name of chipNames(p.reference)) {
        expect(chips[name], `${r.id} uses ${name} before it is unlocked`).toBeDefined()
        expect(usesOnly(chips[name].circuit, p.allowed, chips, [name]), `${r.id}: ${name} hidden by palette`).toBe(true)
      }
      if (p.unlocksChip) chips[p.unlocksChip.name] = { ...p.unlocksChip, circuit: p.reference }
    }
  })

  it('delay rooms: explicit delays; stage 5 models the adder/subtractor and has a simpler one first', () => {
    for (const { r } of rooms('delay')) {
      for (const n of (r.puzzle as P<'delay'>).circuit.nodes) {
        if (n.kind === 'IN' || n.kind === 'OUT') continue
        expect(typeof n.delay, `${r.id}/${n.id}`).toBe('number')
      }
    }
    const s5 = stage('sw-5-blocks').rooms.filter(r => r.puzzle.type === 'delay')
    expect(s5.length).toBeGreaterThanOrEqual(2)
    const addSub = s5.find(r => (r.puzzle as P<'delay'>).circuit.nodes.some(n => typeof n.kind === 'object' && n.kind.chip === 'FA'))!
    expect(addSub).toBeDefined()
    const nodes = (addSub.puzzle as P<'delay'>).circuit.nodes
    for (const n of nodes) {
      if (typeof n.kind === 'object') expect(n.delay).toBe(100)
      if (n.kind === 'XOR') expect(n.delay).toBe(75)
    }
    expect(nodes.some(n => n.kind === 'IN' && n.label === 'M')).toBe(true)
    expect(s5.indexOf(addSub)).toBeGreaterThan(0)
  })

  it('stage 2 invented code: encode matches hand-computed words', () => {
    const p = room('sw-2-r8').puzzle as P<'code'>
    expect(p.type).toBe('code')
    expect(p.inputs.length).toBeGreaterThanOrEqual(3)
    expect(p.inputs.length).toBeLessThanOrEqual(4)
    // q4 = b4'; q_i = (b_i xor b_(i+1))·b4' + b_i·b4
    expect(p.encode('01101')).toBe('11011')
    expect(p.encode('10110')).toBe('00110')
    expect(p.encode('00111')).toBe('10100')
    expect(p.encode('11001')).toBe('01001')
  })

  it('stage 2 parity and Gray code rooms encode correctly', () => {
    const parity = room('sw-2-r6').puzzle as P<'code'>
    expect(parity.encode('1011001')).toBe('10110010')
    expect(parity.encode('0110100')).toBe('01101001')
    expect(parity.encode('1111111')).toBe('11111111')
    const gray = room('sw-2-r7').puzzle as P<'code'>
    expect(gray.encode('0111')).toBe('0100')
    expect(gray.encode('1010')).toBe('1111')
    expect(gray.encode('1101')).toBe('1011')
  })

  it('reference chips: HA 5, MUX2 4, FA 8, ADD4 32 gates', () => {
    const chips = referenceChips(switchingWorld)
    expect(Object.keys(chips).sort()).toEqual(['ADD4', 'FA', 'HA', 'MUX2'])
    const gc = (name: string) => gateCount(chips[name].circuit, chips)
    expect([gc('HA'), gc('MUX2'), gc('FA'), gc('ADD4')]).toEqual([5, 4, 8, 32])
  })

  // A reason must explain, never announce, the verdict: the player has already chosen נכונה / לא נכונה.
  const VERDICT = /(^|[\s,.:;"'(\-])(לא\s+נכון|לא\s+נכונה|נכון|נכונה|נכונים|שגוי|שגויה|שגויים)(?=$|[\s,.:;"')!])/
  const POLARITY_START = /^\s*(כן|לא|להפך|אכן|ממש\s+לא)\s*[,:.!]/
  it('no claim reason states a verdict', () => {
    expect(VERDICT.test('נכון, כי X')).toBe(true)
    expect(VERDICT.test('הטענה לא נכונה')).toBe(true)
    expect(VERDICT.test('כי X שגוי')).toBe(true)
    expect(VERDICT.test('מתכונן ונכונות')).toBe(false)
    expect(POLARITY_START.test('לא, כי X')).toBe(true)
    for (const s of stages) for (const c of claims(s)) {
      for (const r of c.reasons) {
        expect(VERDICT.test(r), `${c.id}: "${r}"`).toBe(false)
        expect(POLARITY_START.test(r), `${c.id}: "${r}"`).toBe(false)
      }
    }
  })

  /** Every user-visible text of a stage: card fields, room fields, and each code-definition line on its own. */
  const textsOf = (s: Stage): Array<[string, string]> => [
    ...s.cards.flatMap(c => [c.text, c.knowledge, ...(c.kind === 'claim' ? [...c.reasons, c.examReason] : c.options)].map(t => [c.id, t] as [string, string])),
    ...s.rooms.flatMap(r => {
      const p = r.puzzle as { prompt?: string; definition?: string }
      return [r.title, r.intro, ...r.hints.map(h => h.text), p.prompt ?? '', ...(p.definition ?? '').split('\n')].map(t => [r.id, t] as [string, string])
    }),
  ]

  it('negative numbers in Hebrew text are LTR-isolated', () => {
    expect(looseMinus('מחוץ לטווח 8− עד 7')).toBe(true)
    expect(looseMinus('-128 עד 127')).toBe(true)
    expect(looseMinus('⁦−128⁩ עד 127')).toBe(false)
    expect(looseMinus('המשלים ל-2')).toBe(false)
    for (const s of stages) for (const [id, t] of textsOf(s)) expect(looseMinus(t), `${id}: "${t}"`).toBe(false)
  })

  it('spaced or |-separated bit groups in Hebrew text are LTR-isolated', () => {
    expect(looseGroups('השלשות הן 011 110 100 011.')).not.toBeNull()
    expect(looseGroups('הקבוצות הן 0101 | 1011 | 1010. המירו')).not.toBeNull()
    expect(looseGroups('10 נכתב 0001\u00A00000 כאן')).not.toBeNull()
    expect(looseGroups('10 נכתב 0001 0000. שישה')).not.toBeNull()
    expect(looseGroups('כלומר 0.1011 = 1/2')).toBeNull()
    expect(looseGroups('השלשות הן ⁦011 110 100 011⁩.')).toBeNull()
    expect(looseGroups('לדוגמה 1, 3, 5, 7 נותנים')).toBeNull()
    expect(looseGroups('MUX של 4 כניסות ו-8 יציאות')).toBeNull()
    const bad: string[] = []
    for (const s of stages) for (const [id, t] of textsOf(s)) {
      const hit = looseGroups(t)
      if (hit) bad.push(`${id}: [${hit}] "${t}"`)
    }
    expect(bad, bad.join('\n')).toEqual([])
  })

  it('formulas in Hebrew text are LTR-isolated', () => {
    expect(looseFormula('במשוואה (5)_r · (6)_r = (36)_r מצאו')).not.toBeNull()
    expect(looseFormula('למשל 2^4 = 16 פונקציות')).not.toBeNull()
    expect(looseFormula("הצורה (A·B)' שווה")).not.toBeNull()
    expect(looseFormula('כאשר 0 ≤ i ≤ 3')).not.toBeNull()
    expect(looseFormula('ערך r−1 בכל ספרה')).not.toBeNull()
    expect(looseFormula('במשוואה ⁦(5)_r · (6)_r = (36)_r⁩ מצאו')).toBeNull()
    expect(looseFormula('את המשלים של 04180 (5 ספרות)')).toBeNull()
    expect(looseFormula('שני שערי NAND (בלי OR)')).toBeNull()
    expect(looseFormula("A + B = A'")).toBeNull()
    expect(looseFormula("תאי Don't Care")).toBeNull()
    const bad: string[] = []
    for (const s of stages) for (const [id, t] of textsOf(s)) {
      const hit = looseFormula(t)
      if (hit) bad.push(`${id}: [${hit}] "${t}"`)
    }
    expect(bad, bad.join('\n')).toEqual([])
  })

  it('lintText reports every problem of a string and passes all stage texts', () => {
    expect(lintText('ok')).toEqual([])
    expect(lintText('מחוץ לטווח 8− עד 7')[0]).toMatch(/negative/)
    expect(lintText('למשל 2^4 = 16 פונקציות')[0]).toMatch(/formula/)
    const bad = stages.flatMap(s => textsOf(s).flatMap(([id, t]) => lintText(t).map(m => `${id}: ${m}`)))
    expect(bad).toEqual([])
  })
})
