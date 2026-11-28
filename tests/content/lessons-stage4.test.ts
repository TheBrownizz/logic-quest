import { describe, it, expect } from 'vitest'
import { expectLessonsValid, expectFullLesson, stepCounts } from './lessonTestUtils'
import type { Lesson, Step } from '../../src/content/lessons/types'
import { formatSOP, literalCount, minimizeSOP, primeImplicants } from '../../src/logic/qm'
import { checkCover, kmapLayout, type Group } from '../../src/logic/kmap'
import { bitsOf, groupInfo, mapHeaders, neighbours, valueAt } from '../../src/ui/lessons/widgets/truthToMapLogic'

const lessons = expectLessonsValid('sw-4-minimize')
const [l1, l2, l3] = lessons
const step = <K extends Step['kind']>(l: Lesson, id: string, kind: K) => {
  const s = l.steps.find(x => x.id === id)
  if (!s || s.kind !== kind) throw new Error(`${l.id}/${id} is not a ${kind}`)
  return s as Extract<Step, { kind: K }>
}
const quiz = (l: Lesson, id: string) => l.skipQuiz.find(q => q.id === id)!
/** The correct option's text without LTR isolates and no-break spaces. */
const plain = (s: string) => s.replace(/[⁦⁩]/g, '').replace(/ /g, ' ')
const right = (l: Lesson, id: string) => {
  const s = l.steps.find(x => x.id === id)
  const o = s?.kind === 'check' ? s : quiz(l, id)
  return plain(o.options[o.correct])
}

// ---- an independent evaluator for the formulas that appear in options: sums of products, products of sums ----
type Env = Record<string, number>
function evalExpr(src: string, env: Env): number {
  const t = plain(src).replace(/\s+/g, '')
  let i = 0
  const expr = (): number => { let v = term(); while (t[i] === '+') { i++; v |= term() } return v }
  const term = (): number => { let v = factor(); while (i < t.length && t[i] !== '+' && t[i] !== ')') v &= factor(); return v }
  const factor = (): number => {
    let v: number
    if (t[i] === '(') { i++; v = expr(); i++ } else { v = env[t[i]]; i++ }
    while (t[i] === "'") { v = 1 - v; i++ }
    return v
  }
  const out = expr()
  if (i !== t.length) throw new Error(`cannot parse ${src}`)
  return out
}
/** The truth vector of a formula over the first n variables of A, B, C, D (row 0 first). */
const vector = (src: string, n: number) => Array.from({ length: 1 << n }, (_, m) =>
  evalExpr(src, Object.fromEntries(['A', 'B', 'C', 'D'].slice(0, n).map((v, i) => [v, (m >> (n - 1 - i)) & 1]))))
const onlyAt = (v: number[], row: number, val: number) => v.every((x, m) => (m === row ? x === val : x === 1 - val))
const ones = (a: number, b: number) => { let x = a ^ b, c = 0; for (; x; x &= x - 1) c++; return c }

