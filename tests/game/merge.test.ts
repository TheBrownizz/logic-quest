import { describe, it, expect } from 'vitest'
import { mergeSaves, MERGE_RULES } from '../../src/game/merge'
import { applyUpdate, emptySave, LocalProgressStore, parseSave, SAVE_KEY, type SaveData } from '../../src/game/progress'
import type { Chip, Circuit, GateKind } from '../../src/logic/circuit'

const circ = (gates: number): Circuit => ({
  nodes: [
    { id: 'a', kind: 'IN', label: 'A', x: 0, y: 0 },
    { id: 'o', kind: 'OUT', label: 'Q', x: 0, y: 0 },
    ...Array.from({ length: gates }, (_, i) => ({ id: `g${i}`, kind: 'AND' as GateKind, x: 0, y: 0 })),
  ],
  wires: [],
})
const chip = (name: string, gates: number): Chip => ({ name, inputs: ['A'], outputs: ['Q'], circuit: circ(gates) })
const mk = (p: Partial<SaveData>): SaveData => ({ ...emptySave(), ...p })
const flag = (solved: boolean, optimal: boolean, noHints: boolean) => ({ solved, optimal, noHints })

describe('MERGE_RULES', () => {
  it('has a rule for every SaveData field (a new field without a rule fails here)', () => {
    expect(Object.keys(MERGE_RULES).sort()).toEqual(Object.keys(emptySave()).sort())
  })
})

describe('mergeSaves field rules', () => {
  it('rooms: per-flag OR, union of rooms', () => {
    const a = mk({ rooms: { r1: flag(true, false, true), r2: flag(true, false, false) } })
    const b = mk({ rooms: { r1: flag(false, true, false), r3: flag(true, true, true) } })
    expect(mergeSaves(a, b).rooms).toEqual({ r1: flag(true, true, true), r2: flag(true, false, false), r3: flag(true, true, true) })
  })
  it('knowledge, flagged, openStages, helped: union', () => {
    const a = mk({ knowledge: ['k1'], flagged: ['f1'], openStages: ['s1'], helped: { r1: true } })
    const b = mk({ knowledge: ['k2', 'k1'], flagged: ['f2'], openStages: ['s2'], helped: { r2: true } })
    const m = mergeSaves(a, b)
    expect([...m.knowledge].sort()).toEqual(['k1', 'k2'])
    expect([...m.flagged].sort()).toEqual(['f1', 'f2'])
    expect([...m.openStages].sort()).toEqual(['s1', 's2'])
    expect(m.helped).toEqual({ r1: true, r2: true })
  })
  it('bestRun: max per stage', () => {
    expect(mergeSaves(mk({ bestRun: { s1: 5, s2: 9 } }), mk({ bestRun: { s1: 7, s3: 1 } })).bestRun).toEqual({ s1: 7, s2: 9, s3: 1 })
  })
  it('lessons: done is OR, stepId from the save with the higher savedAt', () => {
    const a = mk({ savedAt: 10, lessons: { l1: { stepId: 'x', done: true }, l2: { stepId: 'a2', done: false } } })
    const b = mk({ savedAt: 20, lessons: { l1: { stepId: 'y', done: false }, l3: { stepId: 'b3', done: false } } })
    const m = mergeSaves(a, b)
    expect(m.lessons.l1).toEqual({ stepId: 'y', done: true })
    expect(m.lessons.l2).toEqual({ stepId: 'a2', done: false })
    expect(m.lessons.l3).toEqual({ stepId: 'b3', done: false })
    expect(mergeSaves(b, a).lessons.l1.stepId).toBe('y')
  })
  it('lessons: skipped only if every done side was skipped; quizFailedAt max', () => {
    const a = mk({ lessons: { l: { stepId: 's', done: true, skipped: true, quizFailedAt: 5 } } })
    const b = mk({ lessons: { l: { stepId: 's', done: true, quizFailedAt: 9 } } })
    expect(mergeSaves(a, b).lessons.l).toMatchObject({ done: true, quizFailedAt: 9 })
    expect(mergeSaves(a, b).lessons.l.skipped).toBeFalsy()
    expect(mergeSaves(a, a).lessons.l.skipped).toBe(true)
  })
  it('chips: union by name, the one with fewer gates wins', () => {
    const a = mk({ chips: { HA: chip('HA', 5), FA: chip('FA', 2) } })
    const b = mk({ chips: { HA: chip('HA', 3), X: chip('X', 1) } })
    const m = mergeSaves(a, b)
    expect(m.chips.HA.circuit.nodes.length).toBe(2 + 3)
    expect(Object.keys(m.chips).sort()).toEqual(['FA', 'HA', 'X'])
    expect(mergeSaves(b, a).chips).toEqual(m.chips)
  })
  it('chips: equal gate counts resolve the same either way round', () => {
    const a = mk({ chips: { HA: { ...chip('HA', 2), inputs: ['P'] } } })
    const b = mk({ chips: { HA: { ...chip('HA', 2), inputs: ['Q'] } } })
    expect(mergeSaves(a, b).chips).toEqual(mergeSaves(b, a).chips)
  })
  it('drafts: union, the local draft wins for the same room', () => {
    const a = mk({ drafts: { r1: circ(1), r2: circ(2) } })
    const b = mk({ drafts: { r1: circ(4), r3: circ(3) } })
    const m = mergeSaves(a, b)
    expect(m.drafts.r1).toEqual(circ(1))
    expect(Object.keys(m.drafts).sort()).toEqual(['r1', 'r2', 'r3'])
  })
  it('savedAt is the max; version stays 1', () => {
    const m = mergeSaves(mk({ savedAt: 3 }), mk({ savedAt: 8 }))
    expect(m.savedAt).toBe(8)
    expect(m.version).toBe(1)
    expect(mergeSaves(mk({}), mk({})).savedAt).toBe(0)
  })
  it('unknown fields come from the newer save', () => {
    const a = { ...mk({ savedAt: 1 }), future: 'old', onlyA: 1 } as SaveData
    const b = { ...mk({ savedAt: 2 }), future: 'new' } as SaveData
    const m = mergeSaves(a, b) as unknown as Record<string, unknown>
    expect(m.future).toBe('new')
    expect(m.onlyA).toBe(1)
  })
  it('does not mutate its inputs', () => {
    const a = mk({ knowledge: ['a'], rooms: { r: flag(true, false, false) } })
    const b = mk({ knowledge: ['b'], rooms: { r: flag(false, true, false) } })
    const sa = JSON.stringify(a), sb = JSON.stringify(b)
    mergeSaves(a, b)
    expect(JSON.stringify(a)).toBe(sa)
    expect(JSON.stringify(b)).toBe(sb)
  })
})

