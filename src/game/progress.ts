import type { Chip, Circuit } from '../logic/circuit'

export interface RoomResult { solved: boolean; optimal: boolean; noHints: boolean }
/**
 * A lesson's progress. `stepId` is the step the player is on (an id, not an index, so editing a lesson can't
 * shift it; an unknown id resumes at the start). `done`: the end was reached or the skip quiz passed.
 * `skipped`: done through the skip quiz only. `quizFailedAt`: when the skip quiz last failed (ms since epoch).
 */
export interface LessonProgress { stepId: string; done: boolean; skipped?: boolean; quizFailedAt?: number }
export interface SaveData {
  version: 1
  rooms: Record<string, RoomResult>
  chips: Record<string, Chip>
  drafts: Record<string, Circuit>
  knowledge: string[]
  bestRun: Record<string, number>
  flagged: string[]
  /** Rooms where help (a hint, autofill, a retry after seeing the answer) was used since the player last started the room over. A solve keeps it. */
  helped: Record<string, true>
  /** Lesson progress by lesson id. Optional in stored saves (older v1 saves have none); loaded as {}. */
  lessons: Record<string, LessonProgress>
  /**
   * Stages whose rooms and run were opened by finishing their lessons. Kept so the unlock is permanent even if
   * lessons are added to the stage later. Optional in stored saves; loaded as [].
   */
  openStages: string[]
  /** When this save was last written (ms since epoch); 0 if unknown. Set by `LocalProgressStore.save`. Used to pick the newer side when merging. */
  savedAt?: number
}
export interface ProgressStore {
  load(): SaveData
  /** The stored save if another writer (another tab) changed it since this store last read or wrote it; else `fallback`. */
  latest(fallback: SaveData): SaveData
  save(d: SaveData): void
  /** The save as a downloadable JSON file (the caller passes its in-memory save). */
  exportJSON(d: SaveData): string
  /** Parses and validates an exported file. It does not write: the caller loads `data` into its save. */
  importJSON(s: string): { ok: true; data: SaveData } | { ok: false; error: string }
}

export const SAVE_KEY = 'logic-quest-save'
export const BACKUP_KEY = 'logic-quest-save-backup'

