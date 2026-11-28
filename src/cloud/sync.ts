import { mergeSaves } from '../game/merge'
import { parseSave, type ProgressStore, type SaveData } from '../game/progress'
import type { SupabaseLike } from './types'

export type SyncStatus = 'synced' | 'saving' | 'offline'

export const PUSH_DEBOUNCE_MS = 2000
export const BACKOFF_MS = [5000, 15000, 60000]
const MAX_CAS_RETRIES = 3

/** JSON with sorted keys: Postgres jsonb reorders keys, so "did anything change?" must not depend on order. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  if (typeof v === 'object' && v !== null) {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`
  }
  return JSON.stringify(v) ?? 'null'
}

/** The save without its timestamp: "is there anything the server doesn't have?" must ignore savedAt. */
const body = (d: SaveData): string => canonical({ ...d, savedAt: 0 })

/**
 * Keeps the local save and the user's server row in step. Local storage stays the truth: the game never waits
 * on this. Pull merges the server's save into the game (`apply`); push writes the merged save with a
 * compare-and-set on `rev`, and on a lost race pulls, merges and retries. Any error shows as 'offline' and is
 * retried with backoff. An unreadable server save (parseSave -> null) is never applied and never overwritten.
 *
 * Contract for the provider: call `notifyChanged` only for changes the player made. Do NOT call it for
 * updates that arrive through `apply` (the engine already tracks what it merged), or the two would loop.
 * While offline, changes wait for the next backoff retry instead of triggering attempts of their own; when
 * the tab is hidden, a pending change is pushed at once. `overwrite` is the one way to replace the server
 * save without merging (the explicit reset).
 */
export class SyncEngine {
  status: SyncStatus = 'synced'
  private listeners = new Set<(s: SyncStatus) => void>()
  private known: number | undefined
  private readable = false
  private current: SaveData | null = null
  private dirty = false
  private running = false
  private rerun = false
  private stopped = true
  private pushTimer: ReturnType<typeof setTimeout> | undefined
  private retryTimer: ReturnType<typeof setTimeout> | undefined
  private backoff = 0
  /** Bumped by overwrite(): a pull that started before it must not apply its (now stale) result. */
  private epoch = 0
  private forced: SaveData | null = null

  constructor(
    private client: SupabaseLike,
    private userId: string,
    private local: ProgressStore,
    private apply: (fn: (d: SaveData) => SaveData) => void,
  ) {}