// seeded generator (mulberry32)
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function randSave(r: () => number): SaveData {
  const ids = ['r1', 'r2', 'r3', 'r4', 'r5']
  const pick = <T,>(xs: T[]) => xs.filter(() => r() < 0.5)
  const s = emptySave()
  for (const id of ids) if (r() < 0.6) s.rooms[id] = flag(r() < 0.5, r() < 0.5, r() < 0.5)
  for (const id of ids) if (r() < 0.4) s.drafts[id] = circ(Math.floor(r() * 5))
  for (const n of ['HA', 'FA', 'MUX']) if (r() < 0.5) s.chips[n] = chip(n, Math.floor(r() * 6))
  s.knowledge = pick(['k1', 'k2', 'k3', 'k4'])
  s.flagged = pick(['r1', 'r2', 'r3'])
  s.openStages = pick(['s1', 's2', 's3'])
  for (const st of ['s1', 's2', 's3']) if (r() < 0.5) s.bestRun[st] = Math.floor(r() * 100)
  for (const id of ['r1', 'r2']) if (r() < 0.5) s.helped[id] = true
  for (const l of ['l1', 'l2', 'l3']) if (r() < 0.6) s.lessons[l] = { stepId: `st${Math.floor(r() * 4)}`, done: r() < 0.5 }
  for (const l of Object.values(s.lessons)) {
    if (r() < 0.5) l.skipped = r() < 0.5
    if (r() < 0.5) l.quizFailedAt = Math.floor(r() * 50)
  }
  s.knowledge = [...new Set(s.knowledge)]
  if (r() < 0.5) (s as unknown as Record<string, unknown>).future = Math.floor(r() * 9)
  s.savedAt = Math.floor(r() * 5)
  return parseSave(s) as SaveData
}
const gates = (c: Circuit) => c.nodes.filter(n => n.kind !== 'IN' && n.kind !== 'OUT').length

