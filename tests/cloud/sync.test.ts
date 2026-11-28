import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SyncEngine } from '../../src/cloud/sync'
import { getSupabase, isCloudConfigured, loadSupabase } from '../../src/cloud/client'
import { FakeSupabase } from './fakeSupabase'
import { emptySave, LocalProgressStore, type SaveData } from '../../src/game/progress'
import { mergeSaves } from '../../src/game/merge'

const U = 'u1'
const solved = (...ids: string[]): SaveData => ({ ...emptySave(), rooms: Object.fromEntries(ids.map(i => [i, { solved: true, optimal: false, noHints: false }])) })
function mem(): Storage {
  const m: Record<string, string> = {}
  return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v } } as Storage
}

/** A device: a local store, an in-memory "React" save, and an engine. */
function device(fake: FakeSupabase, initial: SaveData = emptySave()) {
  const local = new LocalProgressStore({ storage: mem() })
  const dev = {
    save: initial,
    applied: 0,
    local,
    apply: (fn: (d: SaveData) => SaveData) => { dev.save = fn(dev.save); dev.applied++; local.save(dev.save) },
    engine: null as unknown as SyncEngine,
    change(fn: (d: SaveData) => SaveData) { dev.save = fn(dev.save); local.save(dev.save); dev.engine.notifyChanged(dev.save) },
  }
  dev.engine = new SyncEngine(fake.client(), U, local, dev.apply)
  return dev
}
const flush = () => vi.advanceTimersByTimeAsync(0)
const roomsOf = (d: unknown) => Object.keys((d as SaveData).rooms).sort()

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('client', () => {
  afterEach(() => { vi.unstubAllEnvs(); delete (globalThis as Record<string, unknown>).__LQ_FAKE_SUPABASE__ })
  it('is not configured, and loads nothing, without env vars and without a fake', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', ''); vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    expect(isCloudConfigured()).toBe(false)
    expect(getSupabase()).toBeNull()
    expect(await loadSupabase()).toBeNull()
  })
  it('is configured when both env vars are set', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon')
    expect(isCloudConfigured()).toBe(true)
  })
  it('one env var alone is not enough', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    expect(isCloudConfigured()).toBe(false)
  })
  it('uses the injected fake in test mode', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', ''); vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    const f = new FakeSupabase().client()
    ;(globalThis as Record<string, unknown>).__LQ_FAKE_SUPABASE__ = f
    expect(isCloudConfigured()).toBe(true)
    expect(getSupabase()).toBe(f)
    expect(await loadSupabase()).toBe(f)
  })
  it('ignores the injected fake outside test mode and E2E mode', () => {
    vi.stubEnv('MODE', 'production'); vi.stubEnv('VITE_E2E_FAKE', ''); vi.stubEnv('VITE_SUPABASE_URL', ''); vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    ;(globalThis as Record<string, unknown>).__LQ_FAKE_SUPABASE__ = new FakeSupabase().client()
    expect(isCloudConfigured()).toBe(false)
    expect(getSupabase()).toBeNull()
  })
})

