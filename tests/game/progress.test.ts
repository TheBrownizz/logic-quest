import { describe, it, expect } from 'vitest'
import { LocalProgressStore, applyUpdate, emptySave, type SaveData } from '../../src/game/progress'

function fake(init: Record<string, string> = {}, throws = false): Storage {
  const m = { ...init }
  return {
    getItem: (k: string) => { if (throws) throw new Error('x'); return k in m ? m[k] : null },
    setItem: (k: string, v: string) => { if (throws) throw new Error('quota'); m[k] = v },
  } as unknown as Storage
}

describe('LocalProgressStore', () => {
  it('load: throwing storage -> empty', () => {
    expect(new LocalProgressStore(fake({}, true)).load()).toEqual(emptySave())
  })
  it('load: corrupt json / wrong version / wrong shape -> empty', () => {
    for (const v of ['{oops', '{"version":99}', '[]', '"s"', 'null'])
      expect(new LocalProgressStore(fake({ 'logic-quest-save': v })).load()).toEqual(emptySave())
  })
  it('load: fills missing fields of v1', () => {
    const s = new LocalProgressStore(fake({ 'logic-quest-save': '{"version":1,"knowledge":["a"]}' })).load()
    expect(s).toEqual({ ...emptySave(), knowledge: ['a'] })
  })
  it('load failure backs up the raw value once, never overwriting', () => {
    const st = fake({ 'logic-quest-save': '{oops' })
    expect(new LocalProgressStore(st).load()).toEqual(emptySave())
    expect(st.getItem('logic-quest-save-backup')).toBe('{oops')
    st.setItem('logic-quest-save', '{"version":99}')
    new LocalProgressStore(st).load()
    expect(st.getItem('logic-quest-save-backup')).toBe('{oops')
  })
  it('no backup for empty or missing save', () => {
    const st = fake({})
    new LocalProgressStore(st).load()
    expect(st.getItem('logic-quest-save-backup')).toBeNull()
  })
  it('save throwing does not crash', () => {
    expect(() => new LocalProgressStore(fake({}, true)).save(emptySave())).not.toThrow()
  })
  it('round trip export/import; export uses the given save, import does not write', () => {
    const st = fake()
    const a = new LocalProgressStore(st)
    const d = { ...emptySave(), rooms: { r1: { solved: true, optimal: false, noHints: true } }, bestRun: { s1: 900 } }
    const json = a.exportJSON(d) // nothing stored: the in-memory save is exported
    expect(st.getItem('logic-quest-save')).toBeNull()
    const b = new LocalProgressStore(st)
    expect(b.importJSON(json)).toEqual({ ok: true, data: d })
    expect(st.getItem('logic-quest-save')).toBeNull()
  })
  it('import drops chip entries stored under a key other than the chip name', () => {
    const c = { nodes: [], wires: [] }
    const chip = (name: string) => ({ name, inputs: ['a'], outputs: ['b'], circuit: c })
    const r = new LocalProgressStore(fake()).importJSON(JSON.stringify({ version: 1, chips: { HA: chip('HA'), FA: chip('HA') } }))
    expect(r.ok && Object.keys(r.data.chips)).toEqual(['HA'])
  })
  it('import garbage / bad version / bad shape fails', () => {
    const s = new LocalProgressStore(fake())
    expect(s.importJSON('garbage').ok).toBe(false)
    expect(s.importJSON('{"version":2}').ok).toBe(false)
    expect(s.importJSON('{"version":1,"rooms":5}').ok).toBe(false)
  })
  it('SaveData has no run field', () => {
    expect(Object.keys(emptySave()).sort()).toEqual(['bestRun', 'chips', 'drafts', 'flagged', 'helped', 'knowledge', 'lessons', 'openStages', 'resetGen', 'rooms', 'savedAt', 'version'])
  })
  it('drops bad chips/drafts entries, keeps good ones', () => {
    const c = { nodes: [], wires: [] }
    const chip = { name: 'good', inputs: ['a'], outputs: ['b'], circuit: c }
    const raw = JSON.stringify({ version: 1, drafts: { a: null, ok: c }, chips: { x: 5, good: chip } })
    const s = new LocalProgressStore(fake({ 'logic-quest-save': raw })).load()
    expect(s.drafts).toEqual({ ok: c })
    expect(s.chips).toEqual({ good: chip })
  })
  it('bad knowledge / bestRun -> rejected', () => {
    for (const v of ['{"version":1,"knowledge":[1]}', '{"version":1,"bestRun":{"a":"x"}}'])
      expect(new LocalProgressStore(fake({ 'logic-quest-save': v })).load()).toEqual(emptySave())
    expect(new LocalProgressStore(fake()).importJSON('{"version":1,"knowledge":[1]}').ok).toBe(false)
  })
  it('helped: defaults to {} for an old v1 save, keeps true entries, drops bad ones', () => {
    expect(emptySave().helped).toEqual({})
    const old = new LocalProgressStore(fake({ 'logic-quest-save': '{"version":1,"rooms":{}}' })).load()
    expect(old.helped).toEqual({})
    const raw = JSON.stringify({ version: 1, helped: { a: true, b: false, c: 'yes', d: 1 } })
    expect(new LocalProgressStore(fake({ 'logic-quest-save': raw })).load().helped).toEqual({ a: true })
    const bad = JSON.stringify({ version: 1, helped: [1, 2] })
    expect(new LocalProgressStore(fake({ 'logic-quest-save': bad })).load().helped).toEqual({})
  })
  it('helped survives export/import', () => {
    const a = new LocalProgressStore(fake())
    a.save({ ...emptySave(), helped: { r1: true } })
    const r = new LocalProgressStore(fake()).importJSON(a.exportJSON(a.load()))
    expect(r.ok && r.data.helped).toEqual({ r1: true })
  })
})