function assertNoLoss(m: SaveData, x: SaveData) {
  for (const [id, f] of Object.entries(x.rooms)) {
    for (const k of ['solved', 'optimal', 'noHints'] as const) if (f[k]) expect(m.rooms[id]?.[k]).toBe(true)
  }
  for (const k of ['knowledge', 'flagged', 'openStages'] as const) for (const v of x[k]) expect(m[k]).toContain(v)
  for (const [id, v] of Object.entries(x.bestRun)) expect(m.bestRun[id]).toBeGreaterThanOrEqual(v)
  for (const [id, l] of Object.entries(x.lessons)) if (l.done) expect(m.lessons[id]?.done).toBe(true)
  for (const [n, c] of Object.entries(x.chips)) {
    expect(m.chips[n]).toBeDefined()
    expect(gates(m.chips[n].circuit)).toBeLessThanOrEqual(gates(c.circuit))
  }
  for (const id of Object.keys(x.drafts)) expect(m.drafts[id]).toBeDefined()
  for (const id of Object.keys(x.helped)) expect(m.helped[id]).toBe(true)
}

describe('mergeSaves properties (seeded)', () => {
  const r = rng(20261128)
  const cases = Array.from({ length: 300 }, () => [randSave(r), randSave(r)] as const)
  it('never loses progress from either side', () => {
    for (const [a, b] of cases) {
      const m = mergeSaves(a, b)
      assertNoLoss(m, a)
      assertNoLoss(m, b)
    }
  })
  it('is idempotent: merge(a, a) == a, merge(merge(a,b), b) == merge(a,b)', () => {
    for (const [a, b] of cases) {
      expect(mergeSaves(a, a)).toEqual(a)
      const m = mergeSaves(a, b)
      expect(mergeSaves(m, b)).toEqual(m)
      expect(mergeSaves(m, m)).toEqual(m)
    }
  })
  it('is commutative except for drafts (local wins) and savedAt-tied lesson steps', () => {
    for (const [a, b] of cases) {
      const sorted = (m: SaveData): SaveData => ({ ...m, knowledge: [...m.knowledge].sort(), flagged: [...m.flagged].sort(), openStages: [...m.openStages].sort() })
      const x = sorted(mergeSaves(a, b)), y = sorted(mergeSaves(b, a))
      const { drafts: dx, lessons: lx, future: _fx, ...rx } = x as SaveData & { future?: unknown }
      const { drafts: dy, lessons: ly, future: _fy, ...ry } = y as SaveData & { future?: unknown }
      expect(rx).toEqual(ry)
      expect(Object.keys(dx).sort()).toEqual(Object.keys(dy).sort())
      expect(Object.keys(lx).sort()).toEqual(Object.keys(ly).sort())
      for (const id of Object.keys(lx)) expect(lx[id].done).toBe(ly[id].done)
    }
  })
  it('lesson stepId is also commutative when savedAt is tied (deterministic)', () => {
    for (const [a, b] of cases) {
      const t = { ...b, savedAt: a.savedAt }
      expect(mergeSaves(a, t).lessons).toEqual(mergeSaves(t, a).lessons)
    }
  })
})

describe('savedAt and per-owner local stores', () => {
  function fake(init: Record<string, string> = {}) {
    const m = { ...init }
    const st = {
      getItem: (k: string) => (k in m ? m[k] : null),
      setItem: (k: string, v: string) => { m[k] = v },
    } as unknown as Storage
    return { st, m }
  }
  it('save() persists the savedAt it is given; default is 0', () => {
    const { st } = fake()
    const s = new LocalProgressStore({ storage: st })
    expect(s.load().savedAt).toBe(0)
    s.save(mk({ savedAt: 1234 }))
    expect(s.load().savedAt).toBe(1234)
  })
  it('applyUpdate stamps savedAt once: the returned save equals the stored one (I1)', () => {
    const { st } = fake()
    const s = new LocalProgressStore({ storage: st })
    const before = Date.now()
    const next = applyUpdate(s, s.load(), d => ({ ...d, knowledge: ['k'] }))
    expect(next.savedAt).toBeGreaterThanOrEqual(before)
    expect(s.load()).toEqual(next)
  })
  it('a stored save without savedAt loads with 0', () => {
    const { st } = fake({ [SAVE_KEY]: '{"version":1}' })
    expect(new LocalProgressStore({ storage: st }).load().savedAt).toBe(0)
  })
  it('uses the default key, and a custom key keeps owners apart', () => {
    const { st, m } = fake()
    const guest = new LocalProgressStore({ storage: st })
    const user = new LocalProgressStore({ storage: st, key: 'logic-quest-save:u1' })
    guest.save(mk({ knowledge: ['g'] }))
    user.save(mk({ knowledge: ['u'] }))
    expect(Object.keys(m).sort()).toEqual(['logic-quest-save', 'logic-quest-save:u1'])
    expect(guest.load().knowledge).toEqual(['g'])
    expect(user.load().knowledge).toEqual(['u'])
  })
  it('a custom key has its own unreadable-save backup and latest()', () => {
    const { st, m } = fake({ 'logic-quest-save:u1': '{bad' })
    const user = new LocalProgressStore({ storage: st, key: 'logic-quest-save:u1' })
    expect(user.load()).toEqual(emptySave())
    expect(m['logic-quest-save:u1-backup']).toBe('{bad')
    expect(m['logic-quest-save-backup']).toBeUndefined()
  })
})

