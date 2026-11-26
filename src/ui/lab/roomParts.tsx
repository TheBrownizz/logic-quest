import type { Hint } from '../../content/types'
import type { RoomResult, SaveData } from '../../game/progress'
import { useSave } from '../save'
import { mergeResult } from './labLogic'

/**
 * Saves a solved result, keeping the best of each flag, and returns the merged result.
 * A solve also clears the room's `helped` mark, so a later replay without help can earn the no-hints star.
 */
export function useSolve(roomId: string) {
  const [, update] = useSave()
  return (cur: RoomResult, extra?: (d: SaveData) => SaveData) => {
    let merged = cur
    update(d => {
      merged = mergeResult(d.rooms[roomId], cur)
      const helped = { ...d.helped }
      delete helped[roomId]
      const next = { ...d, rooms: { ...d.rooms, [roomId]: merged }, helped }
      return extra ? extra(next) : next
    })
    return merged
  }
}

/** Whether help was used in this room since its last solve (persisted, so a reload can't hide it). */
export function useHelped(roomId: string): [boolean, () => void] {
  const [save, update] = useSave()
  const mark = () => update(d => (d.helped[roomId] ? d : { ...d, helped: { ...d.helped, [roomId]: true } }))
  return [!!save.helped[roomId], mark]
}

export function Hints({ hints, shown, onReveal }: { hints: Hint[]; shown: number; onReveal: () => void }) {
  if (hints.length === 0) return null
  return (
    <div className="hints">
      {hints.slice(0, shown).map((h, i) => <p key={i} className="hint" data-testid="hint"><span aria-hidden>💡</span> {h.text}</p>)}
      {shown < hints.length && (
        <button type="button" className="btn ghost" onClick={onReveal}>
          רמז <span className="mono">{shown + 1}/{hints.length}</span>
          {shown === 0 && <span className="muted"> · מוותר על כוכב</span>}
        </button>
      )}
    </div>
  )
}
