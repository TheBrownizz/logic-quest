import type { World } from '../content/types'
import type { RoomResult, SaveData } from './progress'

export function stars(r: RoomResult | undefined): 0 | 1 | 2 | 3 {
  if (!r || !r.solved) return 0
  return (1 + (r.optimal ? 1 : 0) + (r.noHints ? 1 : 0)) as 1 | 2 | 3
}

export function isStageUnlocked(world: World, stageId: string, save: SaveData): boolean {
  const ordered = [...world.stages].sort((a, b) => a.order - b.order)
  const i = ordered.findIndex(s => s.id === stageId)
  if (i < 0) return false
  if (i === 0) return true
  const prev = ordered[i - 1]
  if (prev.rooms.length === 0) return true
  const solved = prev.rooms.filter(r => save.rooms[r.id]?.solved).length
  return solved / prev.rooms.length >= 0.6
}
