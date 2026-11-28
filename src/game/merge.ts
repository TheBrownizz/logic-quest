import { gateCount, type Chip } from '../logic/circuit'
import { emptySave, parseSave, type LessonProgress, type RoomResult, type SaveData } from './progress'

/**
 * How each SaveData field is merged (spec 5.3 and 5.7.1). Keyed by SaveData field, so adding a field to
 * SaveData without a rule here fails to compile, and a test checks the keys against `emptySave()`.
 */
export const MERGE_RULES: Record<keyof SaveData, string> = {
  version: 'stays 1. Unknown fields: taken from the newer save by savedAt, local wins a tie',
  rooms: 'per room, each flag is OR-ed',
  chips: 'union by name; the chip with fewer gates wins',
  drafts: 'union; for the same room the local (current device) draft wins',
  knowledge: 'union',
  bestRun: 'max per stage',
  flagged: 'union',
  helped: 'union',
  lessons: 'done is OR-ed; stepId comes from the save with the higher savedAt (a tie takes the larger stepId by string comparison)',
  openStages: 'union',
  savedAt: 'max',
}

const union = (a: string[], b: string[]): string[] => [...new Set([...a, ...b])]

function mergeRooms(a: Record<string, RoomResult>, b: Record<string, RoomResult>): Record<string, RoomResult> {
  const out: Record<string, RoomResult> = {}
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[id], y = b[id]
    out[id] = {
      solved: !!(x?.solved || y?.solved),
      optimal: !!(x?.optimal || y?.optimal),
      noHints: !!(x?.noHints || y?.noHints),
    }
  }
  return out
}

/** Real gate count with nested chips expanded, each resolved against its own side's chips. Unresolvable: Infinity (loses). */
function realGates(c: Chip, chips: Record<string, Chip>): number {
  try { return gateCount(c.circuit, chips, [c.name]) } catch { return Infinity }
}

/** Fewer gates wins; on a tie the smaller JSON wins, so the result doesn't depend on the argument order. */
function betterChip(x: Chip, y: Chip, xChips: Record<string, Chip>, yChips: Record<string, Chip>): Chip {
  const gx = realGates(x, xChips), gy = realGates(y, yChips)
  if (gx !== gy) return gx < gy ? x : y
  return JSON.stringify(x) <= JSON.stringify(y) ? x : y
}

function mergeChips(a: Record<string, Chip>, b: Record<string, Chip>): Record<string, Chip> {
  const out: Record<string, Chip> = { ...a }
  for (const [n, c] of Object.entries(b)) out[n] = n in a ? betterChip(a[n], c, a, b) : c
  return out
}

function mergeLesson(x: LessonProgress, y: LessonProgress, xNewer: boolean, tie: boolean): LessonProgress {
  const newer = tie ? (x.stepId >= y.stepId ? x : y) : xNewer ? x : y
  const done = x.done || y.done
  const out: LessonProgress = { stepId: newer.stepId, done }
  const doneSides = [x, y].filter(l => l.done)
  if (done && doneSides.every(l => l.skipped)) out.skipped = true
  if (x.quizFailedAt !== undefined || y.quizFailedAt !== undefined) out.quizFailedAt = Math.max(x.quizFailedAt ?? 0, y.quizFailedAt ?? 0)
  return out
}

function mergeLessons(a: SaveData, b: SaveData): Record<string, LessonProgress> {
  const ta = a.savedAt ?? 0, tb = b.savedAt ?? 0
  const out: Record<string, LessonProgress> = {}
  for (const id of new Set([...Object.keys(a.lessons), ...Object.keys(b.lessons)])) {
    const x = a.lessons[id], y = b.lessons[id]
    out[id] = x && y ? mergeLesson(x, y, ta > tb, ta === tb) : { ...(x ?? y) }
  }
  return out
}

/**
 * Merges two saves of the same player (this device and the server) without ever losing progress.
 * Pure; does not mutate its arguments. Symmetric except `drafts`, where `local` wins (spec 5.7.1).
 */
export function mergeSaves(localIn: SaveData, remoteIn: SaveData): SaveData {
  const l = parseSave(localIn), r = parseSave(remoteIn)
  if (!l || !r) return l ?? r ?? emptySave() // a malformed side is ignored; the valid side is kept as is
  return mergeValid(l, r)
}

function mergeValid(local: SaveData, remote: SaveData): SaveData {
  const newer = (remote.savedAt ?? 0) > (local.savedAt ?? 0) ? remote : local
  const older = newer === remote ? local : remote
  const bestRun: Record<string, number> = { ...local.bestRun }
  for (const [k, v] of Object.entries(remote.bestRun)) bestRun[k] = k in bestRun ? Math.max(bestRun[k], v) : v
  return {
    ...older, // unknown fields: the newer save wins, but fields only the older one has are kept
    ...newer,
    version: 1,
    rooms: mergeRooms(local.rooms, remote.rooms),
    chips: mergeChips(local.chips, remote.chips),
    drafts: { ...remote.drafts, ...local.drafts },
    knowledge: union(local.knowledge, remote.knowledge),
    bestRun,
    flagged: union(local.flagged, remote.flagged),
    helped: { ...remote.helped, ...local.helped },
    lessons: mergeLessons(local, remote),
    openStages: union(local.openStages, remote.openStages),
    savedAt: Math.max(local.savedAt ?? 0, remote.savedAt ?? 0),
  }
}
