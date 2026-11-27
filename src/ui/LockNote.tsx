import type { World } from '../content/types'
import type { SaveData } from '../game/progress'
import { previousStage, roomsToUnlock } from '../game/rules'

/** "N more rooms" in Hebrew, with the singular form for one. */
export const moreRooms = (n: number): string => (n === 1 ? 'עוד חדר אחד' : `עוד ${n} חדרים`)

/** The lock message of a stage that isn't open yet, with how many more rooms of the previous stage it needs. */
export function LockNote({ world, stageId, save }: { world: World; stageId: string; save: SaveData }) {
  const need = roomsToUnlock(world, stageId, save)
  const prev = previousStage(world, stageId)
  return (
    <div className="lock-note" data-testid="lock-note">
      <span aria-hidden>🔒</span>
      <p>השלב נעול. פתור {moreRooms(need)} בשלב הקודם{prev ? ` (${prev.title})` : ''} כדי להיכנס.</p>
    </div>
  )
}