describe('SyncEngine', () => {
  it('first start creates the row (insert, then re-pull), and pushes local progress', async () => {
    const fake = new FakeSupabase()
    const a = device(fake, solved('r1'))
    a.engine.start(); await flush()
    expect(fake.calls.upsert).toBe(1)
    expect(fake.rows.has(U)).toBe(true)
    await vi.advanceTimersByTimeAsync(2000)
    expect(roomsOf(fake.rows.get(U)!.data)).toEqual(['r1'])
    expect(a.engine.status).toBe('synced')
    a.engine.stop()
  })

  it('pull merges server progress into the device via apply', async () => {
    const fake = new FakeSupabase()
    fake.concurrentWrite(U, solved('remote1'))
    const a = device(fake, solved('local1'))
    a.engine.start(); await flush()
    expect(roomsOf(a.save)).toEqual(['local1', 'remote1'])
    await vi.advanceTimersByTimeAsync(2000)
    expect(roomsOf(fake.rows.get(U)!.data)).toEqual(['local1', 'remote1'])
    a.engine.stop()
  })

  it('push is debounced by 2 s and coalesces changes', async () => {
    const fake = new FakeSupabase()
    const a = device(fake)
    a.engine.start(); await flush()
    const before = fake.calls.update
    a.change(d => mergeSaves(d, solved('r1')))
    expect(a.engine.status).toBe('saving')
    await vi.advanceTimersByTimeAsync(1500)
    a.change(d => mergeSaves(d, solved('r2')))
    await vi.advanceTimersByTimeAsync(1500)
    expect(fake.calls.update).toBe(before)
    await vi.advanceTimersByTimeAsync(600)
    expect(fake.calls.update).toBe(before + 1)
    expect(roomsOf(fake.rows.get(U)!.data)).toEqual(['r1', 'r2'])
    expect(a.engine.status).toBe('synced')
    a.engine.stop()
  })

  it('Review Focus 1: two devices push concurrently; one update loses the CAS, then both rooms survive on both devices', async () => {
    const fake = new FakeSupabase()
    const a = device(fake), b = device(fake)
    a.engine.start(); b.engine.start(); await flush()
    const before = fake.calls.update
    a.change(d => mergeSaves(d, solved('A1')))
    b.change(d => mergeSaves(d, solved('B1')))
    const g = hold() // both devices read the same rev before either writes
    fake.gates.select = () => g.promise
    await vi.advanceTimersByTimeAsync(2000)
    fake.gates.select = undefined
    g.release()
    await vi.advanceTimersByTimeAsync(100)
    expect(fake.calls.update - before).toBe(3) // a ok, b matches 0 rows, b retries after merging
    expect(roomsOf(fake.rows.get(U)!.data)).toEqual(['A1', 'B1'])
    expect(roomsOf(b.save)).toEqual(['A1', 'B1'])
    a.engine.stop(); a.engine.start(); await flush() // a's next pull
    expect(roomsOf(a.save)).toEqual(['A1', 'B1'])
    a.engine.stop(); b.engine.stop()
  })

  it('a lost CAS (rev changed under us) pulls, merges and retries', async () => {
    const fake = new FakeSupabase()
    const a = device(fake)
    a.engine.start(); await flush()
    let once = true
    fake.beforeUpdate = () => { if (once) { once = false; fake.concurrentWrite(U, solved('other')) } }
    a.change(d => mergeSaves(d, solved('mine')))
    await vi.advanceTimersByTimeAsync(2000)
    expect(roomsOf(fake.rows.get(U)!.data)).toEqual(['mine', 'other'])
    expect(roomsOf(a.save)).toEqual(['mine', 'other'])
    expect(a.engine.status).toBe('synced')
    a.engine.stop()
  })

  it('gives up after 3 CAS retries: offline, then recovers', async () => {
    const fake = new FakeSupabase()
    const a = device(fake)
    a.engine.start(); await flush()
    let n = 0
    fake.beforeUpdate = () => { if (n++ < 4) fake.concurrentWrite(U, solved('w' + n)) }
    a.change(d => mergeSaves(d, solved('mine')))
    await vi.advanceTimersByTimeAsync(2000)
    expect(a.engine.status).toBe('offline')
    await vi.advanceTimersByTimeAsync(5000)
    expect(a.engine.status).toBe('synced')
    expect(roomsOf(fake.rows.get(U)!.data)).toContain('mine')
    a.engine.stop()
  })

  it('Review Focus 3: errors set offline, game state untouched, retries with backoff 5s/15s/60s', async () => {
    const fake = new FakeSupabase()
    const a = device(fake)
    a.engine.start(); await flush()
    const seen: string[] = []
    a.engine.onStatus(s => seen.push(s))
    fake.failures.push({ message: 'net' }, { message: 'net' }, { message: 'net' })
    a.change(d => mergeSaves(d, solved('r1')))
    await vi.advanceTimersByTimeAsync(2000)
    expect(a.engine.status).toBe('offline')
    expect(roomsOf(a.save)).toEqual(['r1'])
    const calls = () => fake.calls.select + fake.calls.update + fake.calls.upsert
    let c = calls()
    await vi.advanceTimersByTimeAsync(4900); expect(calls()).toBe(c)
    await vi.advanceTimersByTimeAsync(200); expect(calls()).toBeGreaterThan(c) // 5 s retry fails
    c = calls()
    await vi.advanceTimersByTimeAsync(14000); expect(calls()).toBe(c)
    await vi.advanceTimersByTimeAsync(1500); expect(calls()).toBeGreaterThan(c) // 15 s retry fails
    expect(a.engine.status).toBe('offline')
    c = calls()
    await vi.advanceTimersByTimeAsync(59000); expect(calls()).toBe(c)
    await vi.advanceTimersByTimeAsync(2000) // 60 s retry succeeds
    expect(a.engine.status).toBe('synced')
    expect(roomsOf(fake.rows.get(U)!.data)).toEqual(['r1'])
    expect(seen).toContain('offline')
    a.engine.stop()
  })

  it('pulls again when the tab becomes visible', async () => {
    const fake = new FakeSupabase()
    const listeners: Record<string, () => void> = {}
    const doc = { visibilityState: 'visible', addEventListener: (e: string, f: () => void) => { listeners[e] = f }, removeEventListener: (e: string) => { delete listeners[e] } }
    vi.stubGlobal('document', doc)
    const a = device(fake)
    a.engine.start(); await flush()
    fake.concurrentWrite(U, solved('elsewhere'))
    listeners.visibilitychange(); await flush()
    expect(roomsOf(a.save)).toEqual(['elsewhere'])
    a.engine.stop()
    expect(listeners.visibilitychange).toBeUndefined()
    vi.unstubAllGlobals()
  })

  it('unreadable remote data (e.g. a future v2 save): no apply, no push, offline, server row untouched', async () => {
    const fake = new FakeSupabase()
    const v2 = { version: 2, rooms: 'weird' }
    fake.concurrentWrite(U, v2)
    const a = device(fake, solved('local'))
    a.engine.start(); await flush()
    a.change(d => mergeSaves(d, solved('more')))
    await vi.advanceTimersByTimeAsync(2000)
    expect(a.engine.status).toBe('offline')
    expect(a.applied).toBe(0)
    expect(fake.calls.update).toBe(0)
    expect(fake.calls.upsert).toBe(0)
    expect(fake.rows.get(U)!.data).toEqual(v2)
    await vi.advanceTimersByTimeAsync(120000)
    expect(fake.calls.update).toBe(0)
    expect(fake.rows.get(U)!.data).toEqual(v2)
    a.engine.stop()
  })

  it('stop() cancels pending pushes and timers', async () => {
    const fake = new FakeSupabase()
    const a = device(fake)
    a.engine.start(); await flush()
    const u = fake.calls.update
    a.change(d => mergeSaves(d, solved('r1')))
    a.engine.stop()
    await vi.advanceTimersByTimeAsync(10000)
    expect(fake.calls.update).toBe(u)
  })
})

