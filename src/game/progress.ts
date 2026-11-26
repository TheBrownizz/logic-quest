import type { Chip, Circuit } from '../logic/circuit'

export interface RoomResult { solved: boolean; optimal: boolean; noHints: boolean }
export interface SaveData {
  version: 1
  rooms: Record<string, RoomResult>
  chips: Record<string, Chip>
  drafts: Record<string, Circuit>
  knowledge: string[]
  bestRun: Record<string, number>
  flagged: string[]
}
export interface ProgressStore {
  load(): SaveData
  save(d: SaveData): void
  exportJSON(): string
  importJSON(s: string): { ok: true } | { ok: false; error: string }
}

export const SAVE_KEY = 'logic-quest-save'

export function emptySave(): SaveData {
  return { version: 1, rooms: {}, chips: {}, drafts: {}, knowledge: [], bestRun: {}, flagged: [] }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string')

const validCircuit = (v: unknown): v is Circuit =>
  isObj(v) && Array.isArray(v.nodes) && Array.isArray(v.wires) &&
  v.nodes.every(n => isObj(n) && typeof n.id === 'string') &&
  v.wires.every(w => isObj(w) && isObj(w.from) && isObj(w.to))

const validChip = (v: unknown): v is Chip =>
  isObj(v) && typeof v.name === 'string' && isStrArr(v.inputs) && isStrArr(v.outputs) && validCircuit(v.circuit)

function filterEntries<T>(o: Record<string, unknown>, ok: (v: unknown) => v is T): Record<string, T> {
  return Object.fromEntries(Object.entries(o).filter(([, x]) => ok(x))) as Record<string, T>
}

/** Validates a parsed value as a version-1 save, filling missing fields with empty defaults. */
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
  if (!isObj(bestRun) || !Object.values(bestRun).every(n => typeof n === 'number')) return null
  return { version: 1, rooms: rooms as SaveData['rooms'], chips: filterEntries(chips, validChip), drafts: filterEntries(drafts, validCircuit), knowledge, bestRun: bestRun as SaveData['bestRun'], flagged }
}

export class LocalProgressStore implements ProgressStore {
  constructor(private storage?: Storage) {}

  private store(): Storage | undefined {
    if (this.storage) return this.storage
    try { return globalThis.localStorage } catch { return undefined }
  }

  load(): SaveData {
    try {
      const raw = this.store()?.getItem(SAVE_KEY)
      if (!raw) return emptySave()
      return normalize(JSON.parse(raw)) ?? emptySave()
    } catch {
      return emptySave()
    }
  }

  save(d: SaveData): void {
    try { this.store()?.setItem(SAVE_KEY, JSON.stringify(d)) } catch { /* quota or blocked storage: ignore */ }
  }

  exportJSON(): string {
    return JSON.stringify(this.load(), null, 2)
  }

  importJSON(s: string): { ok: true } | { ok: false; error: string } {
    let parsed: unknown
    try { parsed = JSON.parse(s) } catch { return { ok: false, error: 'invalid JSON' } }
    const d = normalize(parsed)
    if (!d) return { ok: false, error: 'invalid save data' }
    this.save(d)
    return { ok: true }
  }
}