describe('stage 4 lessons: structure', () => {
  it('there are three, in order', () => {
    expect(lessons.map(l => l.id)).toEqual(['sw-4-l1', 'sw-4-l2', 'sw-4-l3'])
    expect(lessons.map(l => l.title)).toEqual(['SOP, POS, מינטרמים ומקסטרמים', 'מפות קרנו', 'Don\'t Care ושיטת הטבלה'])
  })
  it.each(lessons.map(l => [l.id, l] as [string, Lesson]))('%s meets the lesson rules', (_id, l) => {
    expectFullLesson(l)
    expect(l.source).toBe('סילבוס: שיטות מינימיזציה (מפות קרנו ושיטת הטבלה)')
    expect(stepCounts(l).check).toBeGreaterThanOrEqual(2)
    expect(l.steps[l.steps.length - 1].kind).toBe('recap')
  })
  it('each lesson has a TruthToMap goal widget with an example, and 4.1 toy and bench need every row', () => {
    for (const l of lessons) {
      expect(l.steps.some(s => s.kind === 'widget' && s.widget === 'TruthToMap' && s.goal !== undefined && s.example !== undefined), l.id).toBe(true)
      for (const s of l.steps) if (s.kind === 'widget' && (s.widget === 'GateToy' || s.widget === 'IdentityBench')) {
        expect(s.goal, `${l.id}/${s.id}`).toEqual({ kind: 'all-rows' })
        expect(s.example, `${l.id}/${s.id}`).toBeDefined()
      }
    }
  })
  it("4.1 and 4.2 do not use Don't Care before 4.3 teaches it", () => {
    for (const l of lessons.slice(0, 2)) expect(JSON.stringify(l.steps) + JSON.stringify(l.skipQuiz), l.id).not.toMatch(/Don.t Care/)
  })
  it('no more than two explain steps in a row', () => {
    for (const l of lessons) {
      let run = 0
      for (const s of l.steps) { run = s.kind === 'explain' ? run + 1 : 0; expect(run, l.id).toBeLessThanOrEqual(2) }
    }
  })
})

