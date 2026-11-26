import type { Card, World } from '../content/types'
import type { SaveData } from './progress'
import { isStageUnlocked } from './rules'

/** Cards of every unlocked stage whose order is at most the run stage's. null if the stage is unknown or locked. */
export function buildDeck(world: World, stageId: string, save: SaveData): Card[] | null {
  const stage = world.stages.find(s => s.id === stageId)
  if (!stage || !isStageUnlocked(world, stageId, save)) return null
  return world.stages
    .filter(s => s.order <= stage.order && isStageUnlocked(world, s.id, save))
    .sort((a, b) => a.order - b.order)
    .flatMap(s => s.cards)
}