describe('parseSave strictness', () => {
  it('rejects non-finite bestRun values', async () => {
    const { parseSave } = await import('../../src/game/progress')
    expect(parseSave({ version: 1, bestRun: { s: null } })).toBeNull()
    expect(parseSave(JSON.parse('{"version":1,"bestRun":{"s":1e999}}'))).toBeNull()
  })
})

function hold() {
  let release!: () => void
  const promise = new Promise<void>(r => { release = r })
  return { promise, release }
}
/** A document stub whose listeners the test can fire. */
function fakeDoc(state: 'visible' | 'hidden' = 'visible') {
  const l: Record<string, () => void> = {}
  const doc = { visibilityState: state, addEventListener: (e: string, f: () => void) => { l[e] = f }, removeEventListener: (e: string) => { delete l[e] } }
  vi.stubGlobal('document', doc)
  return { doc, fire: () => l.visibilitychange?.(), has: () => !!l.visibilitychange }
}
const v2 = { version: 2, rooms: 'weird' }

describe('review hardening', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('I1: a no-op pull does not push, even though jsonb reorders keys', async () => {
    const fake = new FakeSupabase()
    const d = fakeDoc()
    const a = device(fake, { ...solved('r1'), chips: { HA: { name: 'HA', inputs: ['A'], outputs: ['Q'], circuit: { nodes: [{ id: 'a', kind: 'IN', label: 'A', x: 0, y: 0 }], wires: [] } } } })
    a.engine.start(); await vi.advanceTimersByTimeAsync(2500)
    const u = fake.calls.update
    for (let i = 0; i < 3; i++) { d.fire(); await vi.advanceTimersByTimeAsync(2500) }
    expect(fake.calls.update).toBe(u)
    expect(a.engine.status).toBe('synced')
    a.engine.stop()
  })

  it('M3: two devices racing to create the first row lose nothing', async () => {
    const fake = new FakeSupabase()
    const a = device(fake, solved('A1')), b = device(fake, solved('B1'))
    a.engine.start(); b.engine.start()
    await vi.advanceTimersByTimeAsync(2500)
    expect(roomsOf(fake.rows.get(U)!.data)).toEqual(['A1', 'B1'])
    expect(roomsOf(b.save)).toEqual(['A1', 'B1'])
    a.engine.stop(); a.engine.start(); await flush()
    expect(roomsOf(a.save)).toEqual(['A1', 'B1'])
    a.engine.stop(); b.engine.stop()
  })

  it('M3: a local change during an in-flight update is pushed afterwards', async () => {
    const fake = new FakeSupabase()
    const a = device(fake)
    a.engine.start(); await flush()
    const g = hold()
    fake.gates.update = () => g.promise
    a.change(d => mergeSaves(d, solved('X')))
    await vi.advanceTimersByTimeAsync(2000) // update in flight
    a.change(d => mergeSaves(d, solved('Y')))
    fake.gates.update = undefined
    g.release()
    await vi.advanceTimersByTimeAsync(2500)
    expect(roomsOf(fake.rows.get(U)!.data)).toEqual(['X', 'Y'])
    expect(a.engine.status).toBe('synced')
    a.engine.stop()
  })

  it('M3: a local change during an in-flight pull is kept and pushed', async () => {
    const fake = new FakeSupabase()
    fake.concurrentWrite(U, solved('remote'))
    const a = device(fake, solved('L0'))
    const g = hold()
    let first = true
    fake.gates.select = () => { if (!first) return Promise.resolve(); first = false; return g.promise }
    a.engine.start(); await flush()
    a.change(d => mergeSaves(d, solved('Y')))
    g.release()
    await vi.advanceTimersByTimeAsync(4500)
    expect(roomsOf(a.save)).toEqual(['L0', 'Y', 'remote'])
    expect(roomsOf(fake.rows.get(U)!.data)).toEqual(['L0', 'Y', 'remote'])
    a.engine.stop()
  })

  it('M3: unreadable remote reached through the CAS-retry pull: no further update, no apply, row untouched', async () => {
    const fake = new FakeSupabase()
    const a = device(fake)
    a.engine.start(); await vi.advanceTimersByTimeAsync(100)
    const u = fake.calls.update
    let applied = -1
    fake.beforeUpdate = () => { fake.beforeUpdate = null; applied = a.applied; fake.concurrentWrite(U, v2) }
    a.change(d => mergeSaves(d, solved('r1')))
    await vi.advanceTimersByTimeAsync(2000)
    expect(a.engine.status).toBe('offline')
    expect(fake.calls.update).toBe(u + 1)
    expect(a.applied).toBe(applied)
    await vi.advanceTimersByTimeAsync(120000)
    expect(fake.calls.update).toBe(u + 1)
    expect(fake.rows.get(U)!.data).toEqual(v2)
    a.engine.stop()
  })

  it('M3: unreadable remote reached through visibilitychange: no apply, no push, row untouched', async () => {
    const fake = new FakeSupabase()
    const d = fakeDoc()
    const a = device(fake)
    a.engine.start(); await flush()
    fake.concurrentWrite(U, v2)
    const applied = a.applied, u = fake.calls.update
    d.fire(); await flush()
    expect(a.engine.status).toBe('offline')
    a.change(x => mergeSaves(x, solved('r1')))
    await vi.advanceTimersByTimeAsync(130000)
    expect(a.applied).toBe(applied)
    expect(fake.calls.update).toBe(u)
    expect(fake.rows.get(U)!.data).toEqual(v2)
    a.engine.stop()
  })

  it('M3: stop() while an update is in flight leaves no timers, no further calls', async () => {
    const fake = new FakeSupabase()
    const a = device(fake)
    a.engine.start(); await flush()
    const g = hold()
    fake.gates.update = () => g.promise
    a.change(d => mergeSaves(d, solved('r1')))
    await vi.advanceTimersByTimeAsync(2000)
    a.engine.stop()
    g.release()
    await vi.advanceTimersByTimeAsync(130000)
    expect(vi.getTimerCount()).toBe(0)
    expect(fake.calls.update).toBe(1)
  })

  it('M3: stop() while a pull is in flight applies nothing', async () => {
    const fake = new FakeSupabase()
    fake.concurrentWrite(U, solved('remote'))
    const a = device(fake)
    const g = hold()
    fake.gates.select = () => g.promise
    a.engine.start(); await flush()
    a.engine.stop()
    g.release()
    await vi.advanceTimersByTimeAsync(130000)
    expect(a.applied).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('M4: while offline, local changes wait for the backoff; success clears the retry timer', async () => {
    const fake = new FakeSupabase()
    const a = device(fake)
    a.engine.start(); await flush()
    fake.failures.push({ message: 'net' })
    a.change(d => mergeSaves(d, solved('r1')))
    await vi.advanceTimersByTimeAsync(2000)
    expect(a.engine.status).toBe('offline')
    const calls = () => fake.calls.select + fake.calls.update + fake.calls.upsert
    const c = calls()
    a.change(d => mergeSaves(d, solved('r2')))
    await vi.advanceTimersByTimeAsync(4900)
    expect(calls()).toBe(c)
    await vi.advanceTimersByTimeAsync(200) // the 5 s backoff fires
    expect(a.engine.status).toBe('synced')
    expect(roomsOf(fake.rows.get(U)!.data)).toEqual(['r1', 'r2'])
    expect(vi.getTimerCount()).toBe(0)
    a.engine.stop()
  })

  it('A3: overwrite replaces the server save without merging, and applies nothing', async () => {
    const fake = new FakeSupabase()
    fake.concurrentWrite(U, solved('old1', 'old2'))
    const a = device(fake)
    a.engine.start(); await flush()
    const applied = a.applied, rev = fake.rows.get(U)!.rev
    a.engine.overwrite({ ...solved('fresh'), resetGen: 1 })
    await flush()
    expect(roomsOf(fake.rows.get(U)!.data)).toEqual(['fresh'])
    expect(fake.rows.get(U)!.rev).toBe(rev + 1)
    expect(a.applied).toBe(applied)
    expect(a.engine.status).toBe('synced')
    // the provider also resets the game's own save; later pulls then don't resurrect the old rooms
    a.save = { ...solved('fresh'), resetGen: 1 }
    a.engine.stop(); a.engine.start(); await flush()
    expect(roomsOf(fake.rows.get(U)!.data)).toEqual(['fresh'])
    a.engine.stop()
  })

  it('A3: overwrite survives a lost CAS and works on an unreadable remote', async () => {
    const fake = new FakeSupabase()
    const a = device(fake)
    a.engine.start(); await flush()
    fake.beforeUpdate = () => { fake.beforeUpdate = null; fake.concurrentWrite(U, v2) }
    a.engine.overwrite({ ...solved('fresh'), resetGen: 1 })
    await flush()
    expect(roomsOf(fake.rows.get(U)!.data)).toEqual(['fresh'])
    expect(a.engine.status).toBe('synced')
    a.engine.stop()
  })

  it('A3: a pull in flight when overwrite is called is discarded', async () => {
    const fake = new FakeSupabase()
    fake.concurrentWrite(U, solved('old'))
    const a = device(fake)
    const g = hold()
    let first = true
    fake.gates.select = () => { if (!first) return Promise.resolve(); first = false; return g.promise }
    a.engine.start(); await flush()
    a.engine.overwrite({ ...solved('fresh'), resetGen: 1 })
    g.release()
    await vi.advanceTimersByTimeAsync(2500)
    expect(roomsOf(fake.rows.get(U)!.data)).toEqual(['fresh'])
    expect(a.applied).toBe(0)
    a.engine.stop()
  })

  it('A3 race: overwrite while a push update is in flight and loses the CAS does not merge old server progress back', async () => {
    const fake = new FakeSupabase()
    fake.concurrentWrite(U, solved('old'))
    const a = device(fake)
    a.engine.start(); await vi.advanceTimersByTimeAsync(100)
    const g = hold()
    fake.gates.update = () => g.promise
    a.change(x => mergeSaves(x, solved('mine')))
    await vi.advanceTimersByTimeAsync(2000) // update in flight
    fake.gates.update = undefined
    fake.concurrentWrite(U, solved('old', 'other')) // so the in-flight update loses the CAS
    const fresh = { ...solved('fresh'), resetGen: 1 }
    a.save = fresh // the provider resets the game's own save too
    a.engine.overwrite(fresh)
    const applied = a.applied
    g.release()
    await vi.advanceTimersByTimeAsync(5000)
    expect(roomsOf(fake.rows.get(U)!.data)).toEqual(['fresh'])
    expect(roomsOf(a.save)).toEqual(['fresh'])
    expect(a.applied).toBe(applied)
    a.engine.stop(); a.engine.start(); await vi.advanceTimersByTimeAsync(3000)
    expect(roomsOf(fake.rows.get(U)!.data)).toEqual(['fresh'])
    expect(roomsOf(a.save)).toEqual(['fresh'])
    a.engine.stop()
  })

  it('A3: a change made while the reset is being written is still pushed', async () => {
    const fake = new FakeSupabase()
    const a = device(fake)
    a.engine.start(); await vi.advanceTimersByTimeAsync(100)
    const g = hold()
    fake.gates.update = () => g.promise
    a.save = { ...solved('fresh'), resetGen: 1 } // the provider commits the reset locally first
    a.engine.overwrite(a.save)
    await vi.advanceTimersByTimeAsync(10) // reset update in flight
    fake.gates.update = undefined
    a.change(x => mergeSaves(x, { ...solved('after'), resetGen: 1 }))
    g.release()
    await vi.advanceTimersByTimeAsync(5000)
    expect(roomsOf(fake.rows.get(U)!.data)).toEqual(['after', 'fresh'])
    expect(a.engine.status).toBe('synced')
    a.engine.stop()
  })

  it('flush: resolves true after a pending reset is written; false when offline', async () => {
    const fake = new FakeSupabase()
    const a = device(fake)
    a.engine.start(); await vi.advanceTimersByTimeAsync(100)
    a.engine.overwrite({ ...solved('fresh'), resetGen: 1 })
    const p = a.engine.flush()
    await vi.advanceTimersByTimeAsync(200)
    expect(await p).toBe(true)
    expect(roomsOf(fake.rows.get(U)!.data)).toEqual(['fresh'])
    fake.failures.push({ message: 'net' })
    a.change(d => mergeSaves(d, solved('more')))
    const q = a.engine.flush()
    await vi.advanceTimersByTimeAsync(200)
    expect(await q).toBe(false)
    a.engine.stop()
  })

  it('A5: a reset on device A reaches device B, which had old local progress; nothing flows back', async () => {
    const fake = new FakeSupabase()
    const a = device(fake, solved('old1')), b = device(fake, solved('old1'))
    a.engine.start(); b.engine.start(); await vi.advanceTimersByTimeAsync(2500)
    const fresh = { ...emptySave(), resetGen: 1 }
    a.save = fresh
    a.engine.overwrite(fresh)
    await vi.advanceTimersByTimeAsync(500)
    b.change(d => mergeSaves(d, solved('b-new'))) // B still on generation 0
    await vi.advanceTimersByTimeAsync(2500)
    expect(roomsOf(fake.rows.get(U)!.data)).toEqual([])
    expect((fake.rows.get(U)!.data as SaveData).resetGen).toBe(1)
    expect(roomsOf(b.save)).toEqual([])
    expect(b.save.resetGen).toBe(1)
    a.engine.stop(); a.engine.start(); await vi.advanceTimersByTimeAsync(2500)
    expect(roomsOf(a.save)).toEqual([])
    a.engine.stop(); b.engine.stop()
  })

  it('I1: a reset from a device with a stale generation still outranks the server and reaches the others', async () => {
    const fake = new FakeSupabase()
    const a = device(fake, solved('old')), b = device(fake, solved('old'))
    a.engine.start(); b.engine.start(); await vi.advanceTimersByTimeAsync(2500)
    b.engine.stop() // B goes offline with generation 0
    a.save = { ...emptySave(), resetGen: 1 }; a.engine.overwrite(a.save); await vi.advanceTimersByTimeAsync(300)
    a.save = { ...emptySave(), resetGen: 2 }; a.engine.overwrite(a.save); await vi.advanceTimersByTimeAsync(300)
    expect((fake.rows.get(U)!.data as SaveData).resetGen).toBe(2)
    // B comes back and resets from its stale state (the provider would write generation 0 + 1 = 1)
    b.save = { ...solved('b-fresh'), resetGen: 1 }
    b.engine.start(); b.engine.overwrite(b.save)
    await vi.advanceTimersByTimeAsync(500)
    const server = fake.rows.get(U)!.data as SaveData
    expect(server.resetGen).toBe(3)
    expect(roomsOf(server)).toEqual(['b-fresh'])
    expect(b.save.resetGen).toBe(3) // B carries the generation it wrote
    a.engine.stop(); a.engine.start(); await vi.advanceTimersByTimeAsync(500)
    expect(roomsOf(a.save)).toEqual(['b-fresh'])
    expect(a.save.resetGen).toBe(3)
    a.engine.stop(); b.engine.stop()
  })

  it('I2: onReady fires only after the first successful pull', async () => {
    const fake = new FakeSupabase()
    const a = device(fake)
    let ready = 0
    a.engine.onReady(() => ready++)
    fake.failures.push({ message: 'net' })
    a.engine.start(); await vi.advanceTimersByTimeAsync(100)
    expect(a.engine.ready).toBe(false)
    expect(ready).toBe(0)
    await vi.advanceTimersByTimeAsync(5000) // backoff retry succeeds
    expect(a.engine.ready).toBe(true)
    expect(ready).toBe(1)
    let late = 0
    a.engine.onReady(() => late++) // already ready: called at once
    expect(late).toBe(1)
    a.engine.stop()
  })

  it('I2: onReady never fires for an unreadable remote', async () => {
    const fake = new FakeSupabase()
    fake.concurrentWrite(U, v2)
    const a = device(fake)
    let ready = 0
    a.engine.onReady(() => ready++)
    a.engine.start(); await vi.advanceTimersByTimeAsync(20000)
    expect(ready).toBe(0)
    a.engine.stop()
  })

  it('A3: hiding the tab flushes a pending push at once', async () => {
    const fake = new FakeSupabase()
    const d = fakeDoc()
    const a = device(fake)
    a.engine.start(); await flush()
    const u = fake.calls.update
    a.change(x => mergeSaves(x, solved('r1')))
    await vi.advanceTimersByTimeAsync(300)
    expect(fake.calls.update).toBe(u)
    d.doc.visibilityState = 'hidden'
    d.fire(); await flush()
    expect(fake.calls.update).toBe(u + 1)
    expect(roomsOf(fake.rows.get(U)!.data)).toEqual(['r1'])
    a.engine.stop()
  })
})
