import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SyncEngine } from '../../src/cloud/sync'
import { getSupabase } from '../../src/cloud/client'
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

describe('getSupabase', () => {
  it('is null without env vars and without a fake', () => {
    expect(getSupabase()).toBeNull()
  })
  it('returns the injected fake in test mode', () => {
    const f = new FakeSupabase().client()
    ;(globalThis as Record<string, unknown>).__LQ_FAKE_SUPABASE__ = f
    expect(getSupabase()).toBe(f)
    delete (globalThis as Record<string, unknown>).__LQ_FAKE_SUPABASE__
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

  it('Review Focus 1: two devices push concurrently, both devices\' solved rooms survive (CAS retry + merge)', async () => {
    const fake = new FakeSupabase()
    const a = device(fake), b = device(fake)
    a.engine.start(); b.engine.start(); await flush()
    a.change(d => mergeSaves(d, solved('A1')))
    b.change(d => mergeSaves(d, solved('B1')))
    // b's write lands between a's pull and a's update: make a lose the CAS once
    await vi.advanceTimersByTimeAsync(2000)
    await vi.advanceTimersByTimeAsync(2000)
    expect(roomsOf(fake.rows.get(U)!.data)).toEqual(['A1', 'B1'])
    expect(roomsOf(b.save)).toEqual(['A1', 'B1'])
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
