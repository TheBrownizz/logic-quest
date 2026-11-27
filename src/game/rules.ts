import type { Stage, World } from '../content/types'
import type { RoomResult, SaveData } from './progress'

export function stars(r: RoomResult | undefined): 0 | 1 | 2 | 3 {
  if (!r || !r.solved) return 0
  return (1 + (r.optimal ? 1 : 0) + (r.noHints ? 1 : 0)) as 1 | 2 | 3
}

/** The stage before `stageId` in play order; undefined for the first stage or an unknown id. */
export function previousStage(world: World, stageId: string): Stage | undefined {
  const ordered = [...world.stages].sort((a, b) => a.order - b.order)
  const i = ordered.findIndex(s => s.id === stageId)
  return i > 0 ? ordered[i - 1] : undefined
}

/** Share of the previous stage's rooms that must be solved to open a stage. */
export const UNLOCK_SHARE = 0.6

/** How many more rooms of the previous stage must be solved to open `stageId` (0 when it is open). */
export function roomsToUnlock(world: World, stageId: string, save: SaveData): number {
  const prev = previousStage(world, stageId)
  if (!prev || prev.rooms.length === 0) return 0
  const solved = prev.rooms.filter(r => save.rooms[r.id]?.solved).length
  let need = 0
  while ((solved + need) / prev.rooms.length < UNLOCK_SHARE) need++
  return need
}

export function isStageUnlocked(world: World, stageId: string, save: SaveData): boolean {
  if (!world.stages.some(s => s.id === stageId)) return false
  return roomsToUnlock(world, stageId, save) === 0
}