describe('lessons field', () => {
  const load = (v: unknown) => new LocalProgressStore(fake({ 'logic-quest-save': JSON.stringify(v) })).load()
  it('defaults to {} (empty save and an old v1 save); version stays 1', () => {
    expect(emptySave().lessons).toEqual({})
    const old = load({ version: 1, rooms: {} })
    expect(old.lessons).toEqual({})
    expect(old.version).toBe(1)
  })
  it('keeps good entries and drops bad ones without rejecting the save', () => {
    const lessons = {
      ok: { stepId: 's1', done: false },
      full: { stepId: 's2', done: true, skipped: true, quizFailedAt: 123 },
      noStep: { done: true },
      badDone: { stepId: 'x', done: 'yes' },
      badSkip: { stepId: 'x', done: true, skipped: 1 },
      badTime: { stepId: 'x', done: false, quizFailedAt: 'soon' },
      nanTime: { stepId: 'x', done: false, quizFailedAt: null },
      notObj: 5,
    }
    const s = load({ version: 1, knowledge: ['k'], lessons })
    expect(s.knowledge).toEqual(['k'])
    expect(s.lessons).toEqual({ ok: lessons.ok, full: lessons.full })
  })
  it('a lessons value that is not an object becomes {}', () => {
    for (const lessons of [[1], 'x', 3, null]) expect(load({ version: 1, lessons }).lessons).toEqual({})
  })
  it('lessons survive export/import', () => {
    const d = { ...emptySave(), lessons: { l: { stepId: 'a', done: true, skipped: true } } }
    const r = new LocalProgressStore(fake()).importJSON(new LocalProgressStore(fake()).exportJSON(d))
    expect(r.ok && r.data.lessons).toEqual(d.lessons)
  })
})

describe('read-modify-write (two tabs on one storage)', () => {
  const solved = { solved: true, optimal: false, noHints: false }
  const solve = (id: string) => (d: SaveData): SaveData => ({ ...d, rooms: { ...d.rooms, [id]: solved } })

  it('a stale tab applies its change on top of the newer stored save', () => {
    const st = fake()
    const a = new LocalProgressStore(st)
    const b = new LocalProgressStore(st)
    let memA = a.load()
    let memB = b.load()
    memA = applyUpdate(a, memA, solve('r1'))
    memB = applyUpdate(b, memB, solve('r2')) // tab B never saw r1
    expect(Object.keys(memB.rooms).sort()).toEqual(['r1', 'r2'])
    expect(Object.keys(new LocalProgressStore(st).load().rooms).sort()).toEqual(['r1', 'r2'])
    memA = applyUpdate(a, memA, solve('r3'))
    expect(Object.keys(memA.rooms).sort()).toEqual(['r1', 'r2', 'r3'])
  })

  it('uses its own memory when storage is unreadable', () => {
    const s = new LocalProgressStore(fake({}, true))
    let mem = s.load()
    mem = applyUpdate(s, mem, solve('r1'))
    mem = applyUpdate(s, mem, solve('r2'))
    expect(Object.keys(mem.rooms).sort()).toEqual(['r1', 'r2'])
  })

  it('uses its own memory when its last write failed (storage still holds what it last saw)', () => {
    const m: Record<string, string> = {}
    let full = false
    const st = {
      getItem: (k: string) => (k in m ? m[k] : null),
      setItem: (k: string, v: string) => { if (full) throw new Error('quota'); m[k] = v },
    } as unknown as Storage
    const s = new LocalProgressStore(st)
    let mem = applyUpdate(s, s.load(), solve('r1'))
    full = true
    mem = applyUpdate(s, mem, solve('r2'))
    mem = applyUpdate(s, mem, solve('r3'))
    expect(Object.keys(mem.rooms).sort()).toEqual(['r1', 'r2', 'r3'])
  })

  it('ignores an unreadable value written by someone else', () => {
    const st = fake()
    const s = new LocalProgressStore(st)
    let mem = applyUpdate(s, s.load(), solve('r1'))
    st.setItem('logic-quest-save', '{oops')
    mem = applyUpdate(s, mem, solve('r2'))
    expect(Object.keys(mem.rooms).sort()).toEqual(['r1', 'r2'])
  })
})
