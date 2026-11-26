import { describe, it, expect } from 'vitest'
import { LocalProgressStore, emptySave } from '../../src/game/progress'

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
  it('save throwing does not crash', () => {
    expect(() => new LocalProgressStore(fake({}, true)).save(emptySave())).not.toThrow()
  })
  it('round trip export/import', () => {
    const a = new LocalProgressStore(fake())
    const d = { ...emptySave(), rooms: { r1: { solved: true, optimal: false, noHints: true } }, bestRun: { s1: 900 } }
    a.save(d)
    const json = a.exportJSON()
    const b = new LocalProgressStore(fake())
    expect(b.importJSON(json)).toEqual({ ok: true })
    expect(b.load()).toEqual(d)
  })
  it('import garbage / bad version / bad shape fails', () => {
    const s = new LocalProgressStore(fake())
    expect(s.importJSON('garbage').ok).toBe(false)
    expect(s.importJSON('{"version":2}').ok).toBe(false)
    expect(s.importJSON('{"version":1,"rooms":5}').ok).toBe(false)
  })
  it('SaveData has no run field', () => {
    expect(Object.keys(emptySave()).sort()).toEqual(['bestRun', 'chips', 'drafts', 'flagged', 'knowledge', 'rooms', 'version'])
  })
  it('drops bad chips/drafts entries, keeps good ones', () => {
    const c = { nodes: [], wires: [] }
    const chip = { name: 'n', inputs: ['a'], outputs: ['b'], circuit: c }
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
})
