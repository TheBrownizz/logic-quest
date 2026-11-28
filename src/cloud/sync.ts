import { mergeSaves } from '../game/merge'
import { parseSave, type ProgressStore, type SaveData } from '../game/progress'
import type { SupabaseLike } from './types'

export type SyncStatus = 'synced' | 'saving' | 'offline'

export const PUSH_DEBOUNCE_MS = 2000
export const BACKOFF_MS = [5000, 15000, 60000]
const MAX_CAS_RETRIES = 3

/** The save without its timestamp: "is there anything the server doesn't have?" must ignore savedAt. */
const body = (d: SaveData): string => JSON.stringify({ ...d, savedAt: 0 })

/**
 * Keeps the local save and the user's server row in step. Local storage stays the truth: the game never waits
 * on this. Pull merges the server's save into the game (`apply`); push writes the merged save with a
 * compare-and-set on `rev`, and on a lost race pulls, merges and retries. Any error shows as 'offline' and is
 * retried with backoff. An unreadable server save (parseSave -> null) is never applied and never overwritten.
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

  constructor(
    private client: SupabaseLike,
    private userId: string,
    private local: ProgressStore,
    private apply: (fn: (d: SaveData) => SaveData) => void,
  ) {}

  private onVisible = (): void => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') void this.sync()
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
    if (this.status !== 'offline') this.setStatus('saving')
    this.schedulePush()
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
    clearTimeout(this.retryTimer)
    const wait = BACKOFF_MS[Math.min(this.backoff, BACKOFF_MS.length - 1)]
    this.backoff++
    this.retryTimer = setTimeout(() => { void this.sync() }, wait)
  }

  private localSave(): SaveData { return this.current ?? this.local.load() }

  /** Pull, then push if there is anything the server lacks. One at a time. */
  private async sync(): Promise<void> {
    if (this.stopped) return
    if (this.running) { this.rerun = true; return }
    this.running = true
    clearTimeout(this.pushTimer)
    try {
      if (!(await this.pull())) return
      if (this.dirty) await this.push()
      else if (!this.stopped) { this.setStatus('synced'); this.backoff = 0 }
    } catch {
      this.fail()
    } finally {
      this.running = false
      if (this.rerun && !this.stopped) { this.rerun = false; void this.sync() }
    }
  }

  /** Reads the server row (creating it if missing) and merges it into the game. False (and offline) on any problem. */
  private async pull(): Promise<boolean> {
    for (let created = false; ; created = true) {
      const { data: row, error } = await this.client.from('saves').select('data, rev').eq('user_id', this.userId).maybeSingle()
      if (this.stopped) return false
      if (error) { this.fail(); return false }
      if (!row) {
        if (created) { this.fail(); return false }
        const r = await this.client.from('saves').upsert({ user_id: this.userId, data: this.localSave(), rev: 0 }, { onConflict: 'user_id', ignoreDuplicates: true })
        if (this.stopped) return false
        if (r.error) { this.fail(); return false }
        continue
      }
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

  /** Writes the current save with update ... where rev = known; on a lost race, pull, merge and retry. */
  private async push(): Promise<void> {
    if (!this.readable || this.known === undefined) return
    this.setStatus('saving')
    for (let attempt = 0; attempt <= MAX_CAS_RETRIES; attempt++) {
      this.dirty = false
      const data = this.localSave()
      const { data: rows, error } = await this.client.from('saves').update({ data, rev: this.known + 1 }).eq('user_id', this.userId).eq('rev', this.known).select('rev')
      if (this.stopped) return
      if (error) { this.dirty = true; this.fail(); return }
      if (rows && rows.length > 0) {
        this.known += 1
        this.backoff = 0
        if (this.dirty) { this.schedulePush(); return }
        this.setStatus('synced')
        return
      }
      this.dirty = true
      if (!(await this.pull())) return
    }
    this.dirty = true
    this.fail()
  }
}