describe('regressions from review', () => {
  it('I2: nested chips are counted by their real gate count, each side with its own chips', () => {
    const node = (id: string, kind: GateKind | { chip: string }) => ({ id, kind, x: 0, y: 0 })
    const ha = chip('HA', 2)
    const nestedFA: Chip = { name: 'FA', inputs: ['A'], outputs: ['Q'], circuit: { nodes: [node('h1', { chip: 'HA' }), node('h2', { chip: 'HA' }), node('o', 'OR')], wires: [] } }
    const rawFA = chip('FA', 4)
    const local = mk({ chips: { HA: ha, FA: nestedFA } }) // 2 + 2 + 1 = 5 real gates, shallow 3
    const remote = mk({ chips: { FA: rawFA } })
    expect(mergeSaves(local, remote).chips.FA).toEqual(rawFA)
    expect(mergeSaves(remote, local).chips.FA).toEqual(rawFA)
  })
  it('I2: an unresolvable chip loses', () => {
    const broken: Chip = { name: 'FA', inputs: [], outputs: [], circuit: { nodes: [{ id: 'h', kind: { chip: 'MISSING' }, x: 0, y: 0 }], wires: [] } }
    const good = chip('FA', 9)
    expect(mergeSaves(mk({ chips: { FA: broken } }), mk({ chips: { FA: good } })).chips.FA).toEqual(good)
  })
  it('I3: a malformed side is ignored, the valid side kept', () => {
    const good = mk({ knowledge: ['k'], savedAt: 7 })
    const bad: unknown[] = [null, {}, { version: 1, knowledge: 5 }, { version: 1, chips: { X: { name: 'X', inputs: [], outputs: [] } } }, 'x']
    for (const b of bad) {
      expect(() => mergeSaves(good, b as SaveData)).not.toThrow()
      expect(mergeSaves(good, b as SaveData)).toEqual(good)
      expect(mergeSaves(b as SaveData, good)).toEqual(good)
    }
    expect(mergeSaves({ version: 1 } as SaveData, good).knowledge).toEqual(['k'])
    expect(mergeSaves(null as unknown as SaveData, undefined as unknown as SaveData)).toEqual(emptySave())
  })
  it('M1: parseSave is canonical', () => {
    const p = parseSave({ version: 1, knowledge: ['a', 'a'], flagged: ['f', 'f'], openStages: ['s', 's'], lessons: { l: { stepId: 'x', done: false, skipped: true } } })!
    expect(p.knowledge).toEqual(['a'])
    expect(p.flagged).toEqual(['f'])
    expect(p.openStages).toEqual(['s'])
    expect('skipped' in p.lessons.l).toBe(false)
  })
})

describe('resetGen (reset reaches every device)', () => {
  const old = mk({ resetGen: 0, knowledge: ['old'], rooms: { r1: flag(true, true, true) }, savedAt: 99 })
  const reset = mk({ resetGen: 1, savedAt: 5 })
  it('the higher generation wins wholesale, in either argument order', () => {
    expect(mergeSaves(old, reset)).toEqual(reset)
    expect(mergeSaves(reset, old)).toEqual(reset)
  })
  it('equal generations merge as usual and keep the generation', () => {
    const m = mergeSaves(mk({ resetGen: 2, knowledge: ['a'] }), mk({ resetGen: 2, knowledge: ['b'] }))
    expect(m.resetGen).toBe(2)
    expect([...m.knowledge].sort()).toEqual(['a', 'b'])
  })
  it('parseSave defaults and sanitises resetGen', () => {
    expect(parseSave({ version: 1 })!.resetGen).toBe(0)
    expect(parseSave({ version: 1, resetGen: -3 })!.resetGen).toBe(0)
    expect(parseSave({ version: 1, resetGen: 4 })!.resetGen).toBe(4)
  })
})