  private onVisible = (): void => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') void this.sync()
    else if (this.dirty && this.status !== 'offline') void this.sync() // hidden: flush the debounce now
  }

  start(): void {
    if (!this.stopped) return
    this.stopped = false
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVisible)
    this.setStatus('saving')
    void this.sync()
  }

  stop(): void {
    this.stopped = true
    clearTimeout(this.pushTimer); clearTimeout(this.retryTimer)
    this.pushTimer = this.retryTimer = undefined
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisible)
  }

  /** The game changed the save: remember it and push after a short pause. */
  notifyChanged(d: SaveData): void {
    if (this.stopped) return
    this.current = d
    this.dirty = true
    if (this.status === 'offline') return // waits for the backoff retry
    this.setStatus('saving')
    this.schedulePush()
  }

  /**
   * Replaces the server save with `d`, without merging (the explicit reset while signed in). Reads the current
   * rev, then writes with the usual compare-and-set, retrying on a lost race. Nothing from the server is applied.
   * Deliberate exception to "never overwrite an unreadable server save": the user explicitly confirmed the reset.
   * Anything in flight or pulled before this call is discarded, so old server progress can't flow back in.
   */
  overwrite(d: SaveData): void {
    if (this.stopped) return
    this.epoch++
    this.forced = d
    this.current = d
    this.dirty = true
    this.setStatus('saving')
    void this.sync()
  }

  /**
   * Pushes anything pending right away and resolves true once everything (a reset included) is written, or
   * false if the engine went offline, was stopped, or `timeoutMs` passed. Call before `stop()` on sign-out.
   */
  async flush(timeoutMs = 15000): Promise<boolean> {
    if (this.stopped) return false
    void this.sync()
    const end = Date.now() + timeoutMs
    while (!this.stopped && Date.now() < end) {
      if (!this.running && !this.dirty && !this.forced && this.status === 'synced') return true
      if (!this.running && this.status === 'offline') return false
      await new Promise(r => setTimeout(r, 20))
    }
    return false
  }

  onStatus(cb: (s: SyncStatus) => void): () => void {
    this.listeners.add(cb)
    return () => { this.listeners.delete(cb) }
  }

  private setStatus(s: SyncStatus): void {
    if (this.status === s) return
    this.status = s
    for (const cb of [...this.listeners]) cb(s)
  }

  private schedulePush(): void {
    clearTimeout(this.pushTimer)
    this.pushTimer = setTimeout(() => { void this.sync() }, PUSH_DEBOUNCE_MS)
  }

  private fail(): void {
    if (this.stopped) return
    this.setStatus('offline')
    clearTimeout(this.pushTimer)
    clearTimeout(this.retryTimer)
    const wait = BACKOFF_MS[Math.min(this.backoff, BACKOFF_MS.length - 1)]
    this.backoff++
    this.retryTimer = setTimeout(() => { void this.sync() }, wait)
  }

  private markSynced(): void {
    this.setStatus('synced')
    this.backoff = 0
    clearTimeout(this.retryTimer)
    this.retryTimer = undefined
  }

  private localSave(): SaveData { return this.current ?? this.local.load() }

  /** Pull, then push if there is anything the server lacks. One at a time. */
  private async sync(): Promise<void> {
    if (this.stopped) return
    if (this.running) { this.rerun = true; return }
    this.running = true
    clearTimeout(this.pushTimer)
    try {
      if (this.forced) { await this.pushForced(); return }
      if (!(await this.pull())) return
      if (this.dirty) await this.push()
      else if (!this.stopped) this.markSynced()
    } catch {
      this.fail()
    } finally {
      this.running = false
      if (this.rerun && !this.stopped) { this.rerun = false; void this.sync() }
    }
  }

  /** Reads the server row (creating it if missing) and merges it into the game. False (and offline) on any problem. */
  private async pull(): Promise<boolean> {
    const epoch = this.epoch
    for (let created = false; ; created = true) {
      const { data: row, error } = await this.client.from('saves').select('data, rev').eq('user_id', this.userId).maybeSingle()
      if (this.stopped || epoch !== this.epoch) return false
      if (error) { this.fail(); return false }
      if (!row) {
        if (created) { this.fail(); return false }
        const r = await this.client.from('saves').upsert({ user_id: this.userId, data: this.localSave(), rev: 0 }, { onConflict: 'user_id', ignoreDuplicates: true })
        if (this.stopped || epoch !== this.epoch) return false
        if (r.error) { this.fail(); return false }
        continue
      }
      if (this.forced) return false // a reset is pending: never merge old server progress into the game
      const remote = parseSave(row.data)
      if (!remote) { this.readable = false; this.fail(); return false } // never apply, never overwrite
      this.readable = true
      this.known = row.rev
      let merged: SaveData | undefined
      this.apply(d => (merged = mergeSaves(d, remote)))
      merged ??= mergeSaves(this.localSave(), remote)
      this.current = merged
      if (body(merged) !== body(mergeSaves(remote, remote))) this.dirty = true
      return true
    }
  }

  /** overwrite(): read the rev (creating the row if missing), then compare-and-set the forced save, no merge. */
  private async pushForced(): Promise<void> {
    for (let attempt = 0; attempt <= MAX_CAS_RETRIES; attempt++) {
      const d = this.forced
      if (!d) return
      const { data: row, error } = await this.client.from('saves').select('data, rev').eq('user_id', this.userId).maybeSingle()
      if (this.stopped) return
      if (error) { this.fail(); return }
      if (!row) {
        const r = await this.client.from('saves').upsert({ user_id: this.userId, data: d, rev: 0 }, { onConflict: 'user_id', ignoreDuplicates: true })
        if (this.stopped) return
        if (r.error) { this.fail(); return }
        continue
      }
      const { data: rows, error: e2 } = await this.client.from('saves').update({ data: d, rev: row.rev + 1 }).eq('user_id', this.userId).eq('rev', row.rev).select('rev')
      if (this.stopped) return
      if (e2) { this.fail(); return }
      if (rows && rows.length > 0) {
        if (this.forced !== d) return // overwritten again meanwhile: the next run handles it
        this.forced = null
        this.known = row.rev + 1
        this.readable = true
        if (this.current !== d) { this.dirty = true; this.schedulePush(); return } // changed while the reset was written
        this.dirty = false
        this.markSynced()
        return
      }
    }
    this.fail()
  }

  /** Writes the current save with update ... where rev = known; on a lost race, pull, merge and retry. */
  private async push(): Promise<void> {
    if (!this.readable || this.known === undefined) return
    this.setStatus('saving')
    const epoch = this.epoch
    for (let attempt = 0; attempt <= MAX_CAS_RETRIES; attempt++) {
      this.dirty = false
      const data = this.localSave()
      const { data: rows, error } = await this.client.from('saves').update({ data, rev: this.known + 1 }).eq('user_id', this.userId).eq('rev', this.known).select('rev')
      if (this.stopped || epoch !== this.epoch || this.forced) return // a reset took over: it re-reads the rev itself
      if (error) { this.dirty = true; this.fail(); return }
      if (rows && rows.length > 0) {
        this.known += 1
        if (this.dirty) { this.backoff = 0; this.schedulePush(); return }
        this.markSynced()
        return
      }
      this.dirty = true
      if (!(await this.pull())) return
      if (epoch !== this.epoch || this.forced) return
    }
    this.dirty = true
    this.fail()
  }
}

