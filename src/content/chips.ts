import type { Chip } from '../logic/circuit'
import type { World } from './types'

/** The chips a world's rooms unlock, built from each room's reference circuit (stage and room order). */
export function referenceChips(world: World): Record<string, Chip> {
  const out: Record<string, Chip> = {}
  for (const stage of [...world.stages].sort((a, b) => a.order - b.order)) {
    for (const room of stage.rooms) {
      const p = room.puzzle
      if (p.type === 'circuit' && p.unlocksChip && !out[p.unlocksChip.name]) {
        out[p.unlocksChip.name] = { name: p.unlocksChip.name, inputs: [...p.unlocksChip.inputs], outputs: [...p.unlocksChip.outputs], circuit: p.reference }
      }
    }
  }
  return out
}