export function emptySave(): SaveData {
  return { version: 1, rooms: {}, chips: {}, drafts: {}, knowledge: [], bestRun: {}, flagged: [], helped: {}, lessons: {}, openStages: [], savedAt: 0 }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string')

const validCircuit = (v: unknown): v is Circuit =>
  isObj(v) && Array.isArray(v.nodes) && Array.isArray(v.wires) &&
  v.nodes.every(n => isObj(n) && typeof n.id === 'string') &&
  v.wires.every(w => isObj(w) && isObj(w.from) && isObj(w.to))

const validChip = (v: unknown): v is Chip =>
  isObj(v) && typeof v.name === 'string' && isStrArr(v.inputs) && isStrArr(v.outputs) && validCircuit(v.circuit)

function filterEntries<T>(o: Record<string, unknown>, ok: (v: unknown, key: string) => v is T): Record<string, T> {
  return Object.fromEntries(Object.entries(o).filter(([k, x]) => ok(x, k))) as Record<string, T>
}

const canonLesson = (l: LessonProgress): LessonProgress => (l.done && l.skipped === true || l.skipped === undefined ? l : (({ skipped: _s, ...rest }) => rest)(l))
const uniq = (a: string[]): string[] => [...new Set(a)]

const validLesson = (v: unknown): v is LessonProgress =>
  isObj(v) && typeof v.stepId === 'string' && typeof v.done === 'boolean' &&
  (v.skipped === undefined || typeof v.skipped === 'boolean') &&
  (v.quizFailedAt === undefined || (typeof v.quizFailedAt === 'number' && Number.isFinite(v.quizFailedAt)))

/** A chip is stored under its own name; an entry under another key is dropped. */
const validChipEntry = (v: unknown, key: string): v is Chip => validChip(v) && v.name === key

/** Validates a parsed value as a version-1 save, filling missing fields with empty defaults. */
export function parseSave(v: unknown): SaveData | null { return normalize(v) }

function normalize(v: unknown): SaveData | null {
  if (!isObj(v) || v.version !== 1) return null
  const e = emptySave()
  const rooms = v.rooms ?? e.rooms
  const chips = v.chips ?? e.chips
  const drafts = v.drafts ?? e.drafts
  const knowledge = v.knowledge ?? e.knowledge
  const bestRun = v.bestRun ?? e.bestRun
  const flagged = v.flagged ?? e.flagged
  if (!isObj(rooms) || !Object.values(rooms).every(r => isObj(r) && typeof r.solved === 'boolean' && typeof r.optimal === 'boolean' && typeof r.noHints === 'boolean')) return null
  if (!isObj(chips) || !isObj(drafts)) return null
  if (!isStrArr(knowledge) || !isStrArr(flagged)) return null
  const helped = isObj(v.helped) ? filterEntries(v.helped, (x): x is true => x === true) : {}
  const lessons = isObj(v.lessons) ? Object.fromEntries(Object.entries(filterEntries(v.lessons, validLesson)).map(([k, l]) => [k, canonLesson(l)])) : {}
  const openStages = Array.isArray(v.openStages) ? [...new Set(v.openStages.filter((x): x is string => typeof x === 'string'))] : []
  if (!isObj(bestRun) || !Object.values(bestRun).every(n => typeof n === 'number')) return null
  const savedAt = typeof v.savedAt === 'number' && Number.isFinite(v.savedAt) ? v.savedAt : 0
  return { ...v, version: 1, savedAt, rooms: rooms as SaveData['rooms'], chips: filterEntries(chips, validChipEntry), drafts: filterEntries(drafts, validCircuit), knowledge: uniq(knowledge), bestRun: bestRun as SaveData['bestRun'], flagged: uniq(flagged), helped, lessons, openStages }
}

export interface LocalStoreOptions { key?: string; storage?: Storage }

export class LocalProgressStore implements ProgressStore {
  /** The raw value this store last read or successfully wrote; a different stored value came from elsewhere. */
  private lastRaw: string | null | undefined
  private storage?: Storage
  private key: string
  /** `new LocalProgressStore()` is today's guest store. A per-owner store passes its own `key`; its backup lives under `<key>-backup`. */
  constructor(opts: LocalStoreOptions | Storage = {}) {
    const o: LocalStoreOptions = typeof (opts as Storage).getItem === 'function' ? { storage: opts as Storage } : opts as LocalStoreOptions
    this.storage = o.storage
    this.key = o.key ?? SAVE_KEY
  }

  private store(): Storage | undefined {
    if (this.storage) return this.storage
    try { return globalThis.localStorage } catch { return undefined }
  }

  load(): SaveData {
    let raw: string | null | undefined
    try {
      raw = this.store()?.getItem(this.key)
      this.lastRaw = raw
      if (!raw) return emptySave()
      const d = normalize(JSON.parse(raw))
      if (d) return d
    } catch { /* fall through to backup */ }
    if (raw) this.backup(raw)
    return emptySave()
  }

  private get backupKey(): string { return this.key === SAVE_KEY ? BACKUP_KEY : `${this.key}-backup` }

  /** Keeps the unreadable raw save once, so a later save() can't destroy the user's data. */
  private backup(raw: string): void {
    try {
      const st = this.store()
      if (st && !st.getItem(this.backupKey)) st.setItem(this.backupKey, raw)
    } catch { /* ignore */ }
  }

  latest(fallback: SaveData): SaveData {
    let raw: string | null | undefined
    try { raw = this.store()?.getItem(this.key) } catch { return fallback }
    if (!raw || raw === this.lastRaw) return fallback
    let d: SaveData | null = null
    try { d = normalize(JSON.parse(raw)) } catch { /* unreadable */ }
    if (!d) { this.backup(raw); return fallback }
    this.lastRaw = raw
    return d
  }

  save(d: SaveData): void {
    const raw = JSON.stringify(d)
    try {
      const st = this.store()
      if (!st) return
      st.setItem(this.key, raw)
      this.lastRaw = raw
    } catch { /* quota or blocked storage: ignore */ }
  }

  exportJSON(d: SaveData): string {
    return JSON.stringify(d, null, 2)
  }

  importJSON(s: string): { ok: true; data: SaveData } | { ok: false; error: string } {
    let parsed: unknown
    try { parsed = JSON.parse(s) } catch { return { ok: false, error: 'invalid JSON' } }
    const d = normalize(parsed)
    if (!d) return { ok: false, error: 'invalid save data' }
    return { ok: true, data: d }
  }
}

/**
 * One update of the save: read the latest stored save (another tab may have written it), apply fn, persist.
 * `current` is this tab's in-memory save, used when storage has nothing newer (or can't be read).
 */
export function applyUpdate(store: ProgressStore, current: SaveData, fn: (d: SaveData) => SaveData): SaveData {
  const next = { ...fn(store.latest(current)), savedAt: Date.now() }
  store.save(next)
  return next
}