describe('4.1: minterms and maxterms (re-derived)', () => {
  it('the running function: at least two of three inputs are 1, so Σm(3,5,6,7), zeros 0,1,2,4', () => {
    const maj = [0, 1, 2, 3, 4, 5, 6, 7].filter(m => bitsOf(3, m).split('').filter(b => b === '1').length >= 2)
    expect(maj).toEqual([3, 5, 6, 7])
    const w = step(l1, 'pick-min', 'widget')
    expect((w.config as { minterms: number[] }).minterms).toEqual(maj)
    expect(w.goal).toEqual({ kind: 'pick', cells: maj })
    const x = step(l1, 'pick-max', 'widget')
    expect(x.goal).toEqual({ kind: 'pick', cells: [0, 1, 2, 4] })
    // the toy's function is the same one
    const toy = step(l1, 'toy', 'widget').config as { expr: { fn: (v: Record<string, 0 | 1>) => 0 | 1 } }
    const fromToy = [0, 1, 2, 3, 4, 5, 6, 7].filter(m => toy.expr.fn({ A: ((m >> 2) & 1) as 0 | 1, B: ((m >> 1) & 1) as 0 | 1, C: (m & 1) as 0 | 1 }) === 1)
    expect(fromToy).toEqual(maj)
  })
  it("check-min: only the AB'C option is 1 on row 101 alone (a product); the others are not", () => {
    const s = step(l1, 'check-min', 'check')
    s.options.forEach((o, i) => expect(onlyAt(vector(o, 3), 5, 1), o).toBe(i === s.correct))
    expect(plain(s.options[s.correct])).toBe("AB'C")
  })
  it("check-max: only the (A + B' + C) option is 0 on row 010 alone", () => {
    const s = step(l1, 'check-max', 'check')
    s.options.forEach((o, i) => expect(onlyAt(vector(o, 3), 2, 0), o).toBe(i === s.correct))
  })
  it('check-merge: only the correct pair differs in exactly one variable', () => {
    const s = step(l1, 'check-merge', 'check')
    const rowOf = (t: string) => { const m = [...t.matchAll(/([ABC])('?)/g)]; return m.reduce((r, [, , p], i) => r | ((p ? 0 : 1) << (2 - i)), 0) }
    s.options.forEach((o, i) => {
      const [a, b] = plain(o).split(' ו-')
      expect(ones(rowOf(a), rowOf(b)) === 1, o).toBe(i === s.correct)
    })
    expect(plain(s.options[s.correct])).toBe("AB'C ו-ABC")
  })
  it('the canonical SOP has 4 terms of 3 literals; the maxterm text for row 011 is (A + B\' + C\')', () => {
    expect(step(l1, 'literals', 'check-number').compute()).toBe('12')
    const maxTerm = (m: number) => `(${['A', 'B', 'C'].map((v, i) => ((m >> (2 - i)) & 1 ? `${v}'` : v)).join(' + ')})`
    expect(maxTerm(3)).toBe("(A' + B' + C')".replace("A'", 'A'))
    expect(step(l1, 'maxterm', 'explain').text).toContain(maxTerm(3).replace(/ /g, ' '))
  })
  it('identity bench: ABC + ABC\' equals AB in every row', () => {
    const cfg = step(l1, 'bench', 'widget').config as { vars: string[]; left: { fn: (v: Record<string, 0 | 1>) => 0 | 1 }; right: { fn: (v: Record<string, 0 | 1>) => 0 | 1 } }
    for (let m = 0; m < 8; m++) {
      const v = { A: ((m >> 2) & 1) as 0 | 1, B: ((m >> 1) & 1) as 0 | 1, C: (m & 1) as 0 | 1 }
      expect(cfg.left.fn(v)).toBe(cfg.right.fn(v))
      expect(cfg.left.fn(v)).toBe(evalExpr("ABC + ABC'", v) as 0 | 1)
    }
  })
  it('skip quiz', () => {
    expect(right(l1, 'q1')).toBe('5')
    // q2/q3: the minterm / maxterm of row 100
    expect(onlyAt(vector(right(l1, 'q2'), 3), 4, 1)).toBe(true)
    expect(onlyAt(vector(right(l1, 'q3'), 3), 4, 0)).toBe(true)
    for (const id of ['q2', 'q3']) {
      const q = quiz(l1, id)
      q.options.forEach((o, i) => expect(onlyAt(vector(o, 3), 4, id === 'q2' ? 1 : 0), `${id} ${o}`).toBe(i === q.correct))
    }
    // q6: ABC + ABC' = AB, and no other option is equivalent
    const q6 = quiz(l1, 'q6')
    const lhs = vector("ABC + ABC'", 3)
    q6.options.forEach((o, i) => expect(JSON.stringify(vector(o, 3)) === JSON.stringify(lhs), o).toBe(i === q6.correct))
    // q8: Σm(0,3) over A, B
    const q8 = quiz(l1, 'q8')
    q8.options.forEach((o, i) => expect(JSON.stringify(vector(o, 2)) === JSON.stringify([1, 0, 0, 1]), o).toBe(i === q8.correct))
    // q7: a minterm is 1 in exactly one row of 2^n
    expect(vector("AB'C'", 3).filter(x => x === 1)).toHaveLength(1)
  })
})

describe('4.2: Karnaugh maps (re-derived)', () => {
  it('the fly step maps rows of F = Σm(3,5,6,7); column headers are Gray order', () => {
    expect(mapHeaders(3).cols.join(', ')).toBe('00, 01, 11, 10')
    expect(plain(step(l2, 'gray', 'explain').text)).toContain('00, 01, 11, 10')
    const s = quiz(l2, 'q1')
    expect(plain(s.options[s.correct])).toBe(mapHeaders(3).cols.join(', '))
    // 00 and 10 (first and last column) differ in one bit, 01 and 10 do not
    expect(ones(0b00, 0b10)).toBe(1)
  })
  it('check-gray: only the first option is true (01 -> 11 changes one bit, 01 -> 10 changes two)', () => {
    expect(ones(0b01, 0b11)).toBe(1)
    expect(ones(0b01, 0b10)).toBe(2)
    expect(step(l2, 'check-gray', 'check').correct).toBe(0)
  })
  it('nbr: the neighbours of cell 0 in a 4-variable map are 1, 2, 4, 8 and the goal is cell 0 plus them', () => {
    const w = step(l2, 'nbr', 'widget')
    const byBrute = [0, ...Array.from({ length: 16 }, (_, m) => m).filter(m => ones(0, m) === 1)]
    expect(w.goal).toEqual({ kind: 'pick', cells: byBrute })
    expect(neighbours(4, 0).map(n => n.m)).toEqual([1, 2, 4, 8])
    // 2 and 8 are across the edge: in the layout, their column / row is 3 away from cell 0's
    const L = kmapLayout(4)
    const pos = (m: number) => { for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (L.mintermAt(r, c) === m) return [r, c] }
    expect(pos(0)).toEqual([0, 0]); expect(pos(2)).toEqual([0, 3]); expect(pos(8)).toEqual([3, 0])
    expect(neighbours(4, 0).filter(n => n.wraps).map(n => n.m)).toEqual([2, 8])
    // every cell has exactly four neighbours
    for (let m = 0; m < 16; m++) expect(neighbours(4, m)).toHaveLength(4)
  })
  it('group-pick: cells 3 and 7 are the 1-cells with B = 1 and C = 1, and they give BC', () => {
    const w = step(l2, 'group-pick', 'widget')
    const cells = [0, 1, 2, 3, 4, 5, 6, 7].filter(m => ((m >> 1) & 1) === 1 && (m & 1) === 1)
    expect(cells).toEqual([3, 7])
    expect(w.goal).toEqual({ kind: 'pick', cells })
    expect(cells.every(m => valueAt(w.config as never, m) === 1)).toBe(true)
    expect(groupInfo(3, cells)).toMatchObject({ valid: true, term: 'BC' })
    expect(plain(w.prompt)).toContain('BC')
  })
  it('check-group: six cells is the only illegal one; corners, centre and a row are legal groups', () => {
    const s = step(l2, 'check-group', 'check')
    expect(s.correct).toBe(2)
    expect(groupInfo(4, [0, 2, 8, 10])).toMatchObject({ valid: true, term: "B'D'" })
    expect(groupInfo(4, [5, 7, 13, 15])).toMatchObject({ valid: true, term: 'BD' })
    expect(groupInfo(4, [0, 1, 3, 2])).toMatchObject({ valid: true, term: "A'B'" })
    // every set of six cells is rejected
    expect(groupInfo(4, [0, 1, 3, 2, 6, 4]).valid).toBe(false)
    expect(groupInfo(4, [4, 5, 7, 6, 12, 13]).valid).toBe(false)
  })
  it('cover step and saved: F = BC + AC + AB, 6 literals against 12 in the canonical form', () => {
    const min = minimizeSOP(3, [3, 5, 6, 7])
    expect(formatSOP(min, ['A', 'B', 'C'])).toBe('BC + AC + AB')
    expect(min).toHaveLength(3)
    expect(literalCount(min)).toBe(6)
    expect(step(l2, 'saved', 'check-number').compute()).toBe('6')
    expect(step(l2, 'cover', 'explain').text).toContain('BC + AC + AB')
    expect(4 * 3).toBe(12)
  })
  it('try: the 4-variable function minimises to B\'D\' + BD (two groups of four), and that cover is accepted and minimal', () => {
    const p = step(l2, 'try', 'try').puzzle
    if (p.type !== 'kmap') throw new Error('not a kmap')
    const best = minimizeSOP(4, p.minterms, p.dontCares)
    expect(formatSOP(best, ['A', 'B', 'C', 'D'])).toBe("B'D' + BD")
    // brute force: B'D' + BD is 1 exactly on the minterms
    const f = (m: number) => { const b = (m >> 2) & 1, d = m & 1; return b === d ? 1 : 0 }
    expect(Array.from({ length: 16 }, (_, m) => m).filter(m => f(m) === 1)).toEqual(p.minterms)
    const L = kmapLayout(4)
    const grp = (ms: number[]): Group => ({ cells: ms.map(m => { for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (L.mintermAt(r, c) === m) return [r, c] as [number, number]; throw new Error() }) })
    const cov = checkCover(4, p.minterms, p.dontCares, [grp([0, 2, 8, 10]), grp([5, 7, 13, 15])])
    expect(cov).toMatchObject({ valid: true, covered: true, coversZero: false, isMinimal: true })
  })
  it('skip quiz', () => {
    expect(right(l2, 'q2')).toBe(String(2 ** 4))
    expect(right(l2, 'q3')).toBe(String(neighbours(4, 5).length))
    const q4 = quiz(l2, 'q4')
    expect(q4.options.filter(o => Number.isInteger(Math.log2(Number(o))))).toEqual([q4.options[q4.correct]])
    expect(right(l2, 'q5')).toBe(String(4 - Math.log2(8)))
    expect(right(l2, 'q8')).toBe(String(3 - Math.log2(4)))
    expect(groupInfo(3, [1, 3]).term).toBe("A'C")
    expect(right(l2, 'q9')).toBe("A'C")
    expect(groupInfo(4, [0, 2, 8, 10]).valid).toBe(true) // q6: the corners are a legal group
    expect(right(l2, 'q6')).toMatch(/^כן/)
    expect(right(l2, 'q7')).toMatch(/^כן/)
  })
})

describe('4.3: Don\'t Care and the table method (re-derived)', () => {
  it('pick-x: cells 4,5,6,7 are A\'B, one of them (6) is X, and that group is what the X buys', () => {
    const w = step(l3, 'pick-x', 'widget')
    const cfg = w.config as { minterms: number[]; dontCares: number[] }
    expect(w.goal).toEqual({ kind: 'pick', cells: [4, 5, 6, 7] })
    const cells = Array.from({ length: 16 }, (_, m) => m).filter(m => (m >> 3) === 0 && ((m >> 2) & 1) === 1)
    expect(cells).toEqual([4, 5, 6, 7])
    expect(cells.filter(m => cfg.dontCares.includes(m))).toEqual([6])
    expect(cells.every(m => cfg.minterms.includes(m) || cfg.dontCares.includes(m))).toBe(true)
    expect(groupInfo(4, cells)).toMatchObject({ valid: true, term: "A'B" })
  })
  it('the gain: BC\' + A\'BD (5 literals) without X, BC\' + A\'B (4) with X, so 1 literal saved', () => {
    const f = { n: 4, m: [4, 5, 7, 12, 13], d: [6, 14] }
    expect(formatSOP(minimizeSOP(4, f.m), ['A', 'B', 'C', 'D'])).toBe("BC' + A'BD")
    expect(formatSOP(minimizeSOP(4, f.m, f.d), ['A', 'B', 'C', 'D'])).toBe("BC' + A'B")
    expect(literalCount(minimizeSOP(4, f.m))).toBe(5)
    expect(literalCount(minimizeSOP(4, f.m, f.d))).toBe(4)
    expect(step(l3, 'gain', 'check-number').compute()).toBe('1')
    // the A'B + BC' cover is valid: it is 1 on every minterm and 0 on every cell that is neither a minterm nor X
    const g = (m: number) => ((m >> 3) & 1) === 0 && ((m >> 2) & 1) === 1 || ((m >> 2) & 1) === 1 && ((m >> 1) & 1) === 0
    for (let m = 0; m < 16; m++) {
      if (f.m.includes(m)) expect(g(m), `m${m}`).toBe(true)
      if (!f.m.includes(m) && !f.d.includes(m)) expect(g(m), `m${m}`).toBe(false)
    }
  })
  it('check-merge: only 0101 and 0111 differ in exactly one bit', () => {
    const s = step(l3, 'check-merge', 'check')
    s.options.forEach((o, i) => {
      const [a, b] = plain(o).split(' ו-')
      expect(ones(parseInt(a, 2), parseInt(b, 2)) === 1, o).toBe(i === s.correct)
    })
    expect(parseInt('0101', 2) ^ parseInt('0111', 2)).toBe(0b0010) // the third bit from the left; result 01-1
  })
  it('the QM example Σm(1,3,5,6,7): pairs and the prime implicants are those drawn in the figure', () => {
    const pis = primeImplicants(3, [1, 3, 5, 6, 7])
    expect(formatSOP(pis, ['A', 'B', 'C']).split(' + ').sort()).toEqual(['AB', 'C'])
    // brute force the first round: pairs of minterms differing in one bit
    const pairs = [1, 3, 5, 6, 7].flatMap((a, i) => [1, 3, 5, 6, 7].slice(i + 1).filter(b => ones(a, b) === 1).map(b => [a, b]))
    expect(pairs).toEqual([[1, 3], [1, 5], [3, 7], [5, 7], [6, 7]])
    const fig = (/* figure text */ String(Object.values((require_figures()))[0]))
    for (const t of ['0-1', '-01', '-11', '1-1', '11-', '--1']) expect(fig).toContain(t)
    expect(minimizeSOP(3, [1, 3, 5, 6, 7])).toHaveLength(2)
  })
  it('pi-count: Σm(0,1,3,7) has the three prime implicants A\'B\', A\'C, BC; the two essential ones already cover it', () => {
    const pis = primeImplicants(3, [0, 1, 3, 7])
    expect(formatSOP(pis, ['A', 'B', 'C']).split(' + ').sort()).toEqual(["A'B'", "A'C", 'BC'])
    expect(step(l3, 'pi-count', 'check-number').compute()).toBe('3')
    expect(step(l3, 'pi-count', 'check-number').answer).toBe('3')
    // minterm 0 is covered by A'B' alone, minterm 7 by BC alone; together they cover 0,1,3,7
    const covers = (pi: string, m: number) => evalExpr(pi, { A: (m >> 2) & 1, B: (m >> 1) & 1, C: m & 1 }) === 1
    expect(['A\'B\'', "A'C", 'BC'].filter(p => covers(p, 0))).toEqual(["A'B'"])
    expect(["A'B'", "A'C", 'BC'].filter(p => covers(p, 7))).toEqual(['BC'])
    expect([0, 1, 3, 7].every(m => covers("A'B'", m) || covers('BC', m))).toBe(true)
    expect(formatSOP(minimizeSOP(3, [0, 1, 3, 7]), ['A', 'B', 'C']).split(' + ').sort()).toEqual(["A'B'", 'BC'])
  })
  it('try: Σm(1,4,5,6,7,9) + d(3,12,13) minimises to C\'D + A\'B (X cells 13 helps; 3 and 12 are unused)', () => {
    const p = step(l3, 'try', 'try').puzzle
    if (p.type !== 'kmap') throw new Error('not a kmap')
    expect(formatSOP(minimizeSOP(4, p.minterms, p.dontCares), ['A', 'B', 'C', 'D'])).toBe("C'D + A'B")
    expect(minimizeSOP(4, p.minterms, p.dontCares)).toHaveLength(2)
    expect(formatSOP(minimizeSOP(4, p.minterms), ['A', 'B', 'C', 'D'])).toBe("B'C'D + A'B")
    // the hints' groups: 4,5,6,7 (A'B) and 1,5,9,13 (C'D, 13 is X)
    expect(groupInfo(4, [4, 5, 6, 7]).term).toBe("A'B")
    expect(groupInfo(4, [1, 5, 9, 13]).term).toBe("C'D")
    const L = kmapLayout(4)
    const grp = (ms: number[]): Group => ({ cells: ms.map(m => { for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (L.mintermAt(r, c) === m) return [r, c] as [number, number]; throw new Error() }) })
    expect(checkCover(4, p.minterms, p.dontCares, [grp([4, 5, 6, 7]), grp([1, 5, 9, 13])])).toMatchObject({ valid: true, covered: true, coversZero: false, isMinimal: true })
  })
  it('skip quiz', () => {
    expect(right(l3, 'q4')).toBe('01-0')
    expect(parseInt('0110', 2) ^ parseInt('0100', 2)).toBe(0b0010) // the third bit
    expect(Array.from({ length: 16 }, (_, m) => m).filter(m => m > 9)).toEqual([10, 11, 12, 13, 14, 15]) // q7: bits 1010 to 1111
  })
})

// figures live in the stage file; read them through the catalog
import { allFigures } from '../../src/content/lessons/catalog'
function require_figures(): Record<string, string> { return { 's4-qm': allFigures['s4-qm'] } }
